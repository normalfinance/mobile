import React, { useState, useEffect, useMemo } from "react";
import {
  YStack,
  XStack,
  H2,
  Text,
  Button,
  Spacer,
  Circle,
  View
} from "tamagui";
import { ArrowDown, ChevronsUpDown } from "lucide-react-native";
import { SwapSection } from "@/components/swap/SwapSection";
import { SwapButton } from "@/components/swap/SwapButton";
import { useWalletBalances } from "@/services/balance.service";
import {
  useSwapQuote,
  useExecuteSwap,
  useAvailableTokens
} from "@/services/swap.service";
import { SwapFormData, SwapQuoteRequest } from "@/lib/types/swap.types";
import { DisplayAsset } from "@/lib/types/balance.types";
import { formatNormalToken } from "@/lib/utils/format.utils";
import { useToast } from "@/hooks/useToast";
import {
  openStellarExpert,
  getCurrentNetwork
} from "@/lib/utils/stellar.utils";

const SwapCard = () => {
  const [formData, setFormData] = useState<SwapFormData>({
    sellAsset: null,
    buyAsset: null,
    sellAmount: "",
    buyAmount: "",
    slippageTolerance: 0.5
  });
  const [showTransactionDetails, setShowTransactionDetails] = useState(true);

  const { data: walletBalances = [], isLoading: isLoadingBalances } =
    useWalletBalances();
  const { data: availableTokens = [], isLoading: isLoadingTokens } =
    useAvailableTokens();
  const executeSwapMutation = useExecuteSwap();
  const { showToast } = useToast();

  const sellableAssets = useMemo(() => {
    return walletBalances.filter((asset) => parseFloat(asset.balance) > 0);
  }, [walletBalances]);

  const buyableTokens = useMemo(() => {
    const sellAssetAddress =
      formData.sellAsset?.asset_type === "native"
        ? "native"
        : formData.sellAsset?.asset_issuer;

    return availableTokens
      .filter((token) => {
        if (sellAssetAddress && token.address === sellAssetAddress) {
          if (
            token.address !== "native" &&
            formData.sellAsset?.asset_code === token.symbol
          ) {
            return false;
          }
          if (token.address === "native") {
            return false;
          }
        }
        return true;
      })
      .map((token) => ({
        asset_code: token.symbol,
        asset_issuer: token.address === "native" ? undefined : token.address,
        balance: "0",
        asset_type:
          token.address === "native"
            ? ("native" as const)
            : ("credit_alphanum4" as const),
        display_name: token.name,
        logo_url: token.logoUrl
      }));
  }, [availableTokens, formData.sellAsset]);

  const quoteRequest: SwapQuoteRequest = useMemo(() => {
    const sellToken = formatNormalToken(
      formData.sellAsset?.asset_code || "",
      "without-n"
    );

    const buyToken = formatNormalToken(
      formData.buyAsset?.asset_code || "",
      "without-n"
    );

    return {
      tokenIn: sellToken,
      tokenOut: buyToken,
      amountIn: formData.sellAmount,
      slippageTolerance: formData.slippageTolerance
    };
  }, [formData]);

  const {
    data: quote,
    isLoading: isLoadingQuote,
    error: quoteError
  } = useSwapQuote(
    quoteRequest,
    !!(
      formData.sellAsset &&
      formData.buyAsset &&
      formData.sellAmount &&
      parseFloat(formData.sellAmount) > 0
    )
  );

  useEffect(() => {
    if (quote && !isLoadingQuote) {
      setFormData((prev) => ({
        ...prev,
        buyAmount: parseFloat(quote.amountOut).toFixed(6)
      }));
    }
  }, [quote, isLoadingQuote]);

  const selectedAssetBalance = useMemo(() => {
    if (!formData.sellAsset) return undefined;
    const balance = walletBalances.find(
      (asset) => asset.asset_code === formData.sellAsset?.asset_code
    );
    return balance?.balance;
  }, [formData.sellAsset, walletBalances]);

  const handleSellAmountChange = (amount: string) => {
    setFormData((prev) => ({ ...prev, sellAmount: amount }));
  };

  const handleBuyAmountChange = (amount: string) => {
    setFormData((prev) => ({ ...prev, buyAmount: amount }));
  };

  const handleSellAssetSelect = (asset: DisplayAsset) => {
    setFormData((prev) => ({
      ...prev,
      sellAsset: asset,
      sellAmount: "",
      buyAmount: ""
    }));
  };

  const handleBuyAssetSelect = (asset: DisplayAsset) => {
    setFormData((prev) => ({
      ...prev,
      buyAsset: asset,
      buyAmount: ""
    }));
  };

  const handleMaxPress = () => {
    if (selectedAssetBalance) {
      const maxAmount = (parseFloat(selectedAssetBalance) * 0.99).toFixed(6);
      setFormData((prev) => ({ ...prev, sellAmount: maxAmount }));
    }
  };

  const handleSwapDirections = () => {
    setFormData((prev) => ({
      ...prev,
      sellAsset: prev.buyAsset,
      buyAsset: prev.sellAsset,
      sellAmount: prev.buyAmount,
      buyAmount: prev.sellAmount
    }));
  };

  const handleToggleDetails = () => {
    setShowTransactionDetails((prev) => !prev);
  };

  const handleExecuteSwap = async () => {
    if (!quote) return;

    try {
      const result = await executeSwapMutation.mutateAsync(quote.swapParams);

      console.log("🔢 Result from executeSwapMutation:", result);

      // Check if the swap was successful and has a pending status with hash
      if (
        result.backendResponse?.result?.status === "PENDING" &&
        result.backendResponse?.result?.hash
      ) {
        console.log("now show toast");
        const network = getCurrentNetwork();

        showToast({
          message: "Swap transaction submitted successfully!",
          type: "success",
          actionText: "View Transaction",
          onActionPress: () => {
            openStellarExpert(result.backendResponse!.hash!, network);
          },
          duration: 7000
        });
      }

      setFormData({
        sellAsset: null,
        buyAsset: null,
        sellAmount: "",
        buyAmount: "",
        slippageTolerance: 0.5
      });
    } catch (error) {
      console.error("Swap failed:", error);
      showToast({
        message: "Swap transaction failed. Please try again.",
        type: "error",
        duration: 5000
      });
    }
  };

  const isSwapDisabled = useMemo(() => {
    if (!formData.sellAsset || !formData.buyAsset || !formData.sellAmount)
      return true;
    if (parseFloat(formData.sellAmount) <= 0) return true;
    if (
      selectedAssetBalance &&
      parseFloat(formData.sellAmount) > parseFloat(selectedAssetBalance)
    )
      return true;
    if (isLoadingQuote || !quote) return true;
    return false;
  }, [formData, selectedAssetBalance, isLoadingQuote, quote]);

  const getSwapButtonText = () => {
    if (!formData.sellAsset) return "Select a token to sell";
    if (!formData.buyAsset) return "Select a token to buy";
    if (!formData.sellAmount || parseFloat(formData.sellAmount) <= 0)
      return "Enter an amount";
    if (
      selectedAssetBalance &&
      parseFloat(formData.sellAmount) > parseFloat(selectedAssetBalance)
    ) {
      return `Insufficient ${formData.sellAsset.asset_code} balance`;
    }
    if (isLoadingQuote) return "Getting quote...";
    if (quoteError) return "Error getting quote";
    return "Swap";
  };

  return (
    <YStack space='$4'>
      {/* Sell Section */}
      <View marginBottom='$-5'>
        <SwapSection
          label='Sell'
          asset={formData.sellAsset}
          amount={formData.sellAmount}
          onAmountChange={handleSellAmountChange}
          availableAssets={sellableAssets}
          // @ts-ignore
          onAssetSelect={handleSellAssetSelect}
          placeholder='Select token'
          showMaxButton={true}
          onMaxPress={handleMaxPress}
          balance={selectedAssetBalance}
        />
      </View>

      {/* Swap Direction Button */}
      <XStack justifyContent='center' marginVertical='$-2'>
        <Circle
          size={40}
          backgroundColor='#DFE3E8'
          opacity={1}
          zIndex={2}
          borderWidth={3}
          borderRadius={10}
          borderColor='#ffffff'
          pressStyle={{ scale: 0.95 }}
          onPress={handleSwapDirections}
          disabled={!formData.sellAsset || !formData.buyAsset}
        >
          <ArrowDown size={20} color='#252525' />
        </Circle>
      </XStack>

      {/* Buy Section */}
      <View marginTop='$-6'>
        <SwapSection
          label='Buy'
          asset={formData.buyAsset}
          amount={formData.buyAmount}
          onAmountChange={handleBuyAmountChange}
          availableAssets={buyableTokens}
          // @ts-ignore
          onAssetSelect={handleBuyAssetSelect}
          placeholder='Select token'
          readOnly={true}
        />
      </View>

      {/* Swap Button */}
      <View marginTop='$-3'>
        <SwapButton
          onPress={handleExecuteSwap}
          disabled={isSwapDisabled}
          loading={executeSwapMutation.isPending}
          text={getSwapButtonText()}
        />
      </View>

      {/* Transaction Summary */}
      {formData.sellAsset && formData.buyAsset && formData.sellAmount && (
        <Text
          fontSize='$1'
          color='$textSecondary'
          textAlign='center'
          paddingHorizontal='$4'
        >
          Swapping {formData.sellAmount} {formData.sellAsset.asset_code} for{" "}
          {formData.buyAmount} {formData.buyAsset.asset_code}{" "}
          <Text fontSize='$1' color='#1C252E' fontWeight='700'>
            {" "}
            (1 {formData.buyAsset.asset_code} = ${(1000 * 0.2039).toFixed(1)})
          </Text>
        </Text>
      )}

      {/* Transaction Details */}
      {quote && !isLoadingQuote && (
        <YStack space='$3' paddingTop='$3'>
          <XStack
            alignItems='center'
            justifyContent='center'
            space='$2'
            pressStyle={{ opacity: 0.7 }}
            onPress={handleToggleDetails}
          >
            {/* Left line */}
            <View flex={1} height={1} backgroundColor='#737381' />

            {/* Center text */}
            <XStack alignItems='center' space='$1'>
              <Text fontSize='$1' color='#737381' fontWeight='600'>
                {showTransactionDetails ? "Show Less" : "Show More"}
              </Text>
              <ChevronsUpDown size={10} color='#737381' marginTop='2' />
            </XStack>

            {/* Right line */}
            <View flex={1} height={1} backgroundColor='#737381' />
          </XStack>

          {showTransactionDetails && (
            <YStack space='$2'>
              <XStack justifyContent='space-between' alignItems='center'>
                <Text fontSize='$1' color='#637381'>
                  Fee (0.3%)
                </Text>
                <Text fontSize='$1' color='#1C252E' fontWeight='700'>
                  $3.00
                </Text>
              </XStack>

              <XStack justifyContent='space-between' alignItems='center'>
                <Text fontSize='$1' color='#637381'>
                  Network cost
                </Text>
                <Text fontSize='$1' color='#1C252E' fontWeight='700'>
                  $1.08
                </Text>
              </XStack>

              <XStack justifyContent='space-between' alignItems='center'>
                <Text fontSize='$1' color='#637381'>
                  Rate
                </Text>
                <Text fontSize='$1' color='#1C252E' fontWeight='700'>
                  1 {formData.sellAsset?.asset_code} ={" "}
                  {formData.buyAsset?.asset_code &&
                    (
                      parseFloat(quote.amountOut) / parseFloat(quote.amountIn)
                    ).toFixed(6)}{" "}
                  {formData.buyAsset?.asset_code}
                </Text>
              </XStack>

              <XStack justifyContent='space-between' alignItems='center'>
                <Text fontSize='$1' color='#637381'>
                  Max slippage
                </Text>
                <Text fontSize='$1' color='#1C252E' fontWeight='700'>
                  0.50%
                </Text>
              </XStack>

              <XStack justifyContent='space-between' alignItems='center'>
                <Text fontSize='$1' color='#637381'>
                  Price impact
                </Text>
                <Text fontSize='$1' color='#1C252E' fontWeight='700'>
                  ~0.02%
                </Text>
              </XStack>
            </YStack>
          )}
        </YStack>
      )}

      {/* Error Display */}
      {(quoteError || executeSwapMutation.error) && (
        <Text fontSize='$3' color='$red10' textAlign='center'>
          {quoteError?.message ||
            executeSwapMutation.error?.message ||
            "An error occurred"}
        </Text>
      )}
    </YStack>
  );
};

export default function InvestScreen() {
  return (
    <YStack flex={1} padding='$4' backgroundColor='$pageBackground'>
      {/* Header */}
      <XStack
        justifyContent='space-between'
        alignItems='center'
        paddingBottom='$4'
      >
        <Text fontSize='$6' fontWeight='600' color='$textPrimary'>
          Swap
        </Text>
      </XStack>

      <SwapCard />
    </YStack>
  );
}

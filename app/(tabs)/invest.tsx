import React, { useState, useEffect, useMemo } from "react";
import { YStack, XStack, H2, Text, Button, Spacer } from "tamagui";
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

const SwapCard = () => {
  const [formData, setFormData] = useState<SwapFormData>({
    sellAsset: null,
    buyAsset: null,
    sellAmount: "",
    buyAmount: "",
    slippageTolerance: 0.5
  });

  const { data: walletBalances = [], isLoading: isLoadingBalances } =
    useWalletBalances();
  const { data: availableTokens = [], isLoading: isLoadingTokens } =
    useAvailableTokens();
  const executeSwapMutation = useExecuteSwap();

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
    const sellTokenAddress =
      formData.sellAsset?.asset_type === "native"
        ? "native"
        : formData.sellAsset?.asset_issuer || "";

    const buyTokenAddress =
      formData.buyAsset?.asset_type === "native"
        ? "native"
        : formData.buyAsset?.asset_issuer || "";

    return {
      tokenIn: sellTokenAddress,
      tokenOut: buyTokenAddress,
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

  const handleExecuteSwap = async () => {
    if (!quote) return;

    try {
      await executeSwapMutation.mutateAsync(quote.swapParams);
      setFormData({
        sellAsset: null,
        buyAsset: null,
        sellAmount: "",
        buyAmount: "",
        slippageTolerance: 0.5
      });
    } catch (error) {
      console.error("Swap failed:", error);
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
      <SwapSection
        label='Sell'
        asset={formData.sellAsset}
        amount={formData.sellAmount}
        onAmountChange={handleSellAmountChange}
        availableAssets={sellableAssets}
        onAssetSelect={handleSellAssetSelect}
        placeholder='Select token'
        showMaxButton={true}
        onMaxPress={handleMaxPress}
        balance={selectedAssetBalance}
      />

      {/* Swap Direction Button */}
      <XStack justifyContent='center'>
        <Button
          onPress={handleSwapDirections}
          backgroundColor='$gray4'
          borderRadius='$4'
          padding='$2'
          disabled={!formData.sellAsset || !formData.buyAsset}
        >
          <Text>↕</Text>
        </Button>
      </XStack>

      {/* Buy Section */}
      <SwapSection
        label='Buy'
        asset={formData.buyAsset}
        amount={formData.buyAmount}
        onAmountChange={handleBuyAmountChange}
        availableAssets={buyableTokens}
        onAssetSelect={handleBuyAssetSelect}
        placeholder='Select token'
        readOnly={true}
      />

      {/* Quote Information */}
      {quote && !isLoadingQuote && (
        <YStack
          backgroundColor='$gray2'
          borderRadius='$4'
          padding='$3'
          space='$2'
        >
          <XStack justifyContent='space-between'>
            <Text fontSize='$3' color='$gray11'>
              Rate
            </Text>
            <Text fontSize='$3'>
              1 {formData.sellAsset?.asset_code} ={" "}
              {(
                parseFloat(quote.amountOut) / parseFloat(quote.amountIn)
              ).toFixed(6)}{" "}
              {formData.buyAsset?.asset_code}
            </Text>
          </XStack>
          <XStack justifyContent='space-between'>
            <Text fontSize='$3' color='$gray11'>
              Price Impact
            </Text>
            <Text
              fontSize='$3'
              color={parseFloat(quote.priceImpact) > 3 ? "$red10" : "$gray12"}
            >
              {quote.priceImpact}%
            </Text>
          </XStack>
          <XStack justifyContent='space-between'>
            <Text fontSize='$3' color='$gray11'>
              Minimum Received
            </Text>
            <Text fontSize='$3'>
              {parseFloat(quote.amountOutMin).toFixed(6)}{" "}
              {formData.buyAsset?.asset_code}
            </Text>
          </XStack>
        </YStack>
      )}

      {/* Swap Button */}
      <SwapButton
        onPress={handleExecuteSwap}
        disabled={isSwapDisabled}
        loading={executeSwapMutation.isPending}
        text={getSwapButtonText()}
      />

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
    <YStack flex={1} padding='$4' backgroundColor='$background'>
      {/* @ts-ignore */}
      <H2 marginBottom='$4'>Invest</H2>
      {/* @ts-ignore */}
      <Text marginBottom='$4'>Swap between different assets</Text>
      <SwapCard />
    </YStack>
  );
}

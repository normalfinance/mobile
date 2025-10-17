import React from "react";
import { Modal, ScrollView, View } from "react-native";
import { YStack, XStack, Text, Input, Button } from "tamagui";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search } from "lucide-react-native";
import { Check } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";

import { PortfolioValue } from "@/components/portfolio/PortfolioValue";
import { PortfolioChart } from "@/components/portfolio/PortfolioChart";
import { ActionButtons } from "@/components/portfolio/ActionButtons";
import {
  AssetList,
  AssetCard,
  PRICE_CHANGE_ICON_SOURCES
} from "@/components/portfolio/AssetList";
import { TransactionHistory } from "@/components/portfolio/TransactionHistory";
import {
  PortfolioValueSkeleton,
  ChartSkeleton,
  ActionButtonsSkeleton,
  AssetListSkeleton,
  TransactionSkeleton
} from "@/components/ui/skeleton/portfolio-skeletons";
import { usePortfolio } from "@/hooks/use-portfolio";
import { useWallet } from "@/services";
import { useAssets } from "expo-asset";
import { BlurView } from "expo-blur";

export default function HomeScreen() {
  const router = useRouter();
  const {
    portfolioData,
    chartData,
    transactions,
    isLoading,
    isChartRefreshing,
    hasError,
    selectedPeriod,
    selectedCategory,
    handlePeriodChange,
    handleCategoryChange
  } = usePortfolio();
  const { data: walletInfo } = useWallet();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [isReceiveModalOpen, setIsReceiveModalOpen] = React.useState(false);
  const [isCopyingAddress, setIsCopyingAddress] = React.useState(false);
  const [addressCopied, setAddressCopied] = React.useState(false);
  const addressCopyTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [priceChangeAssets] = useAssets(PRICE_CHANGE_ICON_SOURCES);

  const normalizedSearchQuery = React.useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery]
  );

  const handleNavigateToInvest = React.useCallback(() => {
    router.push("/(tabs)/invest");
  }, [router]);

  const handleReceive = React.useCallback(() => {
    setIsReceiveModalOpen(true);
  }, []);

  const handleCloseReceiveModal = React.useCallback(() => {
    setIsReceiveModalOpen(false);
  }, []);

  const walletAddress = walletInfo?.publicKey ?? "";

  const walletShareUrl = React.useMemo(() => {
    if (!walletAddress) {
      return "";
    }

    return `https://stellar.expert/explorer/public/account/${walletAddress}`;
  }, [walletAddress]);

  const increaseAsset = priceChangeAssets?.[0];
  const decreaseAsset = priceChangeAssets?.[1];
  const increaseIconUri = React.useMemo(() => {
    if (!increaseAsset) {
      return undefined;
    }
    return increaseAsset.localUri ?? increaseAsset.uri;
  }, [increaseAsset]);
  const decreaseIconUri = React.useMemo(() => {
    if (!decreaseAsset) {
      return undefined;
    }
    return decreaseAsset.localUri ?? decreaseAsset.uri;
  }, [decreaseAsset]);

  const handleCopyAddress = React.useCallback(async () => {
    if (!walletAddress) {
      return;
    }

    try {
      setIsCopyingAddress(true);
      await Clipboard.setStringAsync(walletAddress);
      setAddressCopied(true);
      if (addressCopyTimeoutRef.current) {
        clearTimeout(addressCopyTimeoutRef.current);
      }
      addressCopyTimeoutRef.current = setTimeout(() => {
        setAddressCopied(false);
        addressCopyTimeoutRef.current = null;
      }, 2000);
    } finally {
      setIsCopyingAddress(false);
    }
  }, [walletAddress]);

  React.useEffect(() => {
    return () => {
      if (addressCopyTimeoutRef.current) {
        clearTimeout(addressCopyTimeoutRef.current);
        addressCopyTimeoutRef.current = null;
      }
    };
  }, []);

  const hasSearchQuery = normalizedSearchQuery.length > 0;

  const searchResults = React.useMemo(() => {
    if (!hasSearchQuery) {
      return [];
    }

    return portfolioData.assets.filter((asset) => {
      const name = asset.display_name?.toLowerCase?.() ?? "";
      const code = asset.asset_code?.toLowerCase?.() ?? "";

      return (
        name.includes(normalizedSearchQuery) ||
        code.includes(normalizedSearchQuery)
      );
    });
  }, [hasSearchQuery, normalizedSearchQuery, portfolioData.assets]);

  return (
    <YStack flex={1} backgroundColor='$background'>
      {hasError ? (
        <YStack
          flex={1}
          padding='$4'
          backgroundColor='$background'
          justifyContent='center'
          alignItems='center'
        >
          <Text
            fontSize='$4'
            color='$red10'
            textAlign='center'
            marginBottom='$4'
          >
            Error loading portfolio data
          </Text>
          <Text fontSize='$3' color='$textSecondary' textAlign='center'>
            Please check your wallet connection and try again
          </Text>
        </YStack>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ minHeight: "100%" }}
          >
            <YStack padding='$3' flex={1}>
              {/* Header with search and statistics */}
              <XStack
                justifyContent='space-between'
                alignItems='center'
                marginBottom='$2'
              >
                <XStack
                  flex={1}
                  alignItems='center'
                  backgroundColor='#919EAB1F'
                  borderWidth={1}
                  borderColor='#919EAB1F'
                  borderRadius='$12'
                  paddingLeft='$3'
                >
                  <Search size={16} color='#737381' />
                  <Input
                    placeholder='Search assets'
                    backgroundColor='transparent'
                    borderWidth={0}
                    flex={1}
                    fontSize='$3'
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </XStack>
              </XStack>

              <View style={{ flex: 1 }}>
                <View style={{ flex: 1 }}>
                  {isLoading ? (
                    <PortfolioValueSkeleton show={isLoading} />
                  ) : (
                    <PortfolioValue
                      totalValue={portfolioData.totalValue}
                      todayChange={portfolioData.todayChange}
                      todayChangePercent={portfolioData.todayChangePercent}
                      isLoading={isLoading}
                    />
                  )}
                </View>

                {isLoading ? (
                  <ChartSkeleton show={isLoading} />
                ) : (
                  <PortfolioChart
                    data={chartData}
                    selectedPeriod={selectedPeriod}
                    onPeriodChange={handlePeriodChange}
                    isRefreshing={isChartRefreshing}
                  />
                )}

                {isLoading ? (
                  <ActionButtonsSkeleton show={isLoading} />
                ) : (
                  <ActionButtons
                    onSwap={handleNavigateToInvest}
                    onSend={handleNavigateToInvest}
                    onBuy={handleNavigateToInvest}
                    onSell={handleNavigateToInvest}
                    onReceive={handleReceive}
                  />
                )}

                {isLoading ? (
                  <AssetListSkeleton show={isLoading} itemCount={5} />
                ) : (
                  <AssetList
                    assets={portfolioData.assets}
                    selectedCategory={selectedCategory}
                    onCategoryChange={handleCategoryChange}
                    isLoading={isLoading}
                    searchQuery={searchQuery}
                  />
                )}
              </View>

              {/* Transaction History */}
              {isLoading ? (
                <TransactionSkeleton show={isLoading} itemCount={3} />
              ) : (
                <TransactionHistory
                  transactions={transactions}
                  isLoading={isLoading}
                />
              )}
            </YStack>
          </ScrollView>

          {hasSearchQuery && (
            <BlurView
              intensity={50}
              tint='dark'
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
              }}
            >
              <YStack flex={1} padding='$3' gap='$4' paddingTop='$6'>
                <XStack
                  alignItems='center'
                  justifyContent='space-between'
                  gap='$2'
                >
                  <XStack
                    flex={1}
                    alignItems='center'
                    backgroundColor='#919EAB1F'
                    borderWidth={1}
                    borderColor='#919EAB1F'
                    borderRadius='$12'
                    paddingLeft='$3'
                  >
                    <Search size={16} color='#737381' />
                    <Input
                      placeholder='Search assets'
                      backgroundColor='transparent'
                      borderWidth={0}
                      flex={1}
                      fontSize='$3'
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      autoFocus
                    />
                  </XStack>
                  <Button
                    backgroundColor='transparent'
                    borderWidth={0}
                    onPress={() => setSearchQuery("")}
                  >
                    <Text color='#FFFFFF' fontWeight='600'>
                      Cancel
                    </Text>
                  </Button>
                </XStack>

                <ScrollView
                  contentContainerStyle={{ paddingBottom: 24 }}
                  showsVerticalScrollIndicator={false}
                >
                  <YStack gap='$3'>
                    {searchResults.map((asset) => (
                      <AssetCard
                        key={`${asset.asset_code}-${
                          asset.asset_issuer || "native"
                        }-search`}
                        asset={asset}
                        increaseIconUri={increaseIconUri}
                        decreaseIconUri={decreaseIconUri}
                        onPress={() => {
                          router.push(
                            `/asset/${asset.asset_code.toLowerCase()}`
                          );
                          setSearchQuery("");
                        }}
                      />
                    ))}

                    {searchResults.length === 0 && (
                      <YStack
                        backgroundColor='#F9FAFB'
                        padding='$4'
                        borderRadius='$6'
                        alignItems='center'
                      >
                        <Text fontSize='$4' color='#1C252E' textAlign='center'>
                          No assets match your search.
                        </Text>
                      </YStack>
                    )}
                  </YStack>
                </ScrollView>
              </YStack>
            </BlurView>
          )}

          <Modal
            visible={isReceiveModalOpen}
            transparent
            animationType='slide'
            onRequestClose={handleCloseReceiveModal}
          >
            <YStack
              flex={1}
              justifyContent='center'
              alignItems='center'
              backgroundColor='rgba(0, 0, 0, 0.35)'
              padding='$4'
            >
              <YStack
                width='100%'
                maxWidth={360}
                padding='$4'
                backgroundColor='$background'
                borderRadius='$6'
                space='$4'
              >
                <Text fontSize='$5' fontWeight='700' textAlign='center'>
                  Receive Funds
                </Text>

                <YStack alignItems='center' space='$3'>
                  <Text fontSize='$3' color='$gray10' textAlign='center'>
                    Share this address to receive funds.
                  </Text>

                  {walletInfo?.publicKey ? (
                    <YStack alignItems='center' space='$3'>
                      <QRCode value={walletShareUrl} size={180} />
                      <Text
                        fontSize='$2'
                        color='$gray11'
                        textAlign='center'
                        selectable
                      >
                        {walletAddress}
                      </Text>
                      <Text
                        fontSize='$1'
                        color='$gray10'
                        textAlign='center'
                        selectable
                      >
                        {walletShareUrl}
                      </Text>
                      <Button
                        size='$3'
                        borderRadius='$2'
                        backgroundColor={addressCopied ? "#22C55E" : "#1C252E"}
                        onPress={handleCopyAddress}
                        disabled={isCopyingAddress}
                        icon={
                          addressCopied ? (
                            <Check size={16} color='#FFFFFF' />
                          ) : undefined
                        }
                        minWidth={150}
                      >
                        <Text color='white' fontWeight='600'>
                          {addressCopied ? "Copied" : "Copy Address"}
                        </Text>
                      </Button>
                    </YStack>
                  ) : (
                    <Text fontSize='$3' color='$gray11' textAlign='center'>
                      Wallet address not available.
                    </Text>
                  )}
                </YStack>

                <Button
                  onPress={handleCloseReceiveModal}
                  borderRadius='$2'
                  backgroundColor='#FFFFFF'
                  borderWidth={0.5}
                  borderColor='#1C252E'
                  padding='$3'
                >
                  <Text color='#1C252E' fontWeight='600'>
                    Close
                  </Text>
                </Button>
              </YStack>
            </YStack>
          </Modal>
        </>
      )}
    </YStack>
  );
}

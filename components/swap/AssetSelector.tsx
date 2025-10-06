import React from "react";
import { FlatList, ScrollView } from "react-native";
import { XStack, YStack, Text, Button, Sheet, Circle, Input } from "tamagui";
import { ChevronDown, Search } from "lucide-react-native";
import { DisplayAsset } from "@/lib/types/balance.types";
import { TokenInfo } from "@/lib/types/swap.types";
import { AssetIcon } from "@/components/ui/AssetIcon";

interface AssetSelectorProps {
  selectedAsset: DisplayAsset | TokenInfo | null;
  availableAssets: (DisplayAsset | TokenInfo)[];
  onAssetSelect: (asset: DisplayAsset | TokenInfo) => void;
  placeholder: string;
  showBalance?: boolean;
  userTokens?: (DisplayAsset | TokenInfo)[];
  featuredTokens?: (DisplayAsset | TokenInfo)[];
}

export const AssetSelector: React.FC<AssetSelectorProps> = ({
  selectedAsset,
  availableAssets,
  onAssetSelect,
  placeholder,
  showBalance = false,
  userTokens = [],
  featuredTokens = []
}) => {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Filter assets based on search query
  const filteredAssets = React.useMemo(() => {
    if (!searchQuery.trim()) return availableAssets;
    return availableAssets.filter((asset) => {
      const symbol = "asset_code" in asset ? asset.asset_code : asset.symbol;
      const name = "display_name" in asset ? asset.display_name : asset.name;
      const query = searchQuery.toLowerCase();
      return (
        symbol.toLowerCase().includes(query) ||
        name.toLowerCase().includes(query)
      );
    });
  }, [availableAssets, searchQuery]);

  // Separate user tokens from filtered results
  const filteredUserTokens = React.useMemo(() => {
    if (!searchQuery.trim()) return userTokens;
    return userTokens.filter((asset) => {
      const symbol = "asset_code" in asset ? asset.asset_code : asset.symbol;
      const name = "display_name" in asset ? asset.display_name : asset.name;
      const query = searchQuery.toLowerCase();
      return (
        symbol.toLowerCase().includes(query) ||
        name.toLowerCase().includes(query)
      );
    });
  }, [userTokens, searchQuery]);

  // Get other tokens (not user tokens)
  const otherTokens = React.useMemo(() => {
    const userTokenSymbols = new Set(
      userTokens.map((token) =>
        "asset_code" in token ? token.asset_code : token.symbol
      )
    );
    return filteredAssets.filter((asset) => {
      const symbol = "asset_code" in asset ? asset.asset_code : asset.symbol;
      return !userTokenSymbols.has(symbol);
    });
  }, [filteredAssets, userTokens]);

  const renderFeaturedToken = (item: DisplayAsset | TokenInfo) => {
    const symbol = "asset_code" in item ? item.asset_code : item.symbol;

    return (
      <Button
        key={symbol}
        onPress={() => {
          onAssetSelect(item);
          setOpen(false);
        }}
        backgroundColor='$gray2'
        borderColor='$borderColor'
        borderWidth={1}
        borderRadius='$4'
        padding='$3'
        flex={1}
        maxWidth='22%'
        aspectRatio={1}
      >
        <YStack alignItems='center' justifyContent='center' space='$2'>
          <AssetIcon symbol={symbol} size={32} fontSize='$3' />
          <Text fontSize='$2' fontWeight='600' textAlign='center'>
            {symbol}
          </Text>
        </YStack>
      </Button>
    );
  };

  const renderAssetItem = ({ item }: { item: DisplayAsset | TokenInfo }) => {
    const symbol = "asset_code" in item ? item.asset_code : item.symbol;
    const name = "display_name" in item ? item.display_name : item.name;
    const balance = "balance" in item ? item.balance : undefined;
    const logoUrl = "logo_url" in item ? item.logo_url : item.logoUrl;

    // Mock USD values for demo - in real app this would come from props or API
    const mockUsdValues: Record<string, { price: string }> = {
      XLM: { price: "$4,060.41" },
      nBTC: { price: "$4.9" },
      nETH: { price: "$7.11" },
      nSOL: { price: "$8.57" }
    };

    const usdData = mockUsdValues[symbol];

    return (
      <Button
        key={`${symbol}-${Math.random()}`}
        onPress={() => {
          onAssetSelect(item);
          setOpen(false);
        }}
        marginVertical='$3'
        padding='$3 $2'
        unstyled
      >
        <XStack alignItems='center' justifyContent='space-between' width='100%'>
          <XStack alignItems='center' space='$3' flex={1}>
            <AssetIcon symbol={symbol} size={40} fontSize='$4' />
            <YStack alignItems='flex-start' flex={1}>
              <Text fontSize='$4' fontWeight='600' color='$textPrimary'>
                {name}
              </Text>
              <Text fontSize='$3' color='$gray11'>
                {symbol}
              </Text>
            </YStack>
          </XStack>
          <YStack alignItems='flex-end'>
            {usdData && (
              <>
                {/* <Text fontSize='$4' fontWeight='600' color='$textPrimary'>
                  {usdData.price}
                </Text> */}
                <Text fontSize='$1' color='$gray11'>
                  {parseFloat(balance).toFixed(4)}
                </Text>
              </>
            )}
            {balance && showBalance && !usdData && (
              <Text fontSize='$3' color='$gray11'>
                {parseFloat(balance).toFixed(4)}
              </Text>
            )}
          </YStack>
        </XStack>
      </Button>
    );
  };

  return (
    <>
      <Button
        onPress={() => setOpen(true)}
        backgroundColor='$sectionBackground'
        borderColor='$borderColor'
        borderWidth={1}
        borderRadius='$input'
        padding='$1'
        minWidth={120}
      >
        <XStack
          alignItems='center'
          space='$2'
          justifyContent='space-between'
          height='100%'
        >
          {selectedAsset ? (
            <>
              <AssetIcon
                symbol={
                  "asset_code" in selectedAsset
                    ? selectedAsset.asset_code
                    : selectedAsset.symbol
                }
                size={24}
                fontSize='$2'
              />
              <Text fontSize='$4' fontWeight='600' color='$textPrimary'>
                {"asset_code" in selectedAsset
                  ? selectedAsset.asset_code
                  : selectedAsset.symbol}
              </Text>
            </>
          ) : (
            <Text fontSize='$4' color='$textTertiary'>
              {placeholder}
            </Text>
          )}
          <ChevronDown size={24} color='#1C252E' />
        </XStack>
      </Button>

      <Sheet
        modal
        open={open}
        onOpenChange={setOpen}
        snapPoints={[85]}
        dismissOnSnapToBottom
      >
        <Sheet.Overlay />
        <Sheet.Handle />
        <Sheet.Frame padding='$4'>
          <ScrollView showsVerticalScrollIndicator={false}>
            <YStack space='$4'>
              <Text fontSize='$6' fontWeight='600'>
                {placeholder}
              </Text>

              {/* Search Input */}
              <XStack
                alignItems='center'
                backgroundColor='$gray2'
                borderWidth={1}
                borderRadius='$4'
                borderColor='$borderColor'
                paddingHorizontal='$3'
                paddingVertical='$2'
                space='$2'
              >
                <Search size={20} color='#737381' />
                <Input
                  placeholder='Search tokens'
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  backgroundColor='transparent'
                  borderWidth={0}
                  flex={1}
                  fontSize='$4'
                />
              </XStack>

              {/* Featured Tokens Grid - only show if no search query */}
              {!searchQuery && featuredTokens.length > 0 && (
                <YStack space='$3'>
                  <XStack
                    flexWrap='wrap'
                    justifyContent='space-between'
                    gap='$2'
                  >
                    {featuredTokens.slice(0, 4).map(renderFeaturedToken)}
                  </XStack>
                </YStack>
              )}

              {/* Your Tokens Section */}
              {filteredUserTokens.length > 0 && (
                <YStack space='$3'>
                  <XStack alignItems='center' space='$2'>
                    <Text fontSize='$2' fontWeight='400' color='$gray11'>
                      📊
                    </Text>
                    <Text fontSize='$4' fontWeight='600' color='$textPrimary'>
                      Your tokens
                    </Text>
                  </XStack>
                  <YStack>
                    {filteredUserTokens.map((item, index) => (
                      <React.Fragment
                        key={`user-${
                          "asset_code" in item ? item.asset_code : item.symbol
                        }`}
                      >
                        {renderAssetItem({ item })}
                      </React.Fragment>
                    ))}
                  </YStack>
                </YStack>
              )}

              {/* Other Tokens Section */}
              {otherTokens.length > 0 && (
                <YStack space='$3'>
                  <YStack>
                    {otherTokens.map((item, index) => (
                      <React.Fragment
                        key={`other-${
                          "asset_code" in item ? item.asset_code : item.symbol
                        }`}
                      >
                        {renderAssetItem({ item })}
                      </React.Fragment>
                    ))}
                  </YStack>
                </YStack>
              )}

              {/* No Results */}
              {searchQuery && filteredAssets.length === 0 && (
                <YStack alignItems='center' padding='$6'>
                  <Text fontSize='$4' color='$gray11' textAlign='center'>
                    No tokens found for "{searchQuery}"
                  </Text>
                </YStack>
              )}
            </YStack>
          </ScrollView>
        </Sheet.Frame>
      </Sheet>
    </>
  );
};

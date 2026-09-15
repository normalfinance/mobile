// Assets tab — every asset the app supports (BTC, ETH, SOL, XLM, USDC), held
// or not, sorted by USD value, each opening its detail page. An asset whose
// chain the wallet has no address for yet shows "Set up" — the detail page
// adds it with one passkey (lazy accounts, CLAUDE.md §5). Activity stays on
// Home's Activity tab; this is the catalogue.

import React from "react";
import { RefreshControl, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { XStack, YStack } from "tamagui";

import { AssetRowSkeleton } from "@/components/home/AssetRow";
import { Card, Chip, Mono, Pressable, Screen, ScreenTitle, UiText } from "@/components/home/primitives";
import { AssetIcon } from "@/components/ui/AssetIcon";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { CHAIN_META, useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { SEND_ASSETS, SEND_ORDER } from "@/lib/send/registry";
import { useColors } from "@/lib/theme/appearance";
import { space, tracking, typeScale as t } from "@/lib/theme/tokens";
import { fAssetQuantity, fCurrency, fCurrencyTwoDecimals, fPercent } from "@/lib/utils/number-format.utils";

export default function AssetsScreen() {
  const c = useColors();
  const router = useRouter();
  const { portfolioData, isLoading, refetch } = useBackendPortfolio();
  const { wallet } = useTurnkeyWallet();
  const [refreshing, setRefreshing] = React.useState(false);

  const rows = SEND_ORDER.map((symbol) => {
    const meta = SEND_ASSETS[symbol];
    const asset = portfolioData.assets.find((a) => a.asset_code === symbol);
    const hasAddress = !!asset?.address;
    return { symbol, meta, asset, hasAddress, usd: asset?.usdValue ?? 0 };
  }).sort((a, b) => b.usd - a.usd || SEND_ORDER.indexOf(a.symbol) - SEND_ORDER.indexOf(b.symbol));

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await refetch();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={c.muted}
          />
        }
      >
        <YStack paddingHorizontal={space.gutter} paddingTop={8} gap={12}>
          <ScreenTitle title='Assets' />
          <Card paddingVertical={4} paddingHorizontal={6}>
            {isLoading && !wallet ? (
              <>
                <AssetRowSkeleton />
                <AssetRowSkeleton />
                <AssetRowSkeleton />
              </>
            ) : (
              rows.map(({ symbol, meta, asset, hasAddress, usd }) => (
                <Pressable
                  key={symbol}
                  onPress={() => router.push(`/asset/${symbol.toLowerCase()}`)}
                  paddingVertical={space.rowY}
                  paddingHorizontal={8}
                  flexDirection='row'
                  alignItems='center'
                  justifyContent='space-between'
                  minHeight={space.touchTarget}
                >
                  <XStack alignItems='center' gap={space.rowGap} flexShrink={1}>
                    <AssetIcon symbol={symbol} size={36} fontSize='$3' />
                    <YStack flexShrink={1}>
                      <XStack alignItems='center' gap={6}>
                        <UiText fontSize={t.assetName.size} fontWeight='600' letterSpacing={tracking(t.assetName.size)} lineHeight={18}>
                          {symbol}
                        </UiText>
                        {!hasAddress ? <Chip tone='neutral' label='Set up' /> : null}
                      </XStack>
                      <UiText fontSize={t.assetSub.size} color={c.muted} marginTop={2}>
                        {meta.name} · {CHAIN_META[meta.chain].name}
                        {asset?.priceChange24h != null ? ` · ${asset.priceChange24h >= 0 ? "+" : ""}${fPercent(asset.priceChange24h, { maximumFractionDigits: 1 })}` : ""}
                      </UiText>
                    </YStack>
                  </XStack>
                  <YStack alignItems='flex-end'>
                    <Mono fontSize={t.assetUsd.size}>{hasAddress ? fCurrency(usd) : fCurrencyTwoDecimals(asset?.usdPrice ?? 0)}</Mono>
                    <Mono fontSize={t.assetQty.size} color={c.muted} marginTop={2}>
                      {hasAddress ? `${fAssetQuantity(Number(asset?.balance ?? 0), symbol)} ${symbol}` : "price"}
                    </Mono>
                  </YStack>
                </Pressable>
              ))
            )}
          </Card>
          <UiText fontSize={12} color={c.faint} textAlign='center' lineHeight={17}>
            Tap an asset to see its chart, receive, send — or set up its chain on your wallet.
          </UiText>
        </YStack>
      </ScrollView>
    </Screen>
  );
}

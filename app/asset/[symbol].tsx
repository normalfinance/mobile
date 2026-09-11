// Asset detail: price + 24h change, an ink line chart from prices/history,
// the user's balance, Receive / Send, and this asset's activity. Same
// primitives and tokens as the drawer; no CoinMarketCap, no oracle.

import React from "react";
import { Alert, Dimensions, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LineChart } from "react-native-gifted-charts";
import { XStack, YStack } from "tamagui";
import { ArrowDown, ArrowUp, ChevronLeft, Inbox } from "lucide-react-native";

import { ActivityRow } from "@/components/home/ActivityRow";
import {
  Card,
  Divider,
  EmptyState,
  IconButton,
  Mono,
  Screen,
  SecondaryButton,
  Skeleton,
  UiText
} from "@/components/home/primitives";
import { ReceiveSheet } from "@/components/home/ReceiveSheet";
import { AssetIcon } from "@/components/ui/AssetIcon";
import {
  PERIOD_TO_RANGE,
  useBackendPortfolio,
  usePriceHistory
} from "@/hooks/use-backend-portfolio";
import { useTurnkeyWallet, walletAddresses } from "@/hooks/use-turnkey-wallet";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import {
  fAssetQuantity,
  fCurrency,
  fCurrencyTwoDecimals,
  fPercent
} from "@/lib/utils/number-format.utils";
import type { PortfolioPeriod } from "@/services/portfolio.service";

const ASSET_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  XLM: "Stellar Lumens",
  USDC: "USD Coin"
};

const PERIODS: { key: PortfolioPeriod; label: string }[] = [
  { key: "1D", label: "1D" },
  { key: "7D", label: "1W" },
  { key: "30D", label: "1M" },
  { key: "365D", label: "1Y" },
  { key: "All", label: "All" }
];

export default function AssetDetailScreen() {
  const c = useColors();
  const router = useRouter();
  const { symbol: raw } = useLocalSearchParams<{ symbol?: string }>();
  const symbol = (raw ?? "").toUpperCase();

  const { portfolioData, transactions, isLoading } = useBackendPortfolio();
  const { wallet } = useTurnkeyWallet();
  const addresses = React.useMemo(() => walletAddresses(wallet), [wallet]);
  const [period, setPeriod] = React.useState<PortfolioPeriod>("7D");
  const [receiveOpen, setReceiveOpen] = React.useState(false);

  const history = usePriceHistory(symbol || undefined, PERIOD_TO_RANGE[period]);
  const asset = portfolioData.assets.find((a) => a.asset_code === symbol);

  const points = history.data?.prices ?? [];
  const lastHistoryPrice = points.length ? points[points.length - 1][1] : null;
  const firstHistoryPrice = points.length ? points[0][1] : null;
  const price = asset?.usdPrice || lastHistoryPrice || 0;
  const change24h = asset?.priceChange24h;
  const periodChange =
    firstHistoryPrice && lastHistoryPrice
      ? ((lastHistoryPrice - firstHistoryPrice) / firstHistoryPrice) * 100
      : null;

  const chartData = React.useMemo(
    () => points.map(([, value]) => ({ value })),
    [points]
  );
  const chartWidth = Dimensions.get("window").width - space.gutter * 2 - 2;

  const assetTxs = transactions.filter((tx) => tx.asset === symbol);
  const positiveChange = (change24h ?? periodChange ?? 0) >= 0;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        <YStack paddingHorizontal={space.gutter} paddingTop={56} gap={space.section}>
          {/* Header */}
          <XStack alignItems='center' gap={8}>
            <IconButton onPress={() => router.back()} label='Back'>
              <ChevronLeft size={22} color={c.ink} strokeWidth={2} />
            </IconButton>
            <AssetIcon symbol={symbol} size={36} fontSize='$3' />
            <YStack>
              <UiText fontSize={15} fontWeight='600'>
                {ASSET_NAMES[symbol] ?? symbol}
              </UiText>
              <UiText fontSize={12} color={c.muted}>
                {symbol}
              </UiText>
            </YStack>
          </XStack>

          {/* Price + chart */}
          <Card paddingTop={16} paddingBottom={8}>
            <YStack paddingHorizontal={space.rowX} gap={4}>
              {history.isLoading && !asset ? (
                <Skeleton width={140} height={30} />
              ) : (
                <Mono fontSize={28} letterSpacing={tracking(28)}>
                  {fCurrencyTwoDecimals(price)}
                </Mono>
              )}
              <XStack alignItems='center' gap={6}>
                <Mono fontSize={13} color={positiveChange ? c.positive : c.ink}>
                  {change24h !== undefined && change24h !== null
                    ? `${change24h >= 0 ? "+" : ""}${fPercent(change24h, { maximumFractionDigits: 2 })}`
                    : periodChange !== null
                      ? `${periodChange >= 0 ? "+" : ""}${fPercent(periodChange, { maximumFractionDigits: 2 })}`
                      : "—"}
                </Mono>
                <UiText fontSize={12} color={c.muted}>
                  {change24h !== undefined && change24h !== null ? "24h" : PERIODS.find((p) => p.key === period)?.label}
                </UiText>
              </XStack>
            </YStack>

            <YStack height={180} marginTop={12} justifyContent='center'>
              {history.isLoading ? (
                <YStack paddingHorizontal={space.rowX}>
                  <Skeleton width='100%' height={140} />
                </YStack>
              ) : chartData.length > 1 ? (
                <LineChart
                  data={chartData}
                  width={chartWidth}
                  height={160}
                  color={c.ink}
                  thickness={2}
                  curved
                  hideDataPoints
                  hideAxesAndRules
                  areaChart
                  startFillColor={c.ink}
                  startOpacity={0.08}
                  endFillColor={c.surface}
                  endOpacity={0}
                  initialSpacing={0}
                  endSpacing={0}
                  spacing={chartWidth / Math.max(1, chartData.length - 1)}
                  disableScroll
                  adjustToWidth
                />
              ) : (
                <UiText fontSize={13} color={c.muted} textAlign='center'>
                  No price history{history.error ? `: ${history.error.message}` : ""}
                </UiText>
              )}
            </YStack>

            {/* Period pills: 12/600 */}
            <XStack gap={6} paddingHorizontal={space.rowX} paddingTop={8} justifyContent='center'>
              {PERIODS.map(({ key, label }) => {
                const selected = period === key;
                return (
                  <XStack
                    key={key}
                    onPress={() => setPeriod(key)}
                    paddingHorizontal={12}
                    height={28}
                    borderRadius={radius.pill}
                    alignItems='center'
                    backgroundColor={selected ? c.ink : "transparent"}
                    pressStyle={{ backgroundColor: selected ? c.ctaPressed : c.pressTint }}
                  >
                    <UiText fontSize={12} fontWeight='600' color={selected ? c.ctaText : c.muted}>
                      {label}
                    </UiText>
                  </XStack>
                );
              })}
            </XStack>
          </Card>

          {/* Balance */}
          <Card paddingTop={4} paddingHorizontal={4} paddingBottom={12}>
            <XStack
              paddingHorizontal={space.rowX}
              paddingTop={14}
              paddingBottom={space.rowY}
              justifyContent='space-between'
              alignItems='center'
            >
              <UiText fontSize={14} fontWeight='500' color={c.ink2}>
                Your balance
              </UiText>
              {isLoading ? (
                <Skeleton width={90} height={24} />
              ) : (
                <Mono fontSize={22} letterSpacing={tracking(22)}>
                  {fCurrency(asset?.usdValue ?? 0)}
                </Mono>
              )}
            </XStack>
            <Divider />
            <XStack
              paddingHorizontal={space.rowX}
              paddingVertical={space.rowY}
              justifyContent='space-between'
              alignItems='center'
            >
              <UiText fontSize={13.5} color={c.muted}>
                Amount
              </UiText>
              <Mono fontSize={15}>
                {fAssetQuantity(asset?.balance ?? 0, symbol)} {symbol}
              </Mono>
            </XStack>
            <XStack gap={8} marginTop={8} marginHorizontal={8}>
              <YStack flex={1}>
                <SecondaryButton
                  label='Receive'
                  icon={<ArrowDown size={16} color={c.ink} strokeWidth={2} />}
                  onPress={() => setReceiveOpen(true)}
                />
              </YStack>
              <YStack flex={1}>
                <SecondaryButton
                  label='Send'
                  icon={<ArrowUp size={16} color={c.ink} strokeWidth={2} />}
                  onPress={() => Alert.alert("Coming soon", "Send arrives with the Normal wallet.")}
                />
              </YStack>
            </XStack>
          </Card>

          {/* Activity for this asset */}
          <YStack gap={8}>
            <UiText fontSize={14} fontWeight='500' color={c.ink2}>
              Activity
            </UiText>
            {assetTxs.length === 0 ? (
              <EmptyState
                icon={<Inbox size={24} color={c.ink} strokeWidth={1.8} />}
                title={`No ${symbol} activity yet`}
              />
            ) : (
              assetTxs.map((tx) => <ActivityRow key={tx.id} tx={tx} />)
            )}
          </YStack>
        </YStack>
      </ScrollView>

      <ReceiveSheet
        open={receiveOpen}
        addresses={addresses}
        initialChain={asset?.chain}
        onClose={() => setReceiveOpen(false)}
      />
    </Screen>
  );
}

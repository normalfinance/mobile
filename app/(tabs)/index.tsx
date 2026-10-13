// Home = the content of the web account drawer (D12): header, balance card
// with action tiles, Tokens / Activity tabs, rows. No chart, no search — the
// drawer has neither. Data comes from the backend (useBackendPortfolio) and
// the wallet from GET /api/turnkey/wallet (useTurnkeyWallet).

import React from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { XStack, YStack } from "tamagui";
import { Inbox, Settings, Wallet } from "lucide-react-native";

import { ActivityRow, ActivityRowSkeleton } from "@/components/home/ActivityRow";
import { AssetRow, AssetRowSkeleton } from "@/components/home/AssetRow";
import { BalanceCard, type HomeAction } from "@/components/home/BalanceCard";
import { toTxParams } from "@/lib/activity/tx-params";
import { SavingsRow } from "@/components/home/SavingsRow";
import { UsdcSetupRow } from "@/components/home/UsdcSetupRow";
import { useSavingsPosition, useStellarAccountProbe, useVaultInfo } from "@/hooks/use-savings";
import { deriveSetupStep } from "@/lib/savings/engine";
import { offerUsdcSetup, type ReceiveAssetChoice } from "@/lib/stellar/usdc-setup";
import { BackupCard } from "@/components/home/BackupCard";
import { DeviceSetupCard } from "@/components/home/DeviceSetupCard";
import { signingAddressOf } from "@/lib/turnkey/device-check";
import { useDeviceReady } from "@/lib/turnkey/device-ready";
import { HomeTabs, type HomeTab } from "@/components/home/HomeTabs";
import {
  EmptyState,
  IconButton,
  PillButton,
  Screen,
  UiText
} from "@/components/home/primitives";
import { ReceiveSheet } from "@/components/home/ReceiveSheet";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { useTurnkeyWallet, walletAddresses, type WalletChain } from "@/hooks/use-turnkey-wallet";
import { useColors } from "@/lib/theme/appearance";
import { space, radius } from "@/lib/theme/tokens";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

export default function HomeScreen() {
  const router = useRouter();
  const c = useColors();
  const { user } = useSupabaseAuth();
  const { wallet } = useTurnkeyWallet();
  const addresses = React.useMemo(() => walletAddresses(wallet), [wallet]);
  const { ready: deviceReady } = useDeviceReady(wallet?.subOrgId);
  const { portfolioData, transactions, isLoading, hasError, errorMessage, refetch, refetchTransactions } =
    useBackendPortfolio();
  // Savings composes into the portfolio exactly like the web drawer
  // (hooks/use-portfolio.ts): total = wallet assets + savings currentValue
  // ($1-pegged); "Assets" never includes the vault USDC; sources stay
  // independent (fast wallet read never waits on the slow savings read).
  const savings = useSavingsPosition(wallet?.stellarAddress);
  const vault = useVaultInfo();
  const savingsUsd = savings.position ? savings.value : null; // null = still loading, show "—"

  const [tab, setTab] = React.useState<HomeTab>("tokens");
  // Web activity tabs: All / Swaps / Savings / Transfers.
  const [filter, setFilter] = React.useState<"all" | "swaps" | "savings" | "transfers">("all");
  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "swaps", label: "Swaps" },
    { key: "savings", label: "Savings" },
    { key: "transfers", label: "Transfers" }
  ];
  // Web portfolio tabs All / Crypto / DeFi: DeFi = the Normal Savings position.
  const [tokenFilter, setTokenFilter] = React.useState<"all" | "crypto" | "defi">("all");
  const TOKEN_FILTERS: { key: typeof tokenFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "crypto", label: "Crypto" },
    { key: "defi", label: "DeFi" }
  ];
  const showAssets = tokenFilter !== "defi";
  const showSavings = tokenFilter !== "crypto" && savings.value > 0;
  const visibleTransactions = transactions.filter((tx) =>
    filter === "all" ? true : filter === "swaps" ? tx.type === "swap" : filter === "savings" ? tx.type === "savings_deposit" || tx.type === "savings_withdraw" : ["send", "receive", "buy", "sell"].includes(tx.type)
  );
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [receiveChain, setReceiveChain] = React.useState<WalletChain | undefined>(undefined);
  const [receiveAsset, setReceiveAsset] = React.useState<string | undefined>(undefined);
  const openReceive = React.useCallback((asset?: ReceiveAssetChoice | string, chain?: WalletChain) => {
    setReceiveAsset(asset || undefined);
    setReceiveChain(chain ?? (asset === "XLM" || asset === "USDC" ? "stellar" : undefined));
    setReceiveOpen(true);
  }, []);
  // Hand-offs from /backup (Get started) and WalletEvents arrive as params —
  // receive=<chain>&asset=…, usdcOffer=1 to continue to USDC once the sheet
  // closes. Consumed once, then cleared so a re-render cannot replay them.
  const params = useLocalSearchParams<{ receive?: string; asset?: string; usdcOffer?: string }>();
  const pendingUsdcOffer = React.useRef(false);
  React.useEffect(() => {
    if (!params.receive) return;
    pendingUsdcOffer.current = params.usdcOffer === "1";
    openReceive(params.asset, params.receive as WalletChain);
    router.setParams({ receive: "", asset: "", usdcOffer: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.receive, params.asset, params.usdcOffer]);
  // USDC on Stellar exists only once the trustline does: one Horizon read per
  // Home visit (no interval; after-action and sightings invalidate it).
  const probe = useStellarAccountProbe(wallet?.stellarAddress, false);
  const stellarStep = deriveSetupStep(probe.data ?? null);
  const usdcAsset = portfolioData.assets.find((a) => a.asset_code === "USDC");
  const usdcReady = stellarStep === "ready" || probe.isError || Number(usdcAsset?.balance ?? 0) > 0;
  const buyXlm = React.useCallback(() => router.push({ pathname: "/buy", params: { asset: "XLM" } }), [router]);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      // Pull-to-refresh = every source on this screen, in parallel.
      await Promise.all([refetch(), refetchTransactions(), savings.refetch()]);
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch, refetchTransactions]);

  const handleAction = React.useCallback(
    (action: HomeAction) => {
      if (action === "receive") {
        openReceive();
      } else if (action === "send") {
        router.push("/send");
      } else if (action === "swap") {
        router.push("/(tabs)/swap");
      } else if (action === "sell") {
        router.push("/sell");
      } else {
        router.push("/buy");
      }
    },
    [router, openReceive]
  );

  // Every asset whose chain the wallet has an address for — including $0.00
  // rows, so a freshly created Stellar wallet shows XLM and USDC at zero
  // instead of "Nothing here yet" (Niko 2026-10-13). Chains that are not set
  // up stay hidden (the aggregator always emits five rows); the empty state
  // is only for an account with no addresses at all.
  // USDC hides until the Stellar account carries the trustline (a $0 USDC row
  // before that implies the wallet can receive USDC — it cannot); the
  // UsdcSetupRow below takes its place (Niko 2026-10-13).
  const heldAssets = portfolioData.assets
    .filter((a) => !!a.address && (a.asset_code !== "USDC" || usdcReady))
    .sort((a, b) => b.usdValue - a.usdValue || a.asset_code.localeCompare(b.asset_code)); // by USD value, then name
  const email = user?.email ?? "";
  const displayName = email ? email.split("@")[0] : "Your wallet";

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.muted} />
        }
      >
        <YStack paddingHorizontal={space.gutter} paddingTop={8} gap={space.section}>
          {/* Header: mark · name / email · settings (account-drawer header) */}
          <XStack alignItems='center' justifyContent='space-between'>
            <XStack alignItems='center' gap={12}>
              <YStack
                width={44}
                height={44}
                borderRadius={22}
                overflow='hidden'
                backgroundColor={c.iconBg}
              >
                <Image
                  source={require("@/assets/images/logo-single.png")}
                  style={{ width: 44, height: 44 }}
                  contentFit='cover'
                  cachePolicy='memory-disk'
                />
              </YStack>
              <YStack>
                <UiText fontSize={15} fontWeight='600'>
                  {displayName}
                </UiText>
                {email ? (
                  <UiText fontSize={13} color={c.muted}>
                    {email}
                  </UiText>
                ) : null}
              </YStack>
            </XStack>
            <IconButton onPress={() => router.push("/(tabs)/settings")} label='Settings'>
              <Settings size={20} color={c.muted} strokeWidth={1.8} />
            </IconButton>
          </XStack>

          {hasError ? (
            <EmptyState
              icon={<Wallet size={24} color={c.ink} strokeWidth={1.8} />}
              title='Couldn’t load your balances — nothing is lost.'
              body={errorMessage ?? "Please check your connection and try again."}
              action={<PillButton label='Try again' onPress={() => void refetch()} />}
            />
          ) : (
            <>
              {deviceReady === false && wallet?.subOrgId && signingAddressOf(wallet) ? (
                <DeviceSetupCard subOrgId={wallet.subOrgId} address={signingAddressOf(wallet)!} />
              ) : null}
              {wallet?.subOrgId ? <BackupCard subOrgId={wallet.subOrgId} /> : null}
              <BalanceCard
                totalUsd={portfolioData.totalValue + (savingsUsd ?? 0)}
                assetsUsd={portfolioData.totalValue}
                savingsUsd={savingsUsd}
                isLoading={isLoading}
                onAction={handleAction}
                onSavingsPress={() => router.push("/(tabs)/savings")}
              />

              <YStack>
                <HomeTabs value={tab} onChange={setTab} />

                <YStack paddingTop={4}>
                  {tab === "tokens" ? (
                    isLoading ? (
                      <>
                        <AssetRowSkeleton />
                        <AssetRowSkeleton />
                        <AssetRowSkeleton />
                      </>
                    ) : heldAssets.length === 0 ? (
                      <YStack paddingTop={12}>
                        <EmptyState
                          icon={<Wallet size={24} color={c.ink} strokeWidth={1.8} />}
                          title='Nothing here yet'
                          body='Buy with a card or receive crypto from another wallet to get started.'
                          action={
                            <XStack gap={8}>
                              <PillButton label='Buy' onPress={() => router.push("/buy")} />
                              <PillButton label='Receive' onPress={() => openReceive()} />
                            </XStack>
                          }
                        />
                      </YStack>
                    ) : (
                      <>
                        <XStack gap={6} paddingHorizontal={8} paddingTop={10} paddingBottom={4}>
                          {TOKEN_FILTERS.map(({ key, label }) => {
                            const selected = tokenFilter === key;
                            return (
                              <XStack
                                key={key}
                                onPress={() => setTokenFilter(key)}
                                paddingHorizontal={12}
                                height={28}
                                borderRadius={radius.pill}
                                alignItems='center'
                                backgroundColor={selected ? c.ink : c.iconBg}
                                pressStyle={{ backgroundColor: selected ? c.ctaPressed : c.pressTint }}
                                accessibilityRole='button'
                                accessibilityState={{ selected }}
                              >
                                <UiText fontSize={12} fontWeight='600' color={selected ? c.ctaText : c.muted}>{label}</UiText>
                              </XStack>
                            );
                          })}
                        </XStack>
                        {showAssets
                          ? heldAssets
                              .filter((a) => a.usdValue >= savings.value || savings.value <= 0)
                              .map((asset) => (
                                <AssetRow key={asset.asset_code} asset={asset} onPress={() => router.push(`/asset/${asset.asset_code.toLowerCase()}`)} />
                              ))
                          : null}
                        {showAssets && wallet?.stellarAddress && !usdcReady && stellarStep ? (
                          <UsdcSetupRow step={stellarStep} onPress={() => openReceive("USDC")} />
                        ) : null}
                        {showSavings ? (
                          <SavingsRow value={savings.value} apy={vault.data?.apy ?? null} onPress={() => router.push("/(tabs)/savings")} />
                        ) : null}
                        {showAssets && savings.value > 0
                          ? heldAssets
                              .filter((a) => a.usdValue < savings.value)
                              .map((asset) => (
                                <AssetRow key={asset.asset_code} asset={asset} onPress={() => router.push(`/asset/${asset.asset_code.toLowerCase()}`)} />
                              ))
                          : null}
                        {tokenFilter === "defi" && savings.value <= 0 ? (
                          <YStack alignItems='center' gap={10} paddingVertical={20}>
                            <UiText fontSize={13} color={c.muted} textAlign='center'>No savings yet — USDC in Normal Savings earns every day.</UiText>
                            <PillButton label='Start saving' onPress={() => router.push("/(tabs)/savings")} />
                          </YStack>
                        ) : null}
                      </>
                    )
                  ) : isLoading ? (
                    <>
                      <ActivityRowSkeleton />
                      <ActivityRowSkeleton />
                    </>
                  ) : transactions.length === 0 ? (
                    <YStack paddingTop={12}>
                      <EmptyState
                        icon={<Inbox size={24} color={c.ink} strokeWidth={1.8} />}
                        title='No activity yet'
                        body='Your transactions will show up here.'
                      />
                    </YStack>
                  ) : (
                    <>
                      <XStack gap={6} paddingHorizontal={8} paddingTop={10} paddingBottom={4}>
                        {FILTERS.map(({ key, label }) => {
                          const selected = filter === key;
                          return (
                            <XStack
                              key={key}
                              onPress={() => setFilter(key)}
                              paddingHorizontal={12}
                              height={28}
                              borderRadius={radius.pill}
                              alignItems='center'
                              backgroundColor={selected ? c.ink : c.iconBg}
                              pressStyle={{ backgroundColor: selected ? c.ctaPressed : c.pressTint }}
                              accessibilityRole='button'
                              accessibilityState={{ selected }}
                            >
                              <UiText fontSize={12} fontWeight='600' color={selected ? c.ctaText : c.muted}>{label}</UiText>
                            </XStack>
                          );
                        })}
                      </XStack>
                      {visibleTransactions.length === 0 ? (
                        <UiText fontSize={13} color={c.muted} textAlign='center' paddingVertical={20}>Nothing in this category yet.</UiText>
                      ) : (
                        visibleTransactions.map((tx) => <ActivityRow key={tx.id} tx={tx} onPress={() => router.push({ pathname: "/tx", params: toTxParams(tx) })} />)
                      )}
                    </>
                  )}
                </YStack>
              </YStack>
            </>
          )}
        </YStack>
      </ScrollView>

      <ReceiveSheet
        open={receiveOpen}
        addresses={addresses}
        initialChain={receiveChain}
        asset={receiveAsset}
        onClose={() => {
          setReceiveOpen(false);
          void probe.refetch();
          if (pendingUsdcOffer.current && wallet?.stellarAddress) {
            pendingUsdcOffer.current = false;
            const address = wallet.stellarAddress;
            // Let the sheet finish dismissing; an alert during the transition is dropped by iOS.
            setTimeout(() => void offerUsdcSetup({ address, openReceive: (a) => openReceive(a), buyXlm }), 500);
          }
        }}
      />
    </Screen>
  );
}

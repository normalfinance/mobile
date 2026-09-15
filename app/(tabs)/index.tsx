// Home = the content of the web account drawer (D12): header, balance card
// with action tiles, Tokens / Activity tabs, rows. No chart, no search — the
// drawer has neither. Data comes from the backend (useBackendPortfolio) and
// the wallet from GET /api/turnkey/wallet (useTurnkeyWallet).

import React from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { XStack, YStack } from "tamagui";
import { Inbox, Settings, Wallet } from "lucide-react-native";

import { ActivityRow, ActivityRowSkeleton } from "@/components/home/ActivityRow";
import { AssetRow, AssetRowSkeleton } from "@/components/home/AssetRow";
import { BalanceCard, type HomeAction } from "@/components/home/BalanceCard";
import { SavingsRow } from "@/components/home/SavingsRow";
import { useSavingsPosition, useVaultInfo } from "@/hooks/use-savings";
import { DeviceSetupCard } from "@/components/home/DeviceSetupCard";
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
import { useTurnkeyWallet, walletAddresses } from "@/hooks/use-turnkey-wallet";
import { useColors } from "@/lib/theme/appearance";
import { space } from "@/lib/theme/tokens";
import { BRAND_ASSETS } from "@/lib/utils/cdn.utils";
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
  const [receiveOpen, setReceiveOpen] = React.useState(false);
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
        setReceiveOpen(true);
      } else if (action === "send") {
        router.push("/send");
      } else if (action === "swap") {
        router.push("/(tabs)/swap");
      } else {
        router.push("/buy");
      }
    },
    [router]
  );

  // Like the web drawer (account-drawer.tsx allTokens): only assets actually
  // held. The aggregator always emits five rows; without this a new user sees
  // five phantom "$0.00" lines instead of the empty state.
  const heldAssets = portfolioData.assets
    .filter((a) => !!a.address && Number(a.balance) > 0)
    .sort((a, b) => b.usdValue - a.usdValue); // web tokens-tab: by USD value, largest first
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
                  source={{ uri: BRAND_ASSETS.logoSinglePng() }}
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
              title='Couldn’t load your portfolio'
              body={errorMessage ?? "Please check your connection and try again."}
              action={<PillButton label='Try again' onPress={() => void refetch()} />}
            />
          ) : (
            <>
              {deviceReady === false && wallet?.subOrgId && wallet.stellarAddress ? (
                <DeviceSetupCard subOrgId={wallet.subOrgId} stellarAddress={wallet.stellarAddress} />
              ) : null}
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
                              <PillButton label='Receive' onPress={() => setReceiveOpen(true)} />
                            </XStack>
                          }
                        />
                      </YStack>
                    ) : (
                      <>
                        {heldAssets
                          .filter((a) => a.usdValue >= savings.value || savings.value <= 0)
                          .map((asset) => (
                            <AssetRow key={asset.asset_code} asset={asset} onPress={() => router.push(`/asset/${asset.asset_code.toLowerCase()}`)} />
                          ))}
                        {savings.value > 0 ? (
                          <SavingsRow value={savings.value} apy={vault.data?.apy ?? null} onPress={() => router.push("/(tabs)/savings")} />
                        ) : null}
                        {savings.value > 0
                          ? heldAssets
                              .filter((a) => a.usdValue < savings.value)
                              .map((asset) => (
                                <AssetRow key={asset.asset_code} asset={asset} onPress={() => router.push(`/asset/${asset.asset_code.toLowerCase()}`)} />
                              ))
                          : null}
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
                    transactions.map((tx) => <ActivityRow key={tx.id} tx={tx} />)
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
        onClose={() => setReceiveOpen(false)}
      />
    </Screen>
  );
}

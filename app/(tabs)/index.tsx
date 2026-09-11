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
import { HomeTabs, type HomeTab } from "@/components/home/HomeTabs";
import { EmptyState, PillButton, UiText } from "@/components/home/primitives";
import { ReceiveSheet } from "@/components/home/ReceiveSheet";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { ink, radius, space } from "@/lib/theme/tokens";
import { BRAND_ASSETS } from "@/lib/utils/cdn.utils";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useSupabaseAuth();
  const { stellarAddress } = useTurnkeyWallet();
  const {
    portfolioData,
    transactions,
    isLoading,
    hasError,
    errorMessage,
    refetch
  } = useBackendPortfolio();

  const [tab, setTab] = React.useState<HomeTab>("tokens");
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleAction = React.useCallback((action: HomeAction) => {
    if (action === "receive") {
      setReceiveOpen(true);
      return;
    }
    // Send / Swap / Buy arrive with the Turnkey wallet (Stage C).
    Alert.alert("Coming soon", "Send, swap and buy arrive with the Normal wallet.");
  }, []);

  const heldAssets = portfolioData.assets.filter((a) => Number(a.balance) > 0);
  const email = user?.email ?? "";
  const displayName = email ? email.split("@")[0] : "Your wallet";

  return (
    <YStack flex={1} backgroundColor={ink.surface}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
                backgroundColor={ink.iconBg}
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
                  <UiText fontSize={13} color={ink.muted}>
                    {email}
                  </UiText>
                ) : null}
              </YStack>
            </XStack>
            <YStack
              onPress={() => router.push("/(tabs)/settings")}
              width={44}
              height={44}
              borderRadius={radius.iconBox}
              alignItems='center'
              justifyContent='center'
              pressStyle={{ backgroundColor: ink.iconPressTint }}
            >
              <Settings size={20} color={ink.muted} strokeWidth={1.8} />
            </YStack>
          </XStack>

          {hasError ? (
            <EmptyState
              icon={<Wallet size={24} color={ink.ink} strokeWidth={1.8} />}
              title='Couldn’t load your portfolio'
              body={errorMessage ?? "Please check your connection and try again."}
              action={<PillButton label='Try again' onPress={() => void refetch()} />}
            />
          ) : (
            <>
              <BalanceCard
                totalUsd={portfolioData.totalValue}
                assetsUsd={portfolioData.totalValue}
                savingsUsd={null}
                isLoading={isLoading}
                onAction={handleAction}
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
                          icon={<Wallet size={24} color={ink.ink} strokeWidth={1.8} />}
                          title='No assets yet'
                          body='Receive XLM or USDC to get started.'
                          action={
                            <PillButton
                              label='Receive'
                              onPress={() => setReceiveOpen(true)}
                            />
                          }
                        />
                      </YStack>
                    ) : (
                      heldAssets.map((asset) => (
                        <AssetRow
                          key={asset.asset_code}
                          asset={asset}
                          onPress={() =>
                            router.push(`/asset/${asset.asset_code.toLowerCase()}`)
                          }
                        />
                      ))
                    )
                  ) : isLoading ? (
                    <>
                      <ActivityRowSkeleton />
                      <ActivityRowSkeleton />
                    </>
                  ) : transactions.length === 0 ? (
                    <YStack paddingTop={12}>
                      <EmptyState
                        icon={<Inbox size={24} color={ink.ink} strokeWidth={1.8} />}
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
        address={stellarAddress}
        onClose={() => setReceiveOpen(false)}
      />
    </YStack>
  );
}

// Activity tab — the drawer's Activity tab as a full screen. Source: the four
// public activity/{chain} routes merged newest-first (hooks/use-activity-feed).
// Savings and swap rows (wallet/activity) join once those flows exist.

import React from "react";
import { RefreshControl, ScrollView } from "react-native";
import { YStack } from "tamagui";
import { Inbox } from "lucide-react-native";

import { ActivityRow, ActivityRowSkeleton } from "@/components/home/ActivityRow";
import { EmptyState, Screen, ScreenTitle } from "@/components/home/primitives";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { useColors } from "@/lib/theme/appearance";
import { space } from "@/lib/theme/tokens";

export default function ActivityScreen() {
  const c = useColors();
  const { portfolioData } = useBackendPortfolio();
  const priceOf = React.useCallback(
    (symbol: string) => portfolioData.assets.find((a) => a.asset_code === symbol)?.usdPrice ?? 0,
    [portfolioData.assets]
  );
  const { transactions, isLoading, isFetching, refetch } = useActivityFeed(priceOf);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => void refetch()}
            tintColor={c.muted}
          />
        }
      >
        <YStack paddingHorizontal={space.gutter} paddingTop={8} gap={12}>
          <ScreenTitle title='Activity' />
          {isLoading ? (
            <>
              <ActivityRowSkeleton />
              <ActivityRowSkeleton />
              <ActivityRowSkeleton />
            </>
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={<Inbox size={24} color={c.ink} strokeWidth={1.8} />}
              title='No activity yet'
              body='Deposits, swaps and transfers will show up here.'
            />
          ) : (
            transactions.map((tx) => <ActivityRow key={tx.id} tx={tx} />)
          )}
        </YStack>
      </ScrollView>
    </Screen>
  );
}

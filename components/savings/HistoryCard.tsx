// Web sections/savings/savings-history-card.tsx: the Savings page's own
// Deposit / Withdraw list (web pages 10 at a time; here 10 then "Show more").
// Rows come from the same private GET /api/wallet/activity the Home feed
// reads, so both surfaces always agree; a tap opens the transaction detail
// with its explorer link.

import React from "react";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { XStack, YStack } from "tamagui";
import { PiggyBank } from "lucide-react-native";

import { ActivityRow, ActivityRowSkeleton } from "@/components/home/ActivityRow";
import { Card, Divider, EmptyState, UiText } from "@/components/home/primitives";
import { fetchWalletActivity, walletActivityQueryKey, walletItemToTransaction } from "@/hooks/use-activity-feed";
import { toTxParams } from "@/lib/activity/tx-params";
import { useColors } from "@/lib/theme/appearance";
import { radius, space } from "@/lib/theme/tokens";

const PAGE = 10;

export const HistoryCard = ({ address }: { address: string }) => {
  const c = useColors();
  const router = useRouter();
  const [shown, setShown] = React.useState(PAGE);
  const q = useQuery({
    queryKey: walletActivityQueryKey(address),
    queryFn: () => fetchWalletActivity(address),
    staleTime: 10_000,
    retry: 1
  });
  const rows = React.useMemo(
    () =>
      (q.data?.items ?? [])
        .filter((i) => i.kind === "vault_deposit" || i.kind === "vault_withdraw")
        .map(walletItemToTransaction)
        .filter((t): t is NonNullable<typeof t> => !!t)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    [q.data]
  );
  const failed = q.isError && rows.length === 0;

  return (
    <YStack gap={12}>
      <XStack alignItems='center' justifyContent='space-between'>
        <UiText fontSize={14} fontWeight='500' color={c.ink2}>Transaction history</UiText>
        {failed ? (
          <UiText fontSize={11.5} color={c.chips.amber.color}>Couldn’t load — retrying…</UiText>
        ) : rows.length > 0 ? (
          <XStack paddingHorizontal={8} paddingVertical={2} borderRadius={radius.pill} backgroundColor={c.iconBg}>
            <UiText fontSize={11} fontWeight='500' color={c.muted} fontFamily='$mono'>{rows.length}</UiText>
          </XStack>
        ) : null}
      </XStack>
      <Card>
        {q.isLoading ? (
          <>
            <ActivityRowSkeleton />
            <Divider />
            <ActivityRowSkeleton />
          </>
        ) : rows.length === 0 ? (
          <EmptyState icon={<PiggyBank size={22} color={c.faint} strokeWidth={1.8} />} title='No transactions yet' body='Your deposits and withdrawals will appear here.' />
        ) : (
          <>
            {rows.slice(0, shown).map((tx, i) => (
              <React.Fragment key={tx.id}>
                {i > 0 ? <Divider /> : null}
                <ActivityRow tx={tx} onPress={() => router.push({ pathname: "/tx", params: toTxParams(tx) })} />
              </React.Fragment>
            ))}
            {rows.length > shown ? (
              <>
                <Divider />
                <XStack
                  onPress={() => setShown((n) => n + PAGE)}
                  paddingVertical={12}
                  paddingHorizontal={space.rowX}
                  justifyContent='center'
                  pressStyle={{ backgroundColor: c.pressTint }}
                  accessibilityRole='button'
                >
                  <UiText fontSize={13} fontWeight='600' color={c.ink2}>Show more</UiText>
                </XStack>
              </>
            ) : null}
          </>
        )}
      </Card>
    </YStack>
  );
};

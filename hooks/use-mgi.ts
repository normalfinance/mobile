// MoneyGram reads shared by Buy / Savings / Activity / tx detail (web
// use-mgi-limits.ts + use-mgi-transactions.ts). Our DB rows need no SEP-10:
// rendering history must never trigger a passkey ceremony.

import { useQuery } from "@tanstack/react-query";

import { fetchMgiLimits, fetchMgiTransactions, MGI_FALLBACK_LIMITS, PENDING_MGI_STATUSES, type MgiLimits } from "@/lib/ramp/moneygram";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

export const useMgiLimits = (): MgiLimits => {
  const q = useQuery({ queryKey: ["mgi", "limits"], queryFn: fetchMgiLimits, staleTime: 60 * 60_000, retry: 1 });
  return q.data ?? MGI_FALLBACK_LIMITS;
};

export const mgiTransactionsQueryKey = (uid: string | undefined) => ["activity", "mgi", uid ?? "none"] as const;

/** Our MoneyGram rows; polled 60 s ONLY while one is still in flight (another
 *  device or the cron may have moved it). */
export const useMgiTransactions = (enabled = true) => {
  const { user } = useSupabaseAuth();
  return useQuery({
    queryKey: mgiTransactionsQueryKey(user?.id),
    enabled: enabled && !!user,
    queryFn: fetchMgiTransactions,
    staleTime: 15_000,
    refetchInterval: (q) => ((q.state.data ?? []).some((t) => PENDING_MGI_STATUSES.has(t.status)) ? 60_000 : false),
    retry: 1
  });
};

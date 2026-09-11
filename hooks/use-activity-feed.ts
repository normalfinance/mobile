// Activity across every chain the wallet has an address for, the way the web
// feed does it (use-user-activity.ts:650-672): one public request per chain —
//   GET /api/activity/{bitcoin|ethereum|solana|stellar}?address=…
// — merged client-side and sorted newest first. Each route returns
//   { success, items: [{ id, timestamp(ms), type: 'Sent'|'Receive', address,
//                        txHash, confirmed?, token: { symbol, amount, iconUrl } }] }
// (web src/types/activity.ts; live-verified 2026-09-11). Server caches 45–300 s.
// Savings deposits/withdrawals and swaps come from wallet/activity and join
// here once those flows exist on mobile. There is no pagination anywhere (Q21).

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { Transaction } from "@/services/portfolio.service";
import { useTurnkeyWallet, type WalletChain } from "@/hooks/use-turnkey-wallet";

interface ChainActivityItem {
  id: string;
  timestamp: number;
  type: "Sent" | "Receive";
  address: string;
  txHash: string | null;
  confirmed?: boolean;
  token: { address: string; symbol: string; iconUrl: string; amount: number };
}

interface ChainActivityResponse {
  success: boolean;
  items?: ChainActivityItem[];
  stale?: boolean;
  error?: string;
}

export const chainActivityQueryKey = (chain: WalletChain, address: string) =>
  ["activity", chain, address] as const;

const fetchChainActivity = (chain: WalletChain, address: string) =>
  apiFetch<ChainActivityResponse>(`/api/activity/${chain}`, {
    anonymous: true,
    query: { address }
  });

const toTransaction = (
  chain: WalletChain,
  item: ChainActivityItem,
  priceOf: (symbol: string) => number
): Transaction => ({
  id: item.id,
  type: item.type === "Sent" ? "send" : "receive",
  asset: item.token.symbol,
  amount: item.token.amount,
  usdValue: item.token.amount * priceOf(item.token.symbol),
  timestamp: new Date(item.timestamp),
  // undefined = unknown (Stellar reports confirmed: true); false = mempool
  status: item.confirmed === false ? "pending" : "completed",
  chain,
  txHash: item.txHash,
  counterparty: item.address
});

/**
 * @param priceOf USD spot per symbol, from the portfolio, so rows can show a
 *                USD value; defaults to 0 when unknown.
 */
export const useActivityFeed = (priceOf: (symbol: string) => number = () => 0) => {
  const { addresses, isLoading: isWalletLoading } = useTurnkeyWallet();

  const queries = useQueries({
    queries: addresses.map(({ chain, address }) => ({
      queryKey: chainActivityQueryKey(chain, address),
      queryFn: () => fetchChainActivity(chain, address),
      staleTime: 45_000, // shortest server TTL among the four routes
      refetchInterval: 60_000,
      retry: 1
    }))
  });

  // Fixed-length memo key: the number of queries changes with the wallet.
  const dataKey = queries.map((q) => q.dataUpdatedAt).join(",");
  const transactions = useMemo(() => {
    const rows: Transaction[] = [];
    addresses.forEach(({ chain }, i) => {
      const items = queries[i]?.data?.items ?? [];
      for (const item of items) rows.push(toTransaction(chain, item, priceOf));
    });
    return rows.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses, dataKey, priceOf]);

  // Like web: stay "loading" until every source asked for has answered once,
  // so rows don't pop in one chain at a time.
  const isLoading = isWalletLoading || queries.some((q) => q.isLoading);
  const isFetching = queries.some((q) => q.isFetching);
  const error = (queries.find((q) => q.error)?.error as Error | undefined) ?? null;

  const refetch = () => Promise.all(queries.map((q) => q.refetch()));

  return { transactions, isLoading, isFetching, error, refetch };
};

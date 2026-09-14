// Activity across every chain the wallet has an address for, the way the web
// feed does it (use-user-activity.ts:650-672): one public request per chain —
//   GET /api/activity/{bitcoin|ethereum|solana|stellar}?address=…
// — merged client-side and sorted newest first. Each route returns
//   { success, items: [{ id, timestamp(ms), type: 'Sent'|'Receive', address,
//                        txHash, confirmed?, token: { symbol, amount, iconUrl } }] }
// (web src/types/activity.ts; live-verified 2026-09-11). Server caches 45–300 s.
// Savings deposits/withdrawals (and swaps, later) come from the PRIVATE
//   GET /api/wallet/activity?walletAddress=&limit=50   (our DB: confirmed
// vault_deposits + swap_logs; web types/wallet-activity.ts). A vault row's
// txHash is the Soroban tx; the chain feed may carry the same hash as a raw
// leg — suppressed by hash so each action shows once (web use-user-activity.ts).
// There is no pagination anywhere (Q21).

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

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

// --- wallet/activity (web types/wallet-activity.ts, copied shape) ---------
type WalletActivityItem =
  | { kind: "vault_deposit" | "vault_withdraw"; id: string; createdAt: string; txHash: string | null; amount: string; vaultAddress: string }
  | {
      kind: "swap";
      id: string;
      createdAt: string;
      txHash: string | null;
      tokenInAddress: string;
      tokenOutAddress: string;
      tokenInSymbol: string | null;
      tokenOutSymbol: string | null;
      amountIn: string;
      amountOut: string;
    };

interface WalletActivityResponse {
  success: boolean;
  items?: WalletActivityItem[];
  error?: string;
}

export const walletActivityQueryKey = (address: string) => ["activity", "wallet", address] as const;

const fetchWalletActivity = (address: string) =>
  apiFetch<WalletActivityResponse>("/api/wallet/activity", { query: { walletAddress: address, limit: 50 } });

const walletItemToTransaction = (item: WalletActivityItem): Transaction | null => {
  const timestamp = new Date(item.createdAt);
  if (item.kind === "vault_deposit" || item.kind === "vault_withdraw") {
    const amount = parseFloat(item.amount) || 0;
    return {
      id: item.id,
      type: item.kind === "vault_deposit" ? "savings_deposit" : "savings_withdraw",
      asset: "USDC",
      amount,
      usdValue: amount, // USDC ≈ $1, same peg web uses for the savings row
      timestamp,
      status: "completed", // the route returns confirmed rows only (#27)
      chain: "stellar",
      txHash: item.txHash
    };
  }
  // Soroswap rows arrive with the swap flow; until then they are not rendered.
  return null;
};

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

  const stellarAddress = addresses.find((a) => a.chain === "stellar")?.address ?? null;

  const queries = useQueries({
    queries: addresses.map(({ chain, address }) => ({
      queryKey: chainActivityQueryKey(chain, address),
      queryFn: () => fetchChainActivity(chain, address),
      staleTime: 45_000, // shortest server TTL among the four routes
      refetchInterval: 60_000,
      retry: 1
    }))
  });

  const walletQuery = useQuery({
    queryKey: walletActivityQueryKey(stellarAddress ?? "none"),
    enabled: !!stellarAddress,
    queryFn: () => fetchWalletActivity(stellarAddress!),
    staleTime: 10_000, // web dedupingInterval; refreshed on foreground + after own actions
    retry: 1
  });

  // Fixed-length memo key: the number of queries changes with the wallet.
  const dataKey = queries.map((q) => q.dataUpdatedAt).join(",") + "|" + walletQuery.dataUpdatedAt;
  const transactions = useMemo(() => {
    const walletRows = (walletQuery.data?.items ?? [])
      .map(walletItemToTransaction)
      .filter((t): t is Transaction => !!t);
    const ownHashes = new Set(walletRows.map((t) => t.txHash).filter((h): h is string => !!h));
    const rows: Transaction[] = [...walletRows];
    addresses.forEach(({ chain }, i) => {
      const items = queries[i]?.data?.items ?? [];
      for (const item of items) {
        // The same hash as a savings row is that action's raw chain leg — show once.
        if (item.txHash && ownHashes.has(item.txHash)) continue;
        rows.push(toTransaction(chain, item, priceOf));
      }
    });
    return rows.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses, dataKey, priceOf]);

  // Like web: stay "loading" until every source asked for has answered once,
  // so rows don't pop in one chain at a time.
  const isLoading = isWalletLoading || queries.some((q) => q.isLoading) || (!!stellarAddress && walletQuery.isLoading);
  const isFetching = queries.some((q) => q.isFetching) || walletQuery.isFetching;
  const error = (queries.find((q) => q.error)?.error as Error | undefined) ?? null;

  const refetch = () => Promise.all([...queries.map((q) => q.refetch()), walletQuery.refetch()]);

  return { transactions, isLoading, isFetching, error, refetch };
};

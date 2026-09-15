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
import { fetchActiveRamps, type RampTransfer } from "@/lib/ramp/coinbase";
import { reconcilePendingSends, usePendingSends } from "@/lib/send/pending-sends";
import { fetchCctpTransfers, type CctpTransfer } from "@/lib/cctp/engine";
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

// Server TTL per route (web agent, 2026-09-15). A refetch inside the window is
// a guaranteed cache hit that still costs a round trip; a miss on ethereum is
// two Etherscan calls and on solana ~100 Helius credits — so staleTime = TTL
// and there is no interval: foreground, pull-to-refresh and own actions only.
const ACTIVITY_STALE_MS: Record<WalletChain, number> = {
  stellar: 60_000,
  bitcoin: 45_000,
  ethereum: 300_000,
  solana: 300_000
};

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
  // Swap (Soroswap / LI.FI record): one row, shown as what was received.
  const swap = item as Extract<WalletActivityItem, { kind: "swap" }>;
  const amountOut = parseFloat(swap.amountOut) || 0;
  const amountIn = parseFloat(swap.amountIn) || 0;
  const symOut = swap.tokenOutSymbol ?? "";
  const symIn = swap.tokenInSymbol ?? "";
  return {
    id: item.id,
    type: "swap",
    asset: symOut,
    amount: amountOut,
    usdValue: 0,
    timestamp,
    status: "completed",
    chain: "stellar",
    txHash: item.txHash,
    counterparty: symIn ? `${amountIn} ${symIn}` : undefined
  };
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
  const pendingSends = usePendingSends();

  const stellarAddress = addresses.find((a) => a.chain === "stellar")?.address ?? null;

  const queries = useQueries({
    queries: addresses.map(({ chain, address }) => ({
      queryKey: chainActivityQueryKey(chain, address),
      queryFn: () => fetchChainActivity(chain, address),
      staleTime: ACTIVITY_STALE_MS[chain],
      retry: 1
    }))
  });

  // In-flight ramps (authed, our DB). Polled every 15s ONLY while a row is
  // still in flight — the server flips it to 'arrived' from the chain balance.
  const rampsQuery = useQuery({
    queryKey: ["activity", "ramps", stellarAddress ?? "none"],
    enabled: !!stellarAddress,
    queryFn: fetchActiveRamps,
    staleTime: 15_000,
    refetchInterval: (q) => ((q.state.data ?? []).some((r) => !["arrived", "paid_out", "abandoned", "failed"].includes(r.status)) ? 15_000 : false),
    retry: 1
  });

  // Cross-chain (CCTP) swaps: one row per transfer, pending until delivered.
  // Polled 30s only while one is in flight (web use-user-activity.ts).
  const cctpQuery = useQuery({
    queryKey: ["activity", "cctp", stellarAddress ?? "none"],
    enabled: !!stellarAddress,
    queryFn: () => fetchCctpTransfers(true),
    staleTime: 20_000,
    refetchInterval: (q) => ((q.state.data ?? []).some((t) => !["COMPLETED", "FAILED", "REFUNDED"].includes(t.status) || (t.direction === "stellar_to_crosschain" && t.status === "COMPLETED" && !t.dstSwapTxHash)) ? 30_000 : false),
    retry: 1
  });

  const walletQuery = useQuery({
    queryKey: walletActivityQueryKey(stellarAddress ?? "none"),
    enabled: !!stellarAddress,
    queryFn: () => fetchWalletActivity(stellarAddress!),
    staleTime: 10_000, // web dedupingInterval; refreshed on foreground + after own actions
    retry: 1
  });

  // Fixed-length memo key: the number of queries changes with the wallet.
  const dataKey = queries.map((q) => q.dataUpdatedAt).join(",") + "|" + walletQuery.dataUpdatedAt + "|" + rampsQuery.dataUpdatedAt + "|" + pendingSends.length + "|" + cctpQuery.dataUpdatedAt;
  const transactions = useMemo(() => {
    // Every hash the feeds know this render — a pending send it covers is retired.
    const known = new Set<string>();
    queries.forEach((q) => (q.data?.items ?? []).forEach((i) => i.txHash && known.add(i.txHash.toLowerCase())));
    (walletQuery.data?.items ?? []).forEach((i) => i.txHash && known.add(i.txHash.toLowerCase()));
    reconcilePendingSends(known);
    const pendingRows: Transaction[] = pendingSends
      .filter((p) => !known.has(p.txHash.toLowerCase()))
      .map((p) => ({
        id: `pending-send:${p.chain}:${p.txHash}`,
        type: "send",
        asset: p.symbol,
        amount: parseFloat(p.amount) || 0,
        usdValue: (parseFloat(p.amount) || 0) * priceOf(p.symbol),
        timestamp: new Date(p.createdAt),
        status: "pending",
        chain: p.chain,
        txHash: p.txHash,
        counterparty: p.destination
      }));
    const rampRows: Transaction[] = (rampsQuery.data ?? [])
      .filter((r: RampTransfer) => !["arrived", "paid_out", "abandoned"].includes(r.status))
      .map((r) => ({
        id: `ramp:${r.id}`,
        type: r.direction === "onramp" ? "buy" : "sell",
        asset: r.asset,
        amount: r.amountExpected ? parseFloat(r.amountExpected) || 0 : 0,
        usdValue: 0,
        timestamp: new Date(r.createdAt),
        status: r.status === "failed" ? "failed" : "pending",
        chain: r.chain,
        txHash: null,
        counterparty: r.provider === "coinbase" ? "Coinbase" : r.provider
      }));
    const walletRows = (walletQuery.data?.items ?? [])
      .map(walletItemToTransaction)
      .filter((t): t is Transaction => !!t);
    const ownHashes = new Set(walletRows.map((t) => t.txHash).filter((h): h is string => !!h));
    // CCTP: outbound is done only once the pivot delivered (dstSwapTxHash);
    // inbound at COMPLETED. Legs we signed are suppressed from the chain feeds.
    const cctpLegHashes = new Set<string>();
    const cctpRows: Transaction[] = (cctpQuery.data ?? [])
      .filter((tr: CctpTransfer) => !!tr.srcAmount) // pre-amount-tracking rows would render as 0 → 0
      .map((tr) => {
        for (const h of [tr.burnTxHash, tr.mintTxHash, tr.srcSwapTxHash, tr.dstSwapTxHash]) if (h) cctpLegHashes.add(h.toLowerCase());
        const outbound = tr.direction === "stellar_to_crosschain";
        const failed = tr.status === "FAILED";
        const refunded = tr.status === "REFUNDED";
        const done = outbound ? tr.status === "COMPLETED" && !!tr.dstSwapTxHash : tr.status === "COMPLETED";
        return {
          id: `cctp:${tr.id}`,
          type: "swap",
          asset: tr.dstAsset,
          amount: parseFloat(tr.dstAmount ?? "0") || 0,
          usdValue: 0,
          timestamp: new Date(tr.createdAt),
          status: failed || refunded ? "failed" : done ? "completed" : "pending",
          chain: "stellar",
          txHash: tr.burnTxHash,
          counterparty: `${tr.srcAmount} ${tr.srcAsset}${refunded ? " · refunded" : ""}`
        } as Transaction;
      });
    cctpLegHashes.forEach((h) => known.add(h));
    const rows: Transaction[] = [...pendingRows, ...rampRows, ...cctpRows, ...walletRows];
    addresses.forEach(({ chain }, i) => {
      const items = queries[i]?.data?.items ?? [];
      for (const item of items) {
        // The same hash as a savings/CCTP row is that action's raw chain leg — show once.
        if (item.txHash && (ownHashes.has(item.txHash) || cctpLegHashes.has(item.txHash.toLowerCase()))) continue;
        rows.push(toTransaction(chain, item, priceOf));
      }
    });
    const ts = (t: Transaction) => t.timestamp.getTime() || 0; // NaN-safe (web 2026-08-19)
    return rows.sort((a, b) => ts(b) - ts(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses, dataKey, priceOf]);

  // Like web: stay "loading" until every source asked for has answered once,
  // so rows don't pop in one chain at a time.
  const isLoading = isWalletLoading || queries.some((q) => q.isLoading) || (!!stellarAddress && walletQuery.isLoading);
  const isFetching = queries.some((q) => q.isFetching) || walletQuery.isFetching;
  const error = (queries.find((q) => q.error)?.error as Error | undefined) ?? null;

  const refetch = () => Promise.all([...queries.map((q) => q.refetch()), walletQuery.refetch(), rampsQuery.refetch(), cctpQuery.refetch()]);

  return { transactions, isLoading, isFetching, error, refetch };
};

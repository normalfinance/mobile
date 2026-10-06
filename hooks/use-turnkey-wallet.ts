// "Does this Supabase user have a Turnkey wallet?" — answered by the server,
// never by anything stored on the phone. Mirrors web's useTurnkeyWallet
// (packages/web/src/hooks/use-turnkey-wallet.ts): one shared fetch of
// GET /api/turnkey/wallet, cached for a minute, keyed by the Supabase uid.
//
// Response contract (docs/web-agent-answers.md Q25):
//   { wallet: { subOrgId, walletId, bitcoinAddress, ethereumAddress,
//               solanaAddress, stellarAddress } | null }
// A null address means that chain has not been set up for the user yet
// (lazy asset creation) — it is NOT an error.

import { useQuery } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

export interface TurnkeyWallet {
  subOrgId: string;
  walletId: string;
  bitcoinAddress: string | null;
  ethereumAddress: string | null;
  solanaAddress: string | null;
  stellarAddress: string | null;
}

interface TurnkeyWalletResponse {
  wallet: TurnkeyWallet | null;
}

export type WalletChain = "stellar" | "bitcoin" | "ethereum" | "solana";

/** Per-chain display facts. Colours from web lib/chains/registry.ts brandColor. */
export const CHAIN_META: Record<
  WalletChain,
  { name: string; assets: string; color: string; warning: string }
> = {
  stellar: {
    name: "Stellar",
    assets: "XLM · USDC",
    color: "#14B8A6",
    warning: "Send only XLM or USDC on the Stellar network to this address."
  },
  bitcoin: {
    name: "Bitcoin",
    assets: "BTC",
    color: "#F7931A",
    warning: "Send only BTC on the Bitcoin network to this address."
  },
  ethereum: {
    name: "Ethereum",
    assets: "ETH",
    color: "#627EEA",
    warning: "Send only ETH on Ethereum mainnet to this address."
  },
  solana: {
    name: "Solana",
    assets: "SOL",
    color: "#9945FF",
    warning: "Send only SOL on the Solana network to this address."
  }
};

export interface WalletAddress {
  chain: WalletChain;
  address: string;
}

/** The chains this wallet has an address for, in display order. */
export const walletAddresses = (wallet: TurnkeyWallet | null | undefined): WalletAddress[] => {
  if (!wallet) return [];
  const pairs: [WalletChain, string | null][] = [
    ["stellar", wallet.stellarAddress],
    ["bitcoin", wallet.bitcoinAddress],
    ["ethereum", wallet.ethereumAddress],
    ["solana", wallet.solanaAddress]
  ];
  return pairs.flatMap(([chain, address]) => (address ? [{ chain, address }] : []));
};

/**
 * - `none`        → no sub-org yet; the user must create a wallet (passkey ceremony)
 * - `no-stellar`  → sub-org exists but Stellar has not been set up (add-account branch)
 * - `ready`       → Stellar address present
 * - `unknown`     → still loading, or the request failed (never treat as "no wallet")
 */
export type TurnkeyWalletStatus = "unknown" | "none" | "no-stellar" | "ready";

export const turnkeyWalletQueryKey = (userId: string | undefined) =>
  ["turnkey-wallet", userId ?? "anonymous"] as const;

export const fetchTurnkeyWallet = async (): Promise<TurnkeyWallet | null> => {
  const data = await apiFetch<TurnkeyWalletResponse>("/api/turnkey/wallet");
  return data?.wallet ?? null;
};

export const useTurnkeyWallet = (enabled: boolean = true) => {
  const { user, isLoading: isAuthLoading } = useSupabaseAuth();

  const query = useQuery({
    queryKey: turnkeyWalletQueryKey(user?.id),
    queryFn: fetchTurnkeyWallet,
    enabled: enabled && !!user,
    staleTime: 60_000,
    // A 401 here means the session is gone, not that the wallet is — the API
    // client already announced session-expired; don't hammer the route.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 401) && failureCount < 2
  });

  const wallet = query.data ?? null;

  let status: TurnkeyWalletStatus = "unknown";
  if (!isAuthLoading && query.isSuccess) {
    if (wallet === null) status = "none";
    else if (!wallet.stellarAddress) status = "no-stellar";
    else status = "ready";
  }

  return {
    wallet,
    status,
    stellarAddress: wallet?.stellarAddress ?? null,
    addresses: walletAddresses(wallet),
    isLoading: isAuthLoading || (query.isLoading && !!user),
    error: query.error as Error | null,
    refetch: query.refetch
  };
};

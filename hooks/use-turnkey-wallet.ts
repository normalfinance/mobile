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
    isLoading: isAuthLoading || (query.isLoading && !!user),
    error: query.error as Error | null,
    refetch: query.refetch
  };
};

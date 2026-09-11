// Normal Savings = the DeFindex vault over Blend on Stellar. Vault facts come
// from GET /api/savings/vault-info (public, Q7). Shape observed on staging on
// 2026-09-11:
//   { success: true, vault: { address, name, symbol, totalDeposits, apy, asset,
//                             fees: { vaultFee, defindexFee } } }
// The user's position (savings/user-position) and deposit/withdraw
// (fees/execute-pair, two signatures) arrive with the Turnkey wallet.

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";

export interface VaultInfo {
  address: string;
  name: string;
  symbol: string;
  totalDeposits: string;
  apy: number; // percent, e.g. 6.82
  asset: string; // "USDC"
  fees?: { vaultFee: number; defindexFee: number };
}

interface VaultInfoResponse {
  success: true;
  vault: VaultInfo;
}

export const vaultInfoQueryKey = ["savings", "vault-info"] as const;

export const useVaultInfo = () =>
  useQuery({
    queryKey: vaultInfoQueryKey,
    queryFn: async () => {
      const data = await apiFetch<VaultInfoResponse>("/api/savings/vault-info", {
        anonymous: true,
        query: { network: "mainnet" }
      });
      return data.vault;
    },
    staleTime: 5 * 60_000,
    retry: 1
  });

import { Horizon } from "@stellar/stellar-sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  STELLAR_CONFIG,
  STELLAR_ERRORS
} from "../lib/constants/stellar.constants";
import {
  WalletBalance,
  AssetBalance,
  DisplayAsset,
  BalanceError
} from "../lib/types/balance.types";
import { STALE_TIMES } from "../lib/utils/query.utils";
import { getWallet } from "./wallet.service";

// Initialize Horizon server (using testnet for development)
const server = new Horizon.Server(STELLAR_CONFIG.HORIZON_URLS.TESTNET);

// Core balance functions
export const fetchAccountBalances = async (
  publicKey: string
): Promise<WalletBalance> => {
  try {
    const account = await server.loadAccount(publicKey);

    return {
      publicKey: account.accountId(),
      balances: account.balances as AssetBalance[],
      sequence: account.sequence,
      subentry_count: account.subentry_count,
      last_modified_ledger: account.last_modified_ledger,
      last_modified_time: account.last_modified_time,
      thresholds: {
        low_threshold: account.thresholds.low_threshold,
        med_threshold: account.thresholds.med_threshold,
        high_threshold: account.thresholds.high_threshold
      },
      flags: {
        auth_required: account.flags.auth_required,
        auth_revocable: account.flags.auth_revocable,
        auth_immutable: account.flags.auth_immutable
      },
      signers: account.signers,
      data: account.data_attr
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error(STELLAR_ERRORS.ACCOUNT_NOT_FOUND);
    }
    throw new Error(`${STELLAR_ERRORS.BALANCE_FETCH_FAILED}: ${error.message}`);
  }
};

function getDisplayName(assetCode: string): string {
  switch (assetCode) {
    case "nBTC":
      return "Normal Bitcoin";
    case "nETH":
      return "Normal Ethereum";
    case "nSOL":
      return "Normal Solana";
  }
  return assetCode;
}

export const transformBalancesToDisplayAssets = (
  balances: AssetBalance[]
): DisplayAsset[] => {
  return balances.map((balance) => {
    let displayName = "Unknown Asset";
    let assetCode = "Unknown";

    if (balance.asset_type === "native") {
      displayName = "Stellar Lumens";
      assetCode = "XLM";
    } else if (balance.asset_code) {
      displayName = getDisplayName(balance.asset_code);
      assetCode = balance.asset_code;
    }

    return {
      asset_code: assetCode,
      asset_issuer: balance.asset_issuer,
      balance: balance.balance,
      asset_type: balance.asset_type,
      display_name: displayName,
      logo_url: balance.asset_type === "native" ? undefined : undefined // Can be expanded later with asset logo mapping
    };
  });
};

export const getWalletBalances = async (): Promise<DisplayAsset[]> => {
  try {
    const wallet = await getWallet();
    if (!wallet) {
      throw new Error(STELLAR_ERRORS.NO_WALLET);
    }

    const balanceData = await fetchAccountBalances(wallet.publicKey);
    return transformBalancesToDisplayAssets(balanceData.balances);
  } catch (error: any) {
    throw error;
  }
};

export const checkAccountExists = async (
  publicKey: string
): Promise<boolean> => {
  try {
    await server.loadAccount(publicKey);
    return true;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return false;
    }
    throw error;
  }
};

// Query Keys
export const balanceQueryKeys = {
  all: ["balances"] as const,
  wallet: () => [...balanceQueryKeys.all, "wallet"] as const,
  account: (publicKey: string) =>
    [...balanceQueryKeys.all, "account", publicKey] as const,
  exists: (publicKey: string) =>
    [...balanceQueryKeys.all, "exists", publicKey] as const
};

// Custom Hooks
export const useWalletBalances = (enabled: boolean = true) => {
  return useQuery({
    queryKey: balanceQueryKeys.wallet(),
    queryFn: getWalletBalances,
    enabled,
    staleTime: STALE_TIMES.SHORT, // 30 seconds - balances can change frequently
    retry: (failureCount, error: any) => {
      // Don't retry if the account doesn't exist
      if (error.message.includes(STELLAR_ERRORS.ACCOUNT_NOT_FOUND)) {
        return false;
      }
      return failureCount < 3;
    }
  });
};

export const useAccountBalances = (
  publicKey?: string,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: balanceQueryKeys.account(publicKey || ""),
    queryFn: () => fetchAccountBalances(publicKey!),
    enabled: enabled && !!publicKey,
    staleTime: STALE_TIMES.SHORT,
    retry: (failureCount, error: any) => {
      if (error.message.includes(STELLAR_ERRORS.ACCOUNT_NOT_FOUND)) {
        return false;
      }
      return failureCount < 3;
    }
  });
};

export const useAccountExists = (
  publicKey?: string,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: balanceQueryKeys.exists(publicKey || ""),
    queryFn: () => checkAccountExists(publicKey!),
    enabled: enabled && !!publicKey,
    staleTime: STALE_TIMES.MEDIUM,
    retry: 2
  });
};

// Utility hook for combined wallet status and balances
export const useWalletBalanceStatus = () => {
  const walletBalancesQuery = useWalletBalances();

  return {
    balances: walletBalancesQuery.data || [],
    isLoading: walletBalancesQuery.isLoading,
    error: walletBalancesQuery.error,
    isError: walletBalancesQuery.isError,
    hasBalances: (walletBalancesQuery.data?.length || 0) > 0,
    refetch: walletBalancesQuery.refetch,
    isAccountNotFound: walletBalancesQuery.error?.message?.includes(
      STELLAR_ERRORS.ACCOUNT_NOT_FOUND
    )
  };
};

import { useQuery } from "@tanstack/react-query";

import { fetchWalletTransactions } from "@/lib/utils/transactions.utils";
import { STALE_TIMES } from "@/lib/utils/query.utils";
import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import type { Transaction } from "@/services/portfolio.service";

const walletTransactionsQueryKey = {
  all: ["wallet", "transactions"] as const,
  list: (publicKey: string) =>
    [...walletTransactionsQueryKey.all, publicKey] as const
};

export const useWalletTransactions = (enabled: boolean = true) => {
  const { stellarAddress, isLoading: isWalletLoading } = useTurnkeyWallet();

  const publicKey = stellarAddress ?? undefined;

  const query = useQuery<Transaction[]>({
    queryKey: walletTransactionsQueryKey.list(publicKey || "unknown"),
    queryFn: () => fetchWalletTransactions(publicKey || ""),
    enabled: enabled && !!publicKey,
    staleTime: STALE_TIMES.SHORT,
    refetchInterval: STALE_TIMES.SHORT,
    retry: 1
  });

  return {
    transactions: query.data || [],
    isLoading: query.isLoading || isWalletLoading,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching
  };
};

export const walletTransactionsKeys = walletTransactionsQueryKey;

// Server-side ownership for an external Stellar address (web
// use-stellar-wallets-kit.tsx ensureWalletLinked): the API accepts an address
// only if it is in linked_wallets or turnkey_wallets, so a connected wallet
// must be linked or every write (execute-pair, swap logs) returns 403.
// Check before writing — POST consumes the 3-per-24h creation quota even for
// an address that is already linked (web finding #41).

import { ApiError, apiFetch } from "@/lib/api";

export interface LinkedWallet {
  walletAddress: string;
  walletName: string | null;
  lastUsedAt?: string;
}

export const fetchLinkedWallets = async (): Promise<LinkedWallet[]> => {
  const d = await apiFetch<{ wallets?: LinkedWallet[] }>("/api/wallets/linked");
  return d.wallets ?? [];
};

export class WalletLinkLimitError extends Error {
  constructor(public readonly reset: number | null) {
    super("You’ve linked the maximum number of wallets for today (3 per 24 hours). Try again later.");
    this.name = "WalletLinkLimit";
  }
}

/** Idempotent: links only when the address is not linked yet. */
export const ensureWalletLinked = async (walletAddress: string, walletName: string): Promise<void> => {
  const existing = (await fetchLinkedWallets()).find((w) => w.walletAddress === walletAddress);
  if (existing) {
    if (walletName && !existing.walletName) await apiFetch("/api/wallets/link", { method: "PATCH", body: { walletAddress, walletName } }).catch(() => undefined);
    return;
  }
  const limit = await apiFetch<{ allowed?: boolean; reset?: number }>("/api/wallets/check-limit").catch(() => null);
  if (limit && limit.allowed === false) throw new WalletLinkLimitError(limit.reset ?? null);
  try {
    await apiFetch("/api/wallets/link", { body: { walletAddress, walletName } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) throw new WalletLinkLimitError((e.body as { reset?: number } | null)?.reset ?? null);
    throw e;
  }
};

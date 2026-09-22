// ONE entry point for "make sure this account has an address on <chain>",
// whether or not a Normal wallet exists yet — web's ensureChainAccount
// (add-account.ts) as confirmed by the web agent 2026-09-22:
//   no wallet yet → passkey registration + POST /api/turnkey/wallet { chain }
//                   (creates the sub-org with ONLY that chain — hard rule 7,
//                   lazy asset creation; Turnkey bills per address)
//   wallet exists → CREATE_WALLET_ACCOUNTS + POST /api/turnkey/import
// Stellar additionally links the address (activity + ownership checks read
// linked_wallets). Every entry point — Get started, Assets, Buy, Receive,
// Send, Swap, Savings — provisions through here.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { TurnkeyWallet, WalletChain } from "@/hooks/use-turnkey-wallet";
import { apiFetch } from "@/lib/api";
import { ensureChainAddress } from "./accounts";
import { invalidateCredentials } from "./credentials";
import { markDeviceReady } from "./device-ready";
import { registerPasskey } from "./passkey";

export class WalletLimitError extends Error {
  readonly reset: number | null;
  constructor(reset: number | null) {
    super("Wallet creation is limited to a few attempts per day.");
    this.name = "WalletLimitError";
    this.reset = reset;
  }
}

// --- backup flag (web wallet-backup.ts) --------------------------------------
// Web forces the recovery-phrase export right after the first chain is
// created (WalletBackupGate). Mobile records the same fact so the export gate
// can enforce it once the export screen ships; nothing reads it for UI yet.
const NEEDS_BACKUP_KEY = "wallet_needs_backup_v1";
export const markWalletNeedsBackup = (subOrgId: string) => AsyncStorage.setItem(NEEDS_BACKUP_KEY, subOrgId).catch(() => undefined);
export const markWalletBackedUp = () => AsyncStorage.removeItem(NEEDS_BACKUP_KEY).catch(() => undefined);
export const walletNeedsBackup = async (subOrgId: string) => (await AsyncStorage.getItem(NEEDS_BACKUP_KEY).catch(() => null)) === subOrgId;

interface WalletResponse {
  wallet?: Partial<TurnkeyWallet> | null;
  error?: string;
}

const ADDRESS_FIELD: Record<WalletChain, keyof TurnkeyWallet> = {
  stellar: "stellarAddress",
  bitcoin: "bitcoinAddress",
  ethereum: "ethereumAddress",
  solana: "solanaAddress"
};

/** First chain of a brand-new account: the passkey ceremony + the sub-org. */
const createFirstChain = async (user: { id: string; email?: string | null }, chain: WalletChain): Promise<TurnkeyWallet> => {
  // Hard rule 15: check the wallet-link quota BEFORE the passkey ceremony —
  // the ceremony is irreversible (a passkey is minted on the device).
  const limit = await apiFetch<{ allowed?: boolean; reset?: number }>("/api/wallets/check-limit").catch(() => null);
  if (limit && limit.allowed === false) throw new WalletLimitError(limit.reset ?? null);

  const attestation = await registerPasskey(user);
  const created = await apiFetch<WalletResponse>("/api/turnkey/wallet", {
    body: { challenge: attestation.challenge, attestation: attestation.attestation, chain }
  });
  const w = created?.wallet;
  if (!w?.subOrgId) throw new Error(created?.error ?? "The server did not create the wallet.");
  const wallet: TurnkeyWallet = {
    subOrgId: w.subOrgId,
    walletId: w.walletId ?? "",
    bitcoinAddress: w.bitcoinAddress ?? null,
    ethereumAddress: w.ethereumAddress ?? null,
    solanaAddress: w.solanaAddress ?? null,
    stellarAddress: w.stellarAddress ?? null
  };
  if (wallet.stellarAddress) {
    // Web links the Normal wallet's own Stellar address after creation
    // (chain-setup-dialog.tsx:99). Non-fatal: the wallet already exists.
    await apiFetch("/api/wallets/link", { body: { walletAddress: wallet.stellarAddress, walletName: "Normal Wallet" } }).catch(() => undefined);
  }
  invalidateCredentials();
  await markDeviceReady(wallet.subOrgId); // the passkey was made right here
  await markWalletNeedsBackup(wallet.subOrgId);
  return wallet;
};

/**
 * Ensure `chain` has an address; returns the updated wallet. One passkey
 * prompt either way (registration for a new account, a signed
 * CREATE_WALLET_ACCOUNTS for an existing one); a no-op if it already exists.
 */
export const provisionChain = async (p: { user: { id: string; email?: string | null } | null | undefined; wallet: TurnkeyWallet | null | undefined; chain: WalletChain }): Promise<TurnkeyWallet> => {
  if (!p.user) throw new Error("Sign in first.");
  if (!p.wallet) return createFirstChain(p.user, p.chain);
  if (p.wallet[ADDRESS_FIELD[p.chain]]) return p.wallet;
  if (!p.wallet.stellarAddress && !p.wallet.walletId) {
    // A row without a walletId cannot take more chains — treat as first chain.
    return createFirstChain(p.user, p.chain);
  }
  return ensureChainAddress(p.wallet, p.chain);
};

// Lazy chain-account creation (CLAUDE.md §5 HARD RULE, web lib/turnkey/
// add-account.ts + account-specs.ts): one address at signup, others on
// first use — Turnkey pricing scales with addresses. Never create all four.
//
//   passkey-stamped CREATE_WALLET_ACCOUNTS on the existing wallet (seed)
//   → POST /api/turnkey/import { walletId, chain }  (server re-reads the
//     wallet's accounts from Turnkey and updates turnkey_wallets)
// "Ensure", not "create": a path that already exists on the wallet is not an
// error — Turnkey refuses to re-create it and only our DB is behind, so we
// fall through to the sync (live 2026-08-22 on web).

import { apiFetch } from "@/lib/api";
import type { TurnkeyWallet, WalletChain } from "@/hooks/use-turnkey-wallet";
import { createPasskeyClient } from "./client";

interface WalletAccountParams {
  curve: "CURVE_SECP256K1" | "CURVE_ED25519";
  pathFormat: "PATH_FORMAT_BIP32";
  path: string;
  addressFormat:
    | "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH"
    | "ADDRESS_FORMAT_ETHEREUM"
    | "ADDRESS_FORMAT_SOLANA"
    | "ADDRESS_FORMAT_XLM";
}

/** Verbatim web account-specs.ts. */
export const CHAIN_ACCOUNT_SPECS: Record<WalletChain, WalletAccountParams[]> = {
  bitcoin: [
    { curve: "CURVE_SECP256K1", pathFormat: "PATH_FORMAT_BIP32", path: "m/84'/0'/0'/0/0", addressFormat: "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH" }
  ],
  ethereum: [
    { curve: "CURVE_SECP256K1", pathFormat: "PATH_FORMAT_BIP32", path: "m/44'/60'/0'/0/0", addressFormat: "ADDRESS_FORMAT_ETHEREUM" }
  ],
  solana: [{ curve: "CURVE_ED25519", pathFormat: "PATH_FORMAT_BIP32", path: "m/44'/501'/0'/0'", addressFormat: "ADDRESS_FORMAT_SOLANA" }],
  stellar: [{ curve: "CURVE_ED25519", pathFormat: "PATH_FORMAT_BIP32", path: "m/44'/148'/0'", addressFormat: "ADDRESS_FORMAT_XLM" }]
};

const ADDRESS_FIELD: Record<WalletChain, keyof TurnkeyWallet> = {
  bitcoin: "bitcoinAddress",
  ethereum: "ethereumAddress",
  solana: "solanaAddress",
  stellar: "stellarAddress"
};

const isPathAlreadyExistsError = (e: unknown): boolean => {
  const msg = String((e as { message?: string })?.message ?? e ?? "");
  return /path already exists/i.test(msg) || /error 6\b/i.test(msg);
};

/**
 * Make sure `wallet` has an address for `chain`; one passkey prompt when it
 * doesn't. Returns the (possibly updated) wallet from the server.
 */
export const ensureChainAddress = async (wallet: TurnkeyWallet, chain: WalletChain): Promise<TurnkeyWallet> => {
  if (wallet[ADDRESS_FIELD[chain]]) return wallet;
  if (!wallet.walletId) throw new Error("This account has no Normal wallet to add a chain to.");

  const client = await createPasskeyClient();
  try {
    const activity = await client.createWalletAccounts({
      type: "ACTIVITY_TYPE_CREATE_WALLET_ACCOUNTS",
      timestampMs: String(Date.now()),
      organizationId: wallet.subOrgId,
      parameters: { walletId: wallet.walletId, accounts: CHAIN_ACCOUNT_SPECS[chain] }
    });
    const created = activity?.activity?.result?.createWalletAccountsResult?.addresses;
    if (!created?.length) throw new Error("Turnkey did not create the account");
  } catch (e) {
    if (!isPathAlreadyExistsError(e)) throw e;
  }

  const data = await apiFetch<{ wallet: TurnkeyWallet }>("/api/turnkey/import", {
    body: { walletId: wallet.walletId, chain }
  });
  if (!data?.wallet?.[ADDRESS_FIELD[chain]]) throw new Error(`The server did not return a ${chain} address.`);
  return { ...wallet, ...data.wallet };
};

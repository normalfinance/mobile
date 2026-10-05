// Import a BIP-39 recovery phrase into the user's Turnkey sub-org — port of
// web lib/turnkey/import-mnemonic.ts (Q31) + utils normal-wallet.ts.
//
// Security model: the phrase is HPKE-encrypted ON THIS PHONE to a Turnkey
// enclave key (@turnkey/crypto verifies the enclave's signature on the
// bundle), so neither our server nor Turnkey staff ever see the plaintext.
// INIT_IMPORT_WALLET and IMPORT_WALLET are stamped by the user's passkey
// against their sub-org. Two passkey prompts; three on a brand-new account
// (the sub-org is created by POST turnkey/import-init with the attestation).
//
// Web records a second seed for an account that already has a wallet
// (`secondary: true`, primary row untouched) — the app only offers import
// while the account has NO wallet yet, so the imported seed IS the wallet.

import { mnemonicToSeedSync, validateMnemonic as scureValidate } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { hmac } from "@noble/hashes/hmac.js";
import { sha512 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { Keypair } from "@stellar/stellar-sdk";
import { encryptWalletToBundle } from "@turnkey/crypto";

import type { TurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { fetchTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { apiFetch } from "@/lib/api";
import { createPasskeyClient } from "./client";
import { invalidateCredentials } from "./credentials";
import { markDeviceReady } from "./device-ready";
import { registerPasskey } from "./passkey";
import { WalletLimitError, markWalletBackedUp } from "./provision";

export const normalizeMnemonic = (input: string): string => input.trim().toLowerCase().replace(/\s+/g, " ");
export const validateMnemonic = (mnemonic: string): boolean => {
  const n = normalizeMnemonic(mnemonic);
  const count = n ? n.split(" ").length : 0;
  return (count === 12 || count === 24) && scureValidate(n, wordlist);
};
export const isWordlistWord = (w: string) => wordlist.includes(w.toLowerCase());

// SLIP-0010 ed25519 derivation of SEP-0005 m/44'/148'/0' — the address
// Turnkey will derive for the imported seed (web account-specs XLM_ACCOUNT).
const HARDENED = 0x80000000;
const hardenedChild = (key: Uint8Array, chainCode: Uint8Array, index: number) => {
  const idx = new Uint8Array(4);
  new DataView(idx.buffer).setUint32(0, index + HARDENED);
  const data = new Uint8Array(1 + 32 + 4);
  data.set(key, 1);
  data.set(idx, 33);
  const d = hmac(sha512, chainCode, data);
  return { key: d.slice(0, 32), chainCode: d.slice(32) };
};
export const stellarAddressFromMnemonic = (mnemonic: string): string => {
  const seed = mnemonicToSeedSync(normalizeMnemonic(mnemonic));
  const master = hmac(sha512, utf8ToBytes("ed25519 seed"), seed);
  let node = { key: master.slice(0, 32), chainCode: master.slice(32) };
  for (const i of [44, 148, 0]) node = hardenedChild(node.key, node.chainCode, i);
  return Keypair.fromRawEd25519Seed(Buffer.from(node.key)).publicKey();
};

export type ImportStage = "passkey" | "preparing" | "authorize" | "encrypting" | "importing" | "recording";
export const IMPORT_STAGE_LABEL: Record<ImportStage, string> = {
  passkey: "Create your passkey…",
  preparing: "Preparing secure import…",
  authorize: "Approve with your passkey…",
  encrypting: "Encrypting your phrase…",
  importing: "Approve import with your passkey…",
  recording: "Reading your addresses…"
};

export const importMnemonicIntoTurnkey = async (p: {
  mnemonic: string;
  user: { id: string; email?: string | null };
  wallet: TurnkeyWallet | null | undefined;
  onStage?: (s: ImportStage) => void;
}): Promise<{ wallet: TurnkeyWallet; stellarMatch: boolean }> => {
  const mnemonic = normalizeMnemonic(p.mnemonic);
  if (!validateMnemonic(mnemonic)) throw new Error("Invalid recovery phrase");
  const expectedStellarAddress = stellarAddressFromMnemonic(mnemonic);

  // 1 — sub-org: reuse, or create it with a fresh passkey (web import-init).
  p.onStage?.("preparing");
  let initBody: Record<string, unknown> = {};
  const newPasskey = !p.wallet?.subOrgId;
  if (newPasskey) {
    // Hard rule 15: quota check BEFORE the irreversible passkey ceremony.
    const limit = await apiFetch<{ allowed?: boolean; reset?: number }>("/api/wallets/check-limit").catch(() => null);
    if (limit && limit.allowed === false) throw new WalletLimitError(limit.reset ?? null);
    p.onStage?.("passkey");
    const reg = await registerPasskey(p.user);
    initBody = { challenge: reg.challenge, attestation: reg.attestation };
  }
  const init = await apiFetch<{ subOrgId: string; userId: string; accounts: unknown[] }>("/api/turnkey/import-init", { body: initBody });
  if (!init?.subOrgId || !init.userId) throw new Error("Could not start the import.");
  if (newPasskey) {
    invalidateCredentials(); // the passkey just minted must be offered to the stamper
    await markDeviceReady(init.subOrgId);
  }

  // 2 — INIT_IMPORT_WALLET → enclave import bundle (passkey prompt).
  p.onStage?.("authorize");
  const client = await createPasskeyClient();
  const initActivity = await client.initImportWallet({
    type: "ACTIVITY_TYPE_INIT_IMPORT_WALLET",
    timestampMs: String(Date.now()),
    organizationId: init.subOrgId,
    parameters: { userId: init.userId }
  });
  const importBundle = initActivity?.activity?.result?.initImportWalletResult?.importBundle;
  if (!importBundle) throw new Error("Turnkey did not return an import bundle");

  // 3 — encrypt to the enclave key, on this phone.
  p.onStage?.("encrypting");
  const encryptedBundle = await encryptWalletToBundle({ mnemonic, importBundle, userId: init.userId, organizationId: init.subOrgId });

  // 4 — IMPORT_WALLET (passkey prompt). Labels are unique per sub-org.
  p.onStage?.("importing");
  const importedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
  const importActivity = await client.importWallet({
    type: "ACTIVITY_TYPE_IMPORT_WALLET",
    timestampMs: String(Date.now()),
    organizationId: init.subOrgId,
    parameters: { userId: init.userId, walletName: `Normal Wallet (imported ${importedAt})`, encryptedBundle, accounts: init.accounts as never }
  });
  const walletId = importActivity?.activity?.result?.importWalletResult?.walletId;
  if (!walletId) throw new Error("Import did not complete — no wallet returned");

  // 5 — the server re-reads the addresses from Turnkey itself.
  p.onStage?.("recording");
  const rec = await apiFetch<{ wallet?: Partial<TurnkeyWallet>; stellarMatch?: boolean }>("/api/turnkey/import", { body: { walletId, expectedStellarAddress } });
  const w = (await fetchTurnkeyWallet()) ?? null;
  if (!w?.subOrgId) throw new Error("The wallet was imported but could not be read back — reopen the app.");
  if (w.stellarAddress) await apiFetch("/api/wallets/link", { body: { walletAddress: w.stellarAddress, walletName: "Normal Wallet" } }).catch(() => undefined);
  await markWalletBackedUp(w.subOrgId); // the user already holds this phrase
  return { wallet: w, stellarMatch: rec?.stellarMatch ?? w.stellarAddress === expectedStellarAddress };
};

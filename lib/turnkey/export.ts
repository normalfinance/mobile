// Reveal the wallet's BIP-39 recovery phrase — web wallet-export-dialog.tsx
// (:214-224), confirmed by the web agent 2026-09-22: ACTIVITY_TYPE_EXPORT_WALLET
// exports the WALLET (mnemonic; 12 words for every wallet created in-app,
// 12 or 24 for imported ones), encrypted by Turnkey's enclave to a target
// public key. Web's target is its export iframe; mobile has no iframe, so an
// ephemeral P-256 key is generated here and the bundle is decrypted locally
// with @turnkey/crypto (HPKE + enclave-signature check). One passkey prompt;
// nothing is sent anywhere; the phrase lives only in React state until the
// screen unmounts.

import { decryptExportBundle, generateP256KeyPair } from "@turnkey/crypto";

import { apiFetch } from "@/lib/api";
import { createPasskeyClient } from "./client";

interface WalletsResponse {
  wallets?: { walletId: string; label?: string; isPrimary?: boolean }[];
}

/** The seed to export: the row's walletId, else the primary from turnkey/wallets. */
export const resolveExportWalletId = async (walletId: string | null | undefined): Promise<string> => {
  if (walletId) return walletId;
  const d = await apiFetch<WalletsResponse>("/api/turnkey/wallets");
  const primary = d?.wallets?.find((w) => w.isPrimary) ?? d?.wallets?.[0];
  if (!primary?.walletId) throw new Error("This account has no wallet to export yet.");
  return primary.walletId;
};

export const exportRecoveryPhrase = async (subOrgId: string, walletId: string): Promise<string[]> => {
  const keyPair = generateP256KeyPair();
  const client = await createPasskeyClient();
  const activity = await client.exportWallet({
    type: "ACTIVITY_TYPE_EXPORT_WALLET",
    timestampMs: String(Date.now()),
    organizationId: subOrgId,
    parameters: { walletId, targetPublicKey: keyPair.publicKeyUncompressed }
  });
  const exportBundle = activity?.activity?.result?.exportWalletResult?.exportBundle;
  if (!exportBundle) throw new Error("Turnkey returned no export bundle.");
  const mnemonic = await decryptExportBundle({
    exportBundle,
    embeddedKey: keyPair.privateKey,
    organizationId: subOrgId,
    returnMnemonic: true
  });
  const words = mnemonic.trim().split(/\s+/);
  if (words.length !== 12 && words.length !== 24) throw new Error("The recovery phrase could not be read.");
  return words;
};

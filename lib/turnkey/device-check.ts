// Prove this phone can sign for the wallet without touching funds or needing
// a funded account: have Turnkey sign a random 32-byte digest with the
// wallet's Stellar ed25519 key (SIGN_RAW_PAYLOAD_V2, the same call the real
// signer makes) and verify it locally against the public key. One Face ID
// prompt, nothing submitted anywhere. Used by the Home setup card, Settings →
// Test signing, and as the gate before money actions.

import { Keypair, hash } from "@stellar/stellar-sdk";
import { getRandomBytes } from "expo-crypto";

import { createPasskeyClient, isNoPasskeyError, isUserCancelledError } from "./client";
import { markDeviceReady } from "./device-ready";

export interface DeviceCheckResult {
  ok: boolean;
  ms: number;
  detail: string;
}

export const verifyDevicePasskey = async (
  subOrgId: string,
  stellarAddress: string
): Promise<DeviceCheckResult> => {
  const started = Date.now();
  const digest = hash(Buffer.from(getRandomBytes(32))); // 32 bytes, looks like a tx hash
  const payload = digest.toString("hex");

  const client = await createPasskeyClient();
  const result = await client.signRawPayload({
    type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
    timestampMs: String(Date.now()),
    organizationId: subOrgId,
    parameters: {
      signWith: stellarAddress,
      payload,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE"
    }
  });
  const sig = result?.activity?.result?.signRawPayloadResult;
  if (!sig?.r || !sig?.s) throw new Error("Turnkey returned no signature.");

  const signature = Buffer.from(sig.r + sig.s, "hex");
  const ok = Keypair.fromPublicKey(stellarAddress).verify(digest, signature);
  if (ok) await markDeviceReady(subOrgId);

  return {
    ok,
    ms: Date.now() - started,
    detail: ok
      ? "Turnkey signed with your passkey and the signature verifies against your Stellar key. Nothing was sent."
      : "Turnkey returned a signature that does not verify against your address."
  };
};

export type EnsureDeviceOutcome = "ready" | "needs-setup" | "cancelled" | "failed";

/**
 * Gate for money actions: resolve "ready" when this phone can sign (cached
 * flag, or one successful Face ID check now); "needs-setup" when iOS has no
 * passkey for the wallet — the caller routes to /setup-device.
 */
export const ensureDeviceReady = async (
  subOrgId: string,
  stellarAddress: string,
  alreadyReady: boolean | null
): Promise<{ outcome: EnsureDeviceOutcome; error?: unknown }> => {
  if (alreadyReady) return { outcome: "ready" };
  try {
    const r = await verifyDevicePasskey(subOrgId, stellarAddress);
    return r.ok ? { outcome: "ready" } : { outcome: "failed" };
  } catch (e) {
    if (isNoPasskeyError(e)) return { outcome: "needs-setup", error: e };
    if (isUserCancelledError(e)) return { outcome: "cancelled", error: e };
    return { outcome: "failed", error: e };
  }
};

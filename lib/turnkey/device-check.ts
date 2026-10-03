// Prove this phone can sign for the wallet without touching funds or needing
// a funded account: have Turnkey sign a random 32-byte digest with one of the
// wallet's keys (SIGN_RAW_PAYLOAD_V2, the same call the real signers make) and
// verify it locally against the address. Any chain works — lazy creation
// means a wallet may hold only BTC, or only ETH (Niko 2026-10-03): Stellar and
// Solana are ed25519 keys, Ethereum and Bitcoin secp256k1 (verified by
// recovering the public key and re-deriving the address). One Face ID prompt,
// nothing submitted anywhere. Used by the Home setup card, Settings → Test
// signing, and as the gate before money actions.

import { Keypair, hash } from "@stellar/stellar-sdk";
import { PublicKey } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { getRandomBytes } from "expo-crypto";

import type { TurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { createPasskeyClient, isNoPasskeyError, isUserCancelledError } from "./client";
import { markDeviceReady } from "./device-ready";

export interface DeviceCheckResult {
  ok: boolean;
  ms: number;
  detail: string;
}

/** The first key this wallet has — the check can use any of them. */
export const signingAddressOf = (wallet: TurnkeyWallet | null | undefined): string | null =>
  wallet?.stellarAddress ?? wallet?.ethereumAddress ?? wallet?.solanaAddress ?? wallet?.bitcoinAddress ?? null;

const hexToBytes = (hex: string) => Uint8Array.from((hex.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));
const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const bech32Hash160 = (address: string): Uint8Array | null => {
  // bc1q + 32 five-bit groups → 20-byte witness program (BIP-173, mainnet P2WPKH only).
  const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const data = address.toLowerCase().slice(4, -6); // drop hrp+sep and the 6-char checksum
  if (data.length !== 33 || data[0] !== "q") return null; // version 0 + 32 groups
  const bits: number[] = [];
  for (const ch of data.slice(1)) {
    const v = CHARSET.indexOf(ch);
    if (v < 0) return null;
    for (let i = 4; i >= 0; i -= 1) bits.push((v >> i) & 1);
  }
  const out = new Uint8Array(20);
  for (let i = 0; i < 20; i += 1) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8).join(""), 2);
  return out;
};

/** Does a Turnkey raw signature over `digest` belong to `address`? */
const verifyForAddress = (address: string, digest: Uint8Array, sig: { r: string; s: string; v?: string }): boolean => {
  const compact = hexToBytes(sig.r.padStart(64, "0") + sig.s.padStart(64, "0"));
  if (/^G[A-Z2-7]{55}$/.test(address)) return Keypair.fromPublicKey(address).verify(Buffer.from(digest), Buffer.from(compact));
  if (/^0x[0-9a-fA-F]{40}$/.test(address) || /^bc1q[a-z0-9]{38,39}$/i.test(address)) {
    const recovered = secp256k1.Signature.fromCompact(compact).addRecoveryBit(parseInt(sig.v ?? "0", 16) & 1).recoverPublicKey(digest);
    if (address.startsWith("0x")) {
      const uncompressed = recovered.toRawBytes(false).slice(1);
      return bytesToHex(keccak_256(uncompressed).slice(-20)) === address.slice(2).toLowerCase();
    }
    const program = bech32Hash160(address);
    return !!program && bytesToHex(ripemd160(sha256(recovered.toRawBytes(true)))) === bytesToHex(program);
  }
  // Solana: base58 ed25519 public key
  return ed25519.verify(compact, digest, new PublicKey(address).toBytes());
};

export const verifyDevicePasskey = async (subOrgId: string, address: string): Promise<DeviceCheckResult> => {
  const started = Date.now();
  const digest = new Uint8Array(hash(Buffer.from(getRandomBytes(32)))); // 32 bytes, looks like a tx hash
  const payload = bytesToHex(digest);

  const client = await createPasskeyClient();
  const result = await client.signRawPayload({
    type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
    timestampMs: String(Date.now()),
    organizationId: subOrgId,
    parameters: {
      signWith: address,
      payload,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE"
    }
  });
  const sig = result?.activity?.result?.signRawPayloadResult;
  if (!sig?.r || !sig?.s) throw new Error("Turnkey returned no signature.");

  let ok = false;
  try {
    ok = verifyForAddress(address, digest, sig);
  } catch {
    ok = false;
  }
  if (ok) await markDeviceReady(subOrgId);

  return {
    ok,
    ms: Date.now() - started,
    detail: ok
      ? `Turnkey signed with your passkey and the signature verifies against your ${address.startsWith("G") ? "Stellar" : address.startsWith("0x") ? "Ethereum" : address.startsWith("bc1") ? "Bitcoin" : "Solana"} key. Nothing was sent.`
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
  address: string,
  alreadyReady: boolean | null
): Promise<{ outcome: EnsureDeviceOutcome; error?: unknown }> => {
  if (alreadyReady) return { outcome: "ready" };
  try {
    const r = await verifyDevicePasskey(subOrgId, address);
    return r.ok ? { outcome: "ready" } : { outcome: "failed" };
  } catch (e) {
    if (isNoPasskeyError(e)) return { outcome: "needs-setup", error: e };
    if (isUserCancelledError(e)) return { outcome: "cancelled", error: e };
    return { outcome: "failed", error: e };
  }
};

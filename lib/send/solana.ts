// Native SOL send — port of web send-adapters/solana.ts. The transfer message
// is built with @solana/web3.js, signed by Turnkey as a raw ed25519 payload
// (SIGN_RAW_PAYLOAD_V2 over serializeMessage(), NO pre-hash), and broadcast
// through POST /api/send/execute (record-before-broadcast, 409 in-flight guard).
// Rent rules live in native-dust.ts (verbatim web): a remainder strictly
// between 0 and the rent minimum is rejected by the network — block it first.

import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

import { createPasskeyClient } from "@/lib/turnkey/client";
import { executeSend } from "./evm";
import {
  SOL_FEE_LAMPORTS,
  SOL_INSUFFICIENT_MESSAGE,
  SOL_RENT_DUST_MESSAGE,
  checkSolRemainder,
  lamportsToSolString,
  solMaxSendLamports
} from "./native-dust";

// Web default: api.mainnet-beta.solana.com 403s non-browser clients; publicnode is keyless.
export const SOL_RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || "https://solana-rpc.publicnode.com";
export const SOL_FEE = Number(SOL_FEE_LAMPORTS) / 1e9;

/** Base58 shape + decodes to 32 bytes (off-curve PDA destinations are valid). */
export const isValidSolAddress = (a: string) => {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return false;
  try {
    return new PublicKey(a).toBytes().length === 32;
  } catch {
    return false;
  }
};

const connection = () => new Connection(SOL_RPC_URL, "confirmed");

/** Exact-lamport MAX from a LIVE balance (display rounding once stranded
 *  lamports in the forbidden rent window, web 2026-08-26). */
export const solMaxSend = async (address: string): Promise<string | null> => {
  const balance = await connection().getBalance(new PublicKey(address), "confirmed");
  const max = solMaxSendLamports(BigInt(balance));
  return max > 0n ? lamportsToSolString(max) : null;
};

const hexToBytes = (hex: string) => {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export const sendSol = async ({
  subOrgId,
  from,
  to,
  amount,
  onStep
}: {
  subOrgId: string;
  from: string;
  to: string;
  amount: number;
  onStep?: (s: "checking" | "building" | "signing" | "submitting") => void;
}): Promise<string> => {
  if (!isValidSolAddress(to)) throw new Error("Enter a valid Solana address.");
  const lamports = Math.round(amount * 1e9);
  if (!lamports || lamports <= 0) throw new Error("Enter an amount.");

  onStep?.("checking");
  const conn = connection();
  const fromPubkey = new PublicKey(from);
  const balance = await conn.getBalance(fromPubkey, "confirmed");
  const verdict = checkSolRemainder(BigInt(balance), BigInt(lamports));
  if (verdict === "insufficient") throw new Error(SOL_INSUFFICIENT_MESSAGE);
  if (verdict === "rent-dust") throw new Error(SOL_RENT_DUST_MESSAGE);

  onStep?.("building");
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey, toPubkey: new PublicKey(to), lamports }));
  // Public RPCs 429 routinely — one quiet retry before failing the send.
  const { blockhash } = await conn.getLatestBlockhash("confirmed").catch(async () => {
    await new Promise((r) => setTimeout(r, 800));
    return conn.getLatestBlockhash("confirmed");
  });
  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPubkey;
  const message = tx.serializeMessage();

  onStep?.("signing");
  const turnkey = await createPasskeyClient();
  const result = await turnkey.signRawPayload({
    type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
    timestampMs: String(Date.now()),
    organizationId: subOrgId,
    parameters: {
      signWith: from,
      payload: bytesToHex(message),
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE"
    }
  });
  const sig = result?.activity?.result?.signRawPayloadResult;
  if (!sig?.r || !sig?.s) throw new Error("Signing failed — no signature returned");
  const signature = new Uint8Array(64);
  signature.set(hexToBytes(sig.r.padStart(64, "0")), 0);
  signature.set(hexToBytes(sig.s.padStart(64, "0")), 32);
  tx.addSignature(fromPubkey, Buffer.from(signature));
  if (!tx.verifySignatures()) throw new Error("Signature verification failed");

  onStep?.("submitting");
  return executeSend({
    chain: "solana",
    signedTx: Buffer.from(tx.serialize()).toString("base64"),
    symbol: "SOL",
    amount: String(amount),
    destination: to
  });
};

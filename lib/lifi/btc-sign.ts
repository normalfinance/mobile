// Signing LI.FI's Bitcoin PSBT without asking Turnkey to parse it — port of
// web lib/lifi/btc-sign.ts + btc-spend-verdict.ts (docs/audit/44).
//
// WHY: Turnkey's PSBT parser derives an address from every script and fails on
// LI.FI's OP_RETURN memo output ("UnrecognizedScript"). Turnkey's own docs give
// the way around it: compute the BIP-143 sighashes locally and sign them with
// SIGN_RAW_PAYLOADS (HASH_FUNCTION_NO_OP), reinserting with bitcoinjs-lib.
//
// HARD RULE 8: this NEVER modifies the transaction. Outputs, inputs, amounts
// and ordering are untouched — we only add signatures. Altering a Chainflip
// PSBT's outputs can make a deposit unrefundable; the loss is permanent.

import { secp256k1 } from "@noble/curves/secp256k1";
import { Psbt, Transaction, networks, payments, script } from "bitcoinjs-lib";

import { apiFetch } from "@/lib/api";
import { createPasskeyClient } from "@/lib/turnkey/client";

/** secp256k1 curve order, for low-S normalisation. */
const SECP256K1_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
const SECP256K1_HALF_N = SECP256K1_N / 2n;

const hexToBytes = (hex: string): Uint8Array => Uint8Array.from((hex.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));
const bytesToHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Bitcoin consensus requires S in the lower half of the curve order (BIP-62).
 * A high-S signature is valid cryptographically but non-standard, so relays
 * drop it — the transaction would look broadcast yet never appear. Turnkey
 * does not guarantee low-S, so normalise here.
 */
const normaliseLowS = (r: string, s: string): Uint8Array => {
  let sBig = BigInt(`0x${s}`);
  if (sBig > SECP256K1_HALF_N) sBig = SECP256K1_N - sBig;
  return hexToBytes(r.padStart(64, "0") + sBig.toString(16).padStart(64, "0"));
};

/** The user's compressed public key, read from Turnkey via the server (never derived client-side). */
const fetchBitcoinPublicKey = async (): Promise<{ publicKey: Uint8Array; address: string }> => {
  const data = await apiFetch<{ publicKey?: string; address?: string; error?: string }>("/api/turnkey/btc-pubkey");
  if (!data?.publicKey || !data.address) throw new Error(data?.error ?? "Could not fetch the Bitcoin public key");
  return { publicKey: hexToBytes(data.publicKey), address: data.address };
};

// --- the ONE pre-sign invariant that holds for every bridge -----------------
// A Bitcoin swap must not SPEND materially more than it quoted. Structure-
// agnostic on purpose: a real LI.FI PSBT (2026-08-27) had FIVE outputs (bridge
// deposit, OP_RETURN memo, our change, the route's protocol fee, our own
// integrator-fee wallet) and the shape differs per route. Counting outputs is
// not a safe invariant; this is.
export interface PsbtSpendVerdict {
  ok: boolean;
  /** Sats actually leaving this wallet: inputs minus what comes back to us. */
  spent: bigint;
  /** The most we accept for this quote (amount + fee headroom). */
  limit: bigint;
}
export const psbtSpendVerdict = (args: { inputsTotalSat: bigint; backToUsSat: bigint; quotedSat: bigint }): PsbtSpendVerdict => {
  const spent = args.inputsTotalSat - args.backToUsSat;
  // Headroom covers the miner fee plus route/integrator fees. Measured against
  // a real quote: a 37,965 sat swap spent 39,203 (+3.3%). The floor keeps
  // small swaps — where the miner fee dominates — from tripping it.
  const quarter = args.quotedSat / 4n;
  const allowance = quarter > 10_000n ? quarter : 10_000n;
  const limit = args.quotedSat + allowance;
  return { ok: spent >= 0n && spent <= limit, spent, limit };
};

/**
 * Signs every input of `psbtHex` that belongs to `bitcoinAddress`; returns the
 * signed PSBT as hex (POST turnkey/broadcast-btc finalises and extracts).
 * `expectedDepositSat` is the quote's amount — a missing or zero cap THROWS,
 * it never silently disables the spend limit (web doc 95 Wave 6).
 */
export const signLifiBtcPsbt = async (psbtHex: string, bitcoinAddress: string, subOrgId: string, expectedDepositSat: bigint): Promise<string> => {
  if (expectedDepositSat <= 0n) throw new Error("Refusing to sign: no quoted amount to check this transaction against");
  const network = networks.bitcoin;
  const psbt = Psbt.fromHex(psbtHex, { network });

  const { publicKey, address: turnkeyAddress } = await fetchBitcoinPublicKey();
  if (turnkeyAddress !== bitcoinAddress) throw new Error(`Bitcoin account mismatch: signing ${bitcoinAddress} but Turnkey returned ${turnkeyAddress}`);

  // The key must derive the address before it can influence a signature.
  const ourPayment = payments.p2wpkh({ pubkey: publicKey, network });
  if (ourPayment.address !== bitcoinAddress) throw new Error(`Public key does not match ${bitcoinAddress} (derives ${ourPayment.address}) — refusing to sign`);
  const ourScript = ourPayment.output;
  if (!ourScript) throw new Error("Could not derive our output script");

  // bitcoinjs exposes hashForWitnessV0 (BIP-143) — never hand-rolled.
  const unsignedTx = Transaction.fromBuffer(psbt.data.globalMap.unsignedTx.toBuffer());
  // P2WPKH is signed against the corresponding P2PKH script (BIP-143).
  const scriptCode = payments.p2pkh({ pubkey: publicKey, network }).output;
  if (!scriptCode) throw new Error("Could not derive the script code");

  const isOurs = (s: Uint8Array) => bytesEqual(s, ourScript);

  // Turnkey's documented rule for P2WPKH: witness_utxo required,
  // non_witness_utxo forbidden. Name the broken rule before signing.
  psbt.data.inputs.forEach((input, index) => {
    if (input.nonWitnessUtxo && input.witnessUtxo && /^0014[0-9a-f]{40}$/i.test(bytesToHex(input.witnessUtxo.script))) {
      throw new Error(`PSBT input ${index} carries non_witness_utxo on a P2WPKH input (LI.FI PSBT format issue)`);
    }
  });

  // Verify BEFORE signing: what leaves THIS wallet may not exceed the quote.
  // `allInputsOurs === false` legitimately skips (LI.FI may combine another
  // party's UTXOs); the per-input loop still refuses anything unclassifiable.
  const allInputsOurs = psbt.data.inputs.every((i) => i.witnessUtxo && isOurs(i.witnessUtxo.script));
  if (allInputsOurs) {
    const inTotal = psbt.data.inputs.reduce((sum, i) => sum + BigInt(i.witnessUtxo!.value), 0n);
    const backToUs = unsignedTx.outs.reduce((sum, o) => (isOurs(o.script) ? sum + BigInt(o.value) : sum), 0n);
    const verdict = psbtSpendVerdict({ inputsTotalSat: inTotal, backToUsSat: backToUs, quotedSat: expectedDepositSat });
    if (!verdict.ok) {
      throw new Error(`Refusing to sign: this transaction spends ${verdict.spent} sats but the quote was ${expectedDepositSat} sats (limit ${verdict.limit})`);
    }
  }

  const toSign: { index: number; sighash: Uint8Array; sighashType: number }[] = [];
  psbt.data.inputs.forEach((input, index) => {
    const witnessUtxo = input.witnessUtxo;
    if (!witnessUtxo) {
      // An input we cannot read is an input we cannot classify. If it is ours
      // we would hand back a PARTIALLY signed PSBT that fails at broadcast.
      const prev = input.nonWitnessUtxo;
      if (prev) {
        const prevTx = Transaction.fromBuffer(prev);
        const vout = unsignedTx.ins[index]?.index ?? -1;
        const prevOut = prevTx.outs[vout];
        if (prevOut && isOurs(prevOut.script)) {
          throw new Error(`Refusing to sign: input ${index} is ours but carries no witness_utxo — this wallet can only sign segwit (P2WPKH) inputs`);
        }
      }
      return;
    }
    if (!isOurs(witnessUtxo.script)) return; // another party's input — not ours to sign
    // Honour a declared sighash type instead of assuming SIGHASH_ALL.
    const sighashType = input.sighashType ?? Transaction.SIGHASH_ALL;
    const sighash = unsignedTx.hashForWitnessV0(index, scriptCode, witnessUtxo.value, sighashType);
    toSign.push({ index, sighash, sighashType });
  });
  if (toSign.length === 0) throw new Error(`No PSBT inputs belong to ${bitcoinAddress} — nothing to sign`);

  // ONE activity for all inputs → a single passkey prompt however many UTXOs.
  const turnkey = await createPasskeyClient();
  const result = await turnkey.signRawPayloads({
    type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOADS",
    timestampMs: String(Date.now()),
    organizationId: subOrgId,
    parameters: {
      signWith: bitcoinAddress,
      payloads: toSign.map((t) => bytesToHex(t.sighash)),
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      // The payload is already a sighash (double-SHA256) — sign as-is.
      hashFunction: "HASH_FUNCTION_NO_OP"
    }
  });
  const signatures = result?.activity?.result?.signRawPayloadsResult?.signatures;
  if (!signatures || signatures.length !== toSign.length) {
    throw new Error(`Turnkey returned ${signatures?.length ?? 0} signatures for ${toSign.length} inputs`);
  }

  toSign.forEach(({ index, sighashType }, i) => {
    const sig = signatures[i];
    if (!sig?.r || !sig?.s) throw new Error(`Missing r/s in signature ${i}`);
    const compact = normaliseLowS(sig.r, sig.s);
    // DER encoding + the sighash byte the input actually declared.
    psbt.updateInput(index, { partialSig: [{ pubkey: publicKey, signature: script.signature.encode(compact, sighashType) }] });
  });

  // Each signature must validate against the sighash it was produced for —
  // caught here rather than as a silent broadcast failure.
  toSign.forEach(({ index }) => {
    const valid = psbt.validateSignaturesOfInput(index, (pubkey, msghash, signature) => secp256k1.verify(signature, msghash, pubkey));
    if (!valid) throw new Error(`Signature for input ${index} failed validation — not broadcasting`);
  });

  return psbt.toHex();
};

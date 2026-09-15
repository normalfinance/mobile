// Executes a LI.FI quote's transactionRequest on the SOURCE chain, signed by
// the Turnkey passkey — port of web lib/lifi/execute.ts (ETH, SOL, and BTC via
// the local-sighash signer in ./btc-sign.ts — hard rule 8 lives there).

import { createPublicClient, fallback, http, serializeTransaction } from "viem";
import { mainnet } from "viem/chains";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

import { apiFetch } from "@/lib/api";
import { ETH_RPC_URL, signWithRetryEvm } from "@/lib/send/evm";
import { SOL_RPC_URL } from "@/lib/send/solana";
import { createPasskeyClient } from "@/lib/turnkey/client";

export const LIFI_CHAIN_IDS = { ETH: 1, SOL: 1151111081099710, BTC: 20000000000001, BASE: 8453 } as const;

export interface LifiQuote {
  tool?: string;
  action: { fromChainId: number; toChainId: number; fromAmount: string };
  estimate: { toAmount: string; toAmountMin: string; executionDuration: number; gasCosts?: { amountUSD?: string }[] };
  transactionRequest: {
    data: string;
    to?: string;
    value?: string;
    chainId?: number;
    gasPrice?: string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
}

export interface LifiQuoteResponse {
  success: boolean;
  error?: string;
  quote?: LifiQuote;
  feePercent?: number;
}

/** POST lifi/quote (public, IP-limited); one quiet retry on 429/5xx (web). */
export const fetchLifiQuote = async (body: {
  fromSymbol: string;
  toSymbol: string;
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
}): Promise<LifiQuoteResponse> => {
  let last: LifiQuoteResponse = { success: false, error: "Failed to fetch quote" };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      last = await apiFetch<LifiQuoteResponse>("/api/lifi/quote", { anonymous: true, body });
      if (last.success) return last;
      return last;
    } catch (e) {
      const status = (e as { status?: number })?.status ?? 0;
      last = { success: false, error: e instanceof Error ? e.message : "Failed to fetch quote" };
      if (!(status === 429 || status >= 500 || status === 0) || attempt === 1) break;
      await new Promise((r) => setTimeout(r, 6_000));
    }
  }
  return last;
};

// --- gas affordability (web lib/lifi/gas-shortfall.ts) ---------------------
export class GasShortfallError extends Error {
  balanceWei: bigint;
  costWei: bigint;
  valueWei: bigint;
  constructor(o: { balanceWei: bigint; costWei: bigint; valueWei: bigint }) {
    super("Not enough ETH to cover this swap plus its network fee.");
    this.name = "GasShortfallError";
    this.balanceWei = o.balanceWei;
    this.costWei = o.costWei;
    this.valueWei = o.valueWei;
  }
}
/** The node's admission rule, run locally BEFORE the passkey: balance ≥ value + gas×price. */
export const computeAffordability = (o: { balanceWei: bigint; valueWei: bigint; gasLimit: bigint; feePerGas: bigint }) => {
  const costWei = o.gasLimit * o.feePerGas;
  return { affordable: o.balanceWei >= o.valueWei + costWei, costWei };
};
/** The most ETH the user can put into the swap and still pay its gas. */
export const maxAffordableEth = (e: GasShortfallError): string => {
  const spendable = e.balanceWei - e.costWei;
  return spendable > 0n ? (Number(spendable) / 1e18).toFixed(6) : "0";
};

const hexToBytes = (hex: string) => {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

// --- Ethereum source ----------------------------------------------------------
const executeEvm = async (quote: LifiQuote, ethereumAddress: string, subOrgId: string): Promise<string> => {
  const tx = quote.transactionRequest;
  const client = createPublicClient({ chain: mainnet, transport: fallback([http(ETH_RPC_URL), http("https://eth.llamarpc.com")]) });
  const from = ethereumAddress as `0x${string}`;
  const to = tx.to as `0x${string}`;
  const value = BigInt(tx.value ?? "0");
  const data = tx.data as `0x${string}`;
  const nonce0 = await client.getTransactionCount({ address: from, blockTag: "pending" });
  const gas = tx.gasLimit ? BigInt(tx.gasLimit) : await client.estimateGas({ account: from, to, value, data });

  // Re-price to the live network fee, never below what LI.FI intended: a
  // stale quoted price gets the tx dropped from the mempool and never mined.
  const max = (a: bigint, b: bigint) => (a > b ? a : b);
  const liveFees = await client.estimateFeesPerGas().catch(() => null);
  const legacyPrice = tx.gasPrice ? max(BigInt(tx.gasPrice), await client.getGasPrice().catch(() => 0n)) : null;
  const maxFeePerGas = max(BigInt(tx.maxFeePerGas ?? "0"), liveFees?.maxFeePerGas ?? 0n);
  if (!legacyPrice && maxFeePerGas === 0n) {
    throw new Error("Could not determine a network fee for this swap — the network did not respond with a gas price. Nothing was signed; please try again.");
  }

  // Affordability BEFORE the passkey (two read attempts on the fallback pool).
  let balanceWei: bigint | null = null;
  for (let attempt = 0; attempt < 2 && balanceWei === null; attempt += 1) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 400));
    balanceWei = await client.getBalance({ address: from }).catch(() => null);
  }
  if (balanceWei !== null) {
    const check = computeAffordability({ balanceWei, valueWei: value, gasLimit: gas, feePerGas: legacyPrice ?? maxFeePerGas });
    if (!check.affordable) throw new GasShortfallError({ balanceWei, costWei: check.costWei, valueWei: value });
  }

  const buildUnsigned = (nonce: number) =>
    legacyPrice
      ? serializeTransaction({ chainId: tx.chainId ?? mainnet.id, nonce, to, value, data, gas, type: "legacy", gasPrice: legacyPrice })
      : serializeTransaction({
          chainId: tx.chainId ?? mainnet.id,
          nonce,
          to,
          value,
          data,
          gas,
          type: "eip1559",
          maxFeePerGas,
          maxPriorityFeePerGas: max(BigInt(tx.maxPriorityFeePerGas ?? "0"), liveFees?.maxPriorityFeePerGas ?? 0n)
        });

  const turnkey = await createPasskeyClient();
  let hash: `0x${string}` | null = null;
  for (let attempt = 0; hash === null; attempt += 1) {
    const nonce = attempt === 0 ? nonce0 : await client.getTransactionCount({ address: from, blockTag: "pending" });
    const unsigned = buildUnsigned(nonce);
    const signed = await signWithRetryEvm(() =>
      turnkey.signTransaction({
        type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
        timestampMs: String(Date.now()),
        organizationId: subOrgId,
        parameters: { signWith: ethereumAddress, unsignedTransaction: unsigned.startsWith("0x") ? unsigned.slice(2) : unsigned, type: "TRANSACTION_TYPE_ETHEREUM" }
      })
    );
    try {
      hash = await client.sendRawTransaction({ serializedTransaction: (signed.startsWith("0x") ? signed : `0x${signed}`) as `0x${string}` });
    } catch (e) {
      const m = String((e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? "");
      // Nonce race: rebuild + ONE more signature (the signature covers the nonce).
      if (attempt === 0 && /nonce too low|already known|replacement transaction underpriced/i.test(m)) continue;
      throw e;
    }
  }
  return hash;
};

// --- Solana source ------------------------------------------------------------
const executeSol = async (quote: LifiQuote, solanaAddress: string, subOrgId: string): Promise<string> => {
  const raw = Uint8Array.from(Buffer.from(quote.transactionRequest.data, "base64"));
  const connection = new Connection(SOL_RPC_URL, "confirmed");
  const userKey = new PublicKey(solanaAddress);
  // LI.FI returns a v0 VersionedTransaction (deserialize handles legacy too;
  // never fall back to Transaction.from — it throws on v0 and masks the error).
  const vtx = VersionedTransaction.deserialize(raw);
  const signerIndex = vtx.message.staticAccountKeys.findIndex((k) => k.equals(userKey));
  if (signerIndex < 0) throw new Error("Your wallet is not a signer on this transaction");

  const turnkey = await createPasskeyClient();
  const result = await turnkey.signRawPayload({
    type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
    timestampMs: String(Date.now()),
    organizationId: subOrgId,
    parameters: {
      signWith: solanaAddress,
      payload: bytesToHex(vtx.message.serialize()),
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE"
    }
  });
  const sig = result?.activity?.result?.signRawPayloadResult;
  if (!sig?.r || !sig?.s) throw new Error("Signing failed — no signature returned");
  const signature = new Uint8Array(64);
  signature.set(hexToBytes(sig.r.padStart(64, "0")), 0);
  signature.set(hexToBytes(sig.s.padStart(64, "0")), 32);
  vtx.signatures[signerIndex] = signature;
  return connection.sendRawTransaction(vtx.serialize(), { skipPreflight: false });
};

// --- Bitcoin source -----------------------------------------------------------
// Every PSBT starts with the magic bytes "psbt\xff" (70736274ff), which is why
// a base64 PSBT always begins "cHNidP8". LI.FI hands it over base64; the signer
// and the broadcast route want hex. Detect by magic bytes — silently mangling
// a PSBT is the one thing we must not do here.
const PSBT_MAGIC_HEX = /^70736274ff/i;
const psbtToHex = (data: string): string => {
  const raw = data.startsWith("0x") ? data.slice(2) : data;
  if (PSBT_MAGIC_HEX.test(raw)) return raw;
  const hex = bytesToHex(Uint8Array.from(Buffer.from(raw, "base64")));
  if (PSBT_MAGIC_HEX.test(hex)) return hex;
  throw new Error("Unrecognised PSBT encoding from LI.FI — expected hex or base64");
};

const executeBtc = async (quote: LifiQuote, bitcoinAddress: string, subOrgId: string): Promise<string> => {
  // The PSBT from LI.FI — re-encoded if needed, never rebuilt or reordered.
  const psbtHex = psbtToHex(quote.transactionRequest.data);
  // The spend cap is the quote's amount; an unreadable cap is a reason to
  // stop, not to sign (web doc 95 Wave 6).
  let sat: bigint;
  try {
    sat = BigInt(quote.action.fromAmount);
  } catch {
    throw new Error(`Refusing to sign: the quote's amount (${String(quote.action.fromAmount)}) is unreadable, so the spend limit cannot be checked`);
  }
  // Loaded on demand: bitcoinjs-lib only matters to Bitcoin-source swaps.
  const { signLifiBtcPsbt } = await import("./btc-sign");
  const signedTxHex = await signLifiBtcPsbt(psbtHex, bitcoinAddress, subOrgId, sat);
  // The server finalises + extracts + broadcasts; idempotent by the txid of
  // the signed transaction (a retry can never double-spend).
  const data = await apiFetch<{ txid?: string; error?: string }>("/api/turnkey/broadcast-btc", { body: { signedTxHex } });
  if (!data?.txid) throw new Error(data?.error ?? "Broadcast failed");
  return data.txid;
};

/** Sign + broadcast the source leg; returns the tx hash / signature. */
export const executeLifiSwap = async (
  quote: LifiQuote,
  addresses: { ethereumAddress: string | null; solanaAddress: string | null; bitcoinAddress: string | null },
  subOrgId: string
): Promise<string> => {
  switch (quote.action.fromChainId) {
    case LIFI_CHAIN_IDS.ETH:
      if (!addresses.ethereumAddress) throw new Error("Missing Ethereum address");
      return executeEvm(quote, addresses.ethereumAddress, subOrgId);
    case LIFI_CHAIN_IDS.SOL:
      if (!addresses.solanaAddress) throw new Error("Missing Solana address");
      return executeSol(quote, addresses.solanaAddress, subOrgId);
    case LIFI_CHAIN_IDS.BTC:
      if (!addresses.bitcoinAddress) throw new Error("Missing Bitcoin address");
      return executeBtc(quote, addresses.bitcoinAddress, subOrgId);
    default:
      throw new Error(`Unsupported source chain ${quote.action.fromChainId}`);
  }
};

/** Source-leg verdict from lifi/status (web lifi-verdict.ts). */
export const lifiSourceVerdict = async (txHash: string, fromChain: number, toChain: number): Promise<"REFUNDED" | "FAILED" | "DONE" | null> => {
  try {
    const d = await apiFetch<{ status?: { status?: string; substatus?: string } }>("/api/lifi/status", { query: { txHash, fromChain, toChain } });
    const st = String(d?.status?.status ?? "").toUpperCase();
    const sub = String(d?.status?.substatus ?? "").toUpperCase();
    if (st === "DONE") return sub === "REFUNDED" || sub === "PARTIAL" ? "REFUNDED" : "DONE";
    if (st === "FAILED" || st === "INVALID") return "FAILED";
  } catch {
    /* transient */
  }
  return null;
};

/** ETH to leave behind for a source-chain swap's gas: live gas price × limit ×
 *  1.6, clamped [0.0005, 0.02]; 0.003 if the RPC fails (web gas-reserve.ts).
 *  The swap card passes 550_000 gas (web swap-card.tsx:192 — the helper's own
 *  250k default and a stale "400k" comment are NOT what runs). */
export const ethGasReserve = async (gasLimit = 550_000n): Promise<number> => {
  try {
    const client = createPublicClient({ chain: mainnet, transport: http(ETH_RPC_URL) });
    const gasPrice = await client.getGasPrice();
    const cost = Number((gasPrice * gasLimit * 16n) / 10n) / 1e18;
    return Math.min(Math.max(cost, 0.0005), 0.02);
  } catch {
    return 0.003;
  }
};

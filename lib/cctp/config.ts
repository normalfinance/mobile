// Circle CCTP V2 constants — verbatim from web lib/cctp/config.ts, addresses.ts,
// decimals.ts, hookdata.ts (mainnet only; testnet is discontinued here).
// Phase-0 spike (2026-07-07) validated every value end to end.

import { StrKey } from "@stellar/stellar-sdk";

export const CCTP_DOMAIN = { ethereum: 0, solana: 5, base: 6, stellar: 27 } as const;

/** Standard transfer (no Circle fee): attest at hard finality. */
export const CCTP_MAX_FEE = 0n;
export const CCTP_MIN_FINALITY_THRESHOLD = 2000;

export const STELLAR_CCTP = {
  tokenMessengerMinter: "CAE2G5Z77UP7GYPYGFOWFGW7C7J6I4YP2AFGSADRKQY62SYUFLPNFTXL",
  messageTransmitter: "CACMENFFJPJMSDAJQLX4R7K3SFZIW2LJSE3R2UMLGSWHFHS353FVXAZV",
  cctpForwarder: "CBZL2IH7F6BIDAA3WBNXYKIXSATJGMSW7K5P5MJ6STX5RXN47TZJDF5T",
  usdcIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
} as const;

export const EVM_CCTP = {
  tokenMessengerV2: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
  messageTransmitterV2: "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"
} as const;

/** Native USDC on Base mainnet. */
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

export const CCTP_ETA_SECONDS = { fromStellar: 30, fromEvm: 19 * 60 } as const;

/** The three ERC-20 functions the Base legs use (typed narrowly on purpose). */
export const ERC20_MIN_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }
] as const;

/** Soroban RPC for the burn (web utils default: rpc.lightsail.network). */
export const SOROBAN_RPC_URL = process.env.EXPO_PUBLIC_MAINNET_RPC_URL || "https://rpc.lightsail.network/";
/** Base RPC pool (web rpc-fallback.ts). */
export const BASE_RPC_URLS: string[] = [
  ...(process.env.EXPO_PUBLIC_BASE_RPC_URL ? [process.env.EXPO_PUBLIC_BASE_RPC_URL] : []),
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com"
];

export type CrosschainSymbol = "BTC" | "ETH" | "SOL";
export const NATIVE_DECIMALS: Record<CrosschainSymbol, number> = { BTC: 8, ETH: 18, SOL: 9 };
export const NATIVE_CHAIN: Record<CrosschainSymbol, "bitcoin" | "ethereum" | "solana"> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana"
};
/** Cross-chain settlement windows, minutes (web chains/registry.ts). */
export const SETTLEMENT_MAX_MINUTES: Record<CrosschainSymbol, number> = { BTC: 60, ETH: 5, SOL: 3 };

// --- decimals (web decimals.ts) --------------------------------------------
/** Human USDC ("12.34") → 6-dp wire units. Throws on >6 decimals. */
export const usdcToWire = (amount: string): bigint => {
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error(`invalid USDC amount: ${amount}`);
  const [whole, frac = ""] = amount.split(".");
  if (frac.length > 6) throw new Error(`USDC supports at most 6 decimals: ${amount}`);
  return BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(6, "0"));
};
export const wireToUsdc = (wire: bigint): string => {
  const whole = wire / 1_000_000n;
  const frac = (wire % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
};
/** Wire units → Stellar SAC 7-dp units. */
export const wireToStellar7 = (wire: bigint): bigint => wire * 10n;

// --- addresses (web addresses.ts) ------------------------------------------
/** EVM address → 32-byte Uint8Array (Soroban BytesN<32>, left-padded). */
export const evmAddressToBytes = (address: string): Uint8Array => {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error(`not an EVM address: ${address}`);
  const out = new Uint8Array(32);
  const addr = address.slice(2);
  for (let i = 0; i < 20; i += 1) out[12 + i] = parseInt(addr.slice(i * 2, i * 2 + 2), 16);
  return out;
};
/** Stellar contract strkey (C…) → bytes32 hex. */
export const stellarContractToBytes32 = (contractId: string): `0x${string}` =>
  `0x${Buffer.from(StrKey.decodeContract(contractId)).toString("hex")}`;

// --- hookData (web hookdata.ts) — for Base → Stellar burns (refunds) ---------
// bytes 0–23 zero magic · 24–27 version 0 · 28–31 recipient length · 32+ strkey ASCII
export const encodeStellarHookData = (recipientStrkey: string): Uint8Array => {
  if (!/^[GMC][A-Z2-7]{10,}$/.test(recipientStrkey)) throw new Error(`not a Stellar strkey: ${recipientStrkey}`);
  const recipient = new TextEncoder().encode(recipientStrkey);
  const out = new Uint8Array(32 + recipient.length);
  new DataView(out.buffer).setUint32(28, recipient.length, false);
  out.set(recipient, 32);
  return out;
};
export const bytesToHex = (b: Uint8Array): `0x${string}` => `0x${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;

// --- phase table (web sections/swap/cctp-phase.ts, verbatim) -----------------
export type Phase = "hidden" | "auto" | "halt-receive" | "halt-finish";
export interface PhaseFields {
  status: string;
  direction: string;
  srcSwapTxHash: string | null;
  burnTxHash: string | null;
  mintTxHash: string | null;
  dstSwapTxHash: string | null;
}
export const bannerPhase = (tr: PhaseFields): Phase => {
  if (tr.status === "REFUNDED" || tr.status === "FAILED") return "hidden";
  const outbound = tr.direction === "stellar_to_crosschain";
  if (outbound) {
    if (tr.dstSwapTxHash) return "hidden";
    if (!tr.burnTxHash) return "hidden";
    if (tr.mintTxHash || tr.status === "COMPLETED") return "halt-finish";
    return "hidden";
  }
  if (tr.status === "COMPLETED") return "hidden";
  if (tr.burnTxHash) return "auto";
  if (tr.srcSwapTxHash) return "halt-receive";
  return "hidden";
};

// --- failure grammar (web failure-class.ts, the parse side) -----------------
export const parseFailedTool = (errorDetail: string | null | undefined): string | null =>
  errorDetail ? (/route failed on Base via ([a-zA-Z0-9_-]{1,32})/.exec(errorDetail)?.[1] ?? null) : null;
export const parseFailedExchanges = (errorDetail: string | null | undefined): string[] => {
  const m = errorDetail ? / through ([a-zA-Z0-9_+-]{1,140})/.exec(errorDetail) : null;
  return m ? m[1].split("+").filter((x) => /^[a-zA-Z0-9_-]{1,32}$/.test(x)).slice(0, 4) : [];
};

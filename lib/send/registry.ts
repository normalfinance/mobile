// What the Send screen needs to know per sendable asset — the mobile analogue
// of web lib/chains/registry.ts (explorer, validation, placeholder) + the
// send-adapter contract (fee label, memo, spendable). Money rules stay in the
// per-chain engines; this file is display + dispatch only.

import type { WalletChain } from "@/hooks/use-turnkey-wallet";
import { isValidStellarAddress } from "@/lib/stellar/send";
import { isValidBtcAddress } from "./bitcoin";
import { isValidEthAddress } from "./evm";
import { isValidSolAddress } from "./solana";

export type SendSymbol = "XLM" | "USDC" | "BTC" | "ETH" | "SOL";

export interface SendAssetMeta {
  symbol: SendSymbol;
  chain: WalletChain;
  name: string;
  hasMemo: boolean;
  placeholder: string;
  feeLabel: string;
  validateAddress: (a: string) => boolean;
  explorerTx: (hash: string) => string;
}

export const SEND_ASSETS: Record<SendSymbol, SendAssetMeta> = {
  XLM: {
    symbol: "XLM",
    chain: "stellar",
    name: "Stellar Lumens",
    hasMemo: true,
    placeholder: "G…",
    feeLabel: "0.0002 XLM",
    validateAddress: isValidStellarAddress,
    explorerTx: (h) => `https://stellar.expert/explorer/public/tx/${h}`
  },
  USDC: {
    symbol: "USDC",
    chain: "stellar",
    name: "USD Coin",
    hasMemo: true,
    placeholder: "G…",
    feeLabel: "0.0002 XLM",
    validateAddress: isValidStellarAddress,
    explorerTx: (h) => `https://stellar.expert/explorer/public/tx/${h}`
  },
  BTC: {
    symbol: "BTC",
    chain: "bitcoin",
    name: "Bitcoin",
    hasMemo: false,
    placeholder: "bc1q…",
    feeLabel: "network fee at send",
    validateAddress: isValidBtcAddress,
    explorerTx: (h) => `https://mempool.space/tx/${h}`
  },
  ETH: {
    symbol: "ETH",
    chain: "ethereum",
    name: "Ethereum",
    hasMemo: false,
    placeholder: "0x…",
    feeLabel: "gas, estimated at send",
    validateAddress: isValidEthAddress,
    explorerTx: (h) => `https://etherscan.io/tx/${h}`
  },
  SOL: {
    symbol: "SOL",
    chain: "solana",
    name: "Solana",
    hasMemo: false,
    placeholder: "Solana address…",
    feeLabel: "0.000005 SOL",
    validateAddress: isValidSolAddress,
    explorerTx: (h) => `https://solscan.io/tx/${h}`
  }
};

export const SEND_ORDER: SendSymbol[] = ["XLM", "USDC", "BTC", "ETH", "SOL"];

export interface ScannedPayment {
  destination: string;
  memo?: string;
  amount?: string;
  symbol?: SendSymbol;
}

/**
 * Decode a scanned QR for a non-Stellar chain: bare address, or a BIP-21 /
 * EIP-681 / `solana:` URI. Stellar is handled by lib/stellar/qr.ts.
 */
export const parseChainQr = (raw: string, symbol: SendSymbol): ScannedPayment | { error: string } => {
  const text = raw.trim();
  const meta = SEND_ASSETS[symbol];
  if (!text) return { error: "Empty QR code." };
  if (meta.validateAddress(text)) return { destination: text, symbol };
  const m = /^(bitcoin|ethereum|solana):([^?]+)(?:\?(.*))?$/i.exec(text);
  if (!m) return { error: `That QR code is not a ${meta.name} address.` };
  const scheme = m[1].toLowerCase();
  const addr = m[2].split("@")[0]; // EIP-681 may carry @chainId
  const expected = meta.chain === "bitcoin" ? "bitcoin" : meta.chain === "ethereum" ? "ethereum" : "solana";
  if (scheme !== expected) return { error: `That QR code is for ${scheme}, not ${meta.name}.` };
  if (!meta.validateAddress(addr)) return { error: `That QR code holds an invalid ${meta.name} address.` };
  const params = new URLSearchParams(m[3] ?? "");
  const amount = params.get("amount") ?? params.get("value");
  const result: ScannedPayment = { destination: addr, symbol };
  if (amount && /^\d+(\.\d+)?$/.test(amount) && Number(amount) > 0) {
    // EIP-681 `value` is in wei; BIP-21 / solana amounts are in coin units.
    result.amount = scheme === "ethereum" && params.get("value") ? String(Number(amount) / 1e18) : amount;
  }
  return result;
};

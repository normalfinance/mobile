// The Activity row → detail hand-off: a Transaction travels as route params
// (strings), so the detail screen needs no shared store and survives reloads.

import type { Transaction } from "@/services/portfolio.service";

export type TxParams = {
  id: string;
  type: string;
  asset: string;
  amount: string;
  usdValue: string;
  timestamp: string;
  status: string;
  chain?: string;
  txHash?: string;
  counterparty?: string;
};

export const toTxParams = (tx: Transaction): TxParams => ({
  id: tx.id,
  type: tx.type,
  asset: tx.asset,
  amount: String(tx.amount),
  usdValue: String(tx.usdValue ?? 0),
  timestamp: String(tx.timestamp.getTime()),
  status: tx.status,
  ...(tx.chain ? { chain: tx.chain } : {}),
  ...(tx.txHash ? { txHash: tx.txHash } : {}),
  ...(tx.counterparty ? { counterparty: tx.counterparty } : {})
});

const EXPLORER: Record<string, (h: string) => string> = {
  stellar: (h) => `https://stellar.expert/explorer/public/tx/${h}`,
  bitcoin: (h) => `https://mempool.space/tx/${h}`,
  ethereum: (h) => `https://etherscan.io/tx/${h}`,
  solana: (h) => `https://solscan.io/tx/${h}`,
  base: (h) => `https://basescan.org/tx/${h}`
};
export const explorerUrl = (chain: string | undefined, hash: string): string | null => (chain && EXPLORER[chain] ? EXPLORER[chain](hash) : null);

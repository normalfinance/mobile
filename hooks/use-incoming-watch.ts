// Incoming-payment watcher for the Receive sheet on Stellar / Ethereum /
// Solana (Bitcoin has its own mempool watcher: use-btc-address-watch.ts).
// Web only watches Bitcoin; here every chain tells the user when money lands.
// Mechanism: the chain's balance is read when the sheet opens (baseline) and
// every 6 s after; any rise over the baseline is reported as a confirmed
// receipt. Stellar reads XLM and USDC from one Horizon account call; an
// account that does not exist yet reads as 0 so its activation shows up too.
// Only runs while the sheet is open on that chain — the single timer it owns.

import React from "react";
import { createPublicClient, formatEther, http } from "viem";
import { mainnet } from "viem/chains";
import { Connection, PublicKey } from "@solana/web3.js";

import type { WalletChain } from "@/hooks/use-turnkey-wallet";
import { ETH_RPC_URL } from "@/lib/send/evm";
import { SOL_RPC_URL } from "@/lib/send/solana";
import { loadSource } from "@/lib/stellar/send";

const POLL_MS = 6_000;

export interface IncomingReceipt {
  symbol: string;
  amount: number;
}

type Balances = Record<string, number>; // symbol → balance

const readBalances = async (chain: WalletChain, address: string): Promise<Balances> => {
  if (chain === "stellar") {
    try {
      const s = await loadSource(address);
      return { XLM: s.xlmBalance, ...(s.usdcBalance !== null ? { USDC: s.usdcBalance } : {}) };
    } catch (e) {
      // 404 = not activated yet: the first XLM will create it.
      if ((e as { response?: { status?: number } })?.response?.status === 404) return { XLM: 0 };
      throw e;
    }
  }
  if (chain === "ethereum") {
    const wei = await createPublicClient({ chain: mainnet, transport: http(ETH_RPC_URL) }).getBalance({ address: address as `0x${string}` });
    return { ETH: Number(formatEther(wei)) };
  }
  if (chain === "solana") {
    const lamports = await new Connection(SOL_RPC_URL, "confirmed").getBalance(new PublicKey(address), "confirmed");
    return { SOL: lamports / 1e9 };
  }
  return {};
};

export const useIncomingWatch = (chain: WalletChain | null, address: string | null | undefined, enabled: boolean) => {
  const [receipts, setReceipts] = React.useState<IncomingReceipt[]>([]);
  const [watching, setWatching] = React.useState(false);

  React.useEffect(() => {
    if (!enabled || !chain || !address || chain === "bitcoin") {
      setReceipts([]);
      setWatching(false);
      return;
    }
    let cancelled = false;
    let baseline: Balances | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const now = await readBalances(chain, address);
        if (cancelled) return;
        if (!baseline) {
          baseline = now;
          setWatching(true);
        } else {
          const found: IncomingReceipt[] = [];
          for (const [symbol, bal] of Object.entries(now)) {
            const delta = bal - (baseline[symbol] ?? 0);
            if (delta > 1e-9) found.push({ symbol, amount: delta });
          }
          if (found.length) setReceipts(found);
        }
      } catch {
        /* RPC hiccup — next tick */
      }
      if (!cancelled) timer = setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      setWatching(false);
    };
  }, [chain, address, enabled]);

  return { receipts, watching };
};

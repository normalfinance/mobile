// Port of web hooks/use-btc-address-watch.ts: watch a Bitcoin address for
// incoming UNCONFIRMED transactions while the Receive sheet shows it.
//   1. immediate HTTP read of the address's mempool txs (payments already
//      pending before the sheet opened),
//   2. mempool.space WebSocket `track-address` for real-time new txs,
//   3. a 20 s poll as the safety net for WS gaps.
// Enabled only while the sheet is open on Bitcoin — the only timer the sheet
// owns, and it stops the moment it closes (CLAUDE.md data cadence).

import React from "react";

export interface BtcWatchTx {
  txid: string;
  fee: number;
  status: { confirmed: boolean };
  vout: { scriptpubkey_address: string; value: number }[];
  vin: { prevout?: { scriptpubkey_address: string; value: number } }[];
}

const WS_URL = "wss://mempool.space/api/v1/ws";
const RECONNECT_DELAY_MS = 5_000;
const POLL_INTERVAL_MS = 20_000;

/** Sats this tx pays to `address` (sum of matching outputs). */
export const incomingSats = (tx: BtcWatchTx, address: string) => tx.vout.filter((o) => o.scriptpubkey_address === address).reduce((s, o) => s + o.value, 0);

export const useBtcAddressWatch = (address: string | null | undefined, enabled: boolean) => {
  const [incomingTxs, setIncomingTxs] = React.useState<BtcWatchTx[]>([]);
  const [isConnected, setIsConnected] = React.useState(false);

  React.useEffect(() => {
    if (!enabled || !address) {
      setIncomingTxs([]);
      setIsConnected(false);
      return;
    }
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let poll: ReturnType<typeof setTimeout> | null = null;

    const merge = (txs: BtcWatchTx[]) => {
      const incoming = txs.filter((tx) => tx.vout?.some((o) => o.scriptpubkey_address === address));
      if (!incoming.length) return;
      setIncomingTxs((prev) => {
        const seen = new Set(prev.map((t) => t.txid));
        const fresh = incoming.filter((t) => !seen.has(t.txid));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
    };
    const fetchMempool = async () => {
      if (cancelled) return;
      try {
        const r = await fetch(`https://mempool.space/api/address/${address}/txs/mempool`);
        if (!r.ok || cancelled) return;
        merge((await r.json()) as BtcWatchTx[]);
      } catch {
        /* next poll retries */
      }
    };
    const schedulePoll = () => {
      if (cancelled) return;
      poll = setTimeout(async () => {
        await fetchMempool();
        schedulePoll();
      }, POLL_INTERVAL_MS);
    };
    const connect = () => {
      if (cancelled) return;
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        if (cancelled) return ws?.close();
        setIsConnected(true);
        ws?.send(JSON.stringify({ action: "init" }));
        ws?.send(JSON.stringify({ action: "track-address", data: address }));
      };
      ws.onmessage = (ev) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
          merge([...((msg["address-transactions"] as BtcWatchTx[] | undefined) ?? []), ...((msg["address-block-transactions"] as BtcWatchTx[] | undefined) ?? [])]);
        } catch {
          /* malformed frame */
        }
      };
      ws.onclose = () => {
        setIsConnected(false);
        if (!cancelled) reconnect = setTimeout(connect, RECONNECT_DELAY_MS);
      };
      ws.onerror = () => ws?.close();
    };

    void fetchMempool();
    connect();
    schedulePoll();
    return () => {
      cancelled = true;
      if (reconnect) clearTimeout(reconnect);
      if (poll) clearTimeout(poll);
      try {
        ws?.close();
      } catch {
        /* already closed */
      }
      setIsConnected(false);
    };
  }, [address, enabled]);

  return { incomingTxs, isConnected };
};

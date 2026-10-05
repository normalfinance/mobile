// The active EXTERNAL Stellar wallet (web's persist "wallet slot" with
// walletType lobstr / wallet-connect). One slot: when set, it is the Stellar
// address the whole app reads and signs for — balances, savings, send, swap,
// receive — while BTC/ETH/SOL stay on the Normal wallet. Signing goes through
// WalletConnect (lib/external-wallet/walletconnect.ts) instead of Turnkey;
// lib/stellar/signer.ts dispatches by address, so the money code is unaware.
// Persisted so the choice survives restarts (web: the slot + a breadcrumb).

import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ExternalWalletType = "lobstr" | "wallet-connect";

export interface ExternalWallet {
  address: string;
  walletType: ExternalWalletType;
  /** Wallet app name from the WalletConnect session (e.g. "LOBSTR"). */
  name: string;
  /** WalletConnect session topic; null once the session is gone (sign re-pairs). */
  topic: string | null;
  connectedAt: number;
}

/** Sentinel sub-org id for an account that has NO Normal wallet but an
 *  external one; Turnkey code paths treat it as "no sub-org" (provision.ts). */
export const EXTERNAL_SUB_ORG = "external";

const KEY = "external_stellar_wallet_v1";
let current: ExternalWallet | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const loadExternalWallet = async (): Promise<ExternalWallet | null> => {
  if (loaded) return current;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    current = raw ? (JSON.parse(raw) as ExternalWallet) : null;
  } catch {
    current = null;
  }
  notify();
  return current;
};

export const getExternalWallet = (): ExternalWallet | null => current;
export const isExternalAddress = (address: string | null | undefined): boolean => !!address && current?.address === address;

export const setExternalWallet = async (w: ExternalWallet | null): Promise<void> => {
  current = w;
  loaded = true;
  notify();
  try {
    if (w) await AsyncStorage.setItem(KEY, JSON.stringify(w));
    else await AsyncStorage.removeItem(KEY);
  } catch {
    /* non-fatal */
  }
};

export const updateExternalTopic = (topic: string | null) => {
  if (!current) return;
  void setExternalWallet({ ...current, topic });
};

export const subscribeExternalWallet = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const useExternalWallet = (): ExternalWallet | null => {
  React.useEffect(() => {
    void loadExternalWallet();
  }, []);
  return React.useSyncExternalStore(subscribeExternalWallet, getExternalWallet, getExternalWallet);
};

export const externalWalletLabel = (w: ExternalWallet | null | undefined): string => (w ? (w.walletType === "lobstr" ? "LOBSTR" : w.name || "WalletConnect wallet") : "Normal wallet");

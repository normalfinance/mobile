// WalletConnect v2 for external Stellar wallets (LOBSTR first; any wallet
// that speaks the Stellar namespace). Web uses Stellar Wallets Kit's
// WalletConnect module (packages/state stellar-wallet-kit/actions.ts) with
// the same project id; the kit is browser-only, so this is the native port:
//   chain      stellar:pubnet          (WalletConnect explorer: LOBSTR → stellar:pubnet)
//   method     stellar_signXDR         { xdr } → { signedXDR }   (Reown Stellar RPC spec)
//   LOBSTR     native lobstr://wc?uri= · universal https://lobstr.co/uni/wc?uri=
// Flow: SignClient.connect → pairing URI → open the wallet app with it (or
// show the URI as a QR for a wallet on another device) → approval() → the
// session's stellar account. Signing: open the wallet app so its prompt is in
// front, send the request on the session topic, await the signed XDR.
// Sessions persist in AsyncStorage via the SignClient's own storage.

import "@walletconnect/react-native-compat";
import { Linking } from "react-native";
import SignClient from "@walletconnect/sign-client";
import type { SessionTypes } from "@walletconnect/types";

import { getExternalWallet, updateExternalTopic, type ExternalWalletType } from "./store";

// Reown project id — public by nature (it ships in web's bundle too); the
// env var lets production use its own project without a code change.
const PROJECT_ID = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID || "c23b8cc582d9a0db289b74ddda7bfc6e";
export const STELLAR_CHAIN = "stellar:pubnet";
const SIGN_METHOD = "stellar_signXDR";
const SIGN_TIMEOUT_MS = 5 * 60_000;

export const LOBSTR_LINKS = { native: "lobstr://wc", universal: "https://lobstr.co/uni/wc" } as const;

export class WalletConnectCancelledError extends Error {
  constructor(message = "The request was rejected in the wallet app.") {
    super(message);
    this.name = "UserCancelled"; // lib/turnkey/client.ts isUserCancelledError reads the name
  }
}

let clientPromise: Promise<SignClient> | null = null;

const getClient = (): Promise<SignClient> => {
  if (!clientPromise) {
    clientPromise = SignClient.init({
      projectId: PROJECT_ID,
      metadata: {
        name: "Normal",
        description: "Savings and wallet on Stellar",
        url: "https://www.normalfinance.io",
        icons: ["https://www.normalfinance.io/favicon.ico"],
        // Lets the wallet app return to us after approving / signing.
        redirect: { native: "normalapp://", universal: "https://www.normalfinance.io" }
      }
    }).then((client) => {
      client.on("session_delete", ({ topic }) => {
        if (getExternalWallet()?.topic === topic) updateExternalTopic(null);
      });
      client.on("session_expire", ({ topic }) => {
        if (getExternalWallet()?.topic === topic) updateExternalTopic(null);
      });
      return client;
    });
    clientPromise.catch(() => {
      clientPromise = null;
    });
  }
  return clientPromise;
};

/** The proposal / request travels over the relay websocket; opening the wallet
 *  app before it is connected shows the user an empty wallet (live 2026-10-05:
 *  "LOBSTR opens but there is nothing to confirm"). Wait briefly for it. */
const waitForRelay = async (client: SignClient, ms = 6000): Promise<boolean> => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (client.core.relayer.connected) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return client.core.relayer.connected;
};

const stellarAccount = (session: SessionTypes.Struct): string | null => {
  const acct = session.namespaces.stellar?.accounts?.find((a) => a.startsWith(`${STELLAR_CHAIN}:`));
  return acct ? acct.split(":")[2] ?? null : null;
};

export interface ConnectHandle {
  /** Pairing URI — shown as a QR / copied for a wallet on another device. */
  uri: string;
  /** Resolves when the wallet approves; rejects on refusal / timeout. */
  approval: () => Promise<{ address: string; topic: string; name: string }>;
}

/** Start a pairing. Caller opens the wallet app (openWalletApp) or shows the URI. */
export const startConnect = async (): Promise<ConnectHandle> => {
  const client = await getClient();
  const { uri, approval } = await client.connect({
    requiredNamespaces: { stellar: { chains: [STELLAR_CHAIN], methods: [SIGN_METHOD], events: [] } }
  });
  if (!uri) throw new Error("WalletConnect did not return a pairing link.");
  if (!(await waitForRelay(client))) throw new Error("Couldn’t reach the WalletConnect relay. Check your connection and try again.");
  return {
    uri,
    approval: async () => {
      const session = await approval();
      const address = stellarAccount(session);
      if (!address) {
        await client.disconnect({ topic: session.topic, reason: { code: 6000, message: "No Stellar account" } }).catch(() => undefined);
        throw new Error("The wallet approved without a Stellar account.");
      }
      return { address, topic: session.topic, name: session.peer.metadata.name || "WalletConnect wallet" };
    }
  };
};

/** Open the wallet app with the pairing URI (LOBSTR deep link, else a generic wc: link). */
export const openWalletApp = async (walletType: ExternalWalletType, uri: string): Promise<boolean> => {
  const enc = encodeURIComponent(uri);
  const candidates = walletType === "lobstr" ? [`${LOBSTR_LINKS.native}?uri=${enc}`, `${LOBSTR_LINKS.universal}?uri=${enc}`] : [`wc:${uri.slice(3)}`, uri];
  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      /* try the next form */
    }
  }
  return false;
};

/** Bring the wallet app to the front so its signing prompt is visible. */
const focusWalletApp = async (walletType: ExternalWalletType, session: SessionTypes.Struct | undefined) => {
  const native = walletType === "lobstr" ? "lobstr://" : session?.peer.metadata.redirect?.native;
  if (!native) return;
  await Linking.openURL(native).catch(() => undefined);
};

const liveSession = async (client: SignClient, topic: string | null): Promise<SessionTypes.Struct | null> => {
  if (!topic) return null;
  try {
    const s = client.session.get(topic);
    return s && s.expiry * 1000 > Date.now() ? s : null;
  } catch {
    return null;
  }
};

/** Sign a Stellar transaction XDR with the active external wallet. */
export const signXdrWithWalletConnect = async (xdr: string): Promise<string> => {
  const ext = getExternalWallet();
  if (!ext) throw new Error("No external wallet is connected.");
  const client = await getClient();
  const session = await liveSession(client, ext.topic);
  if (!session) throw new WalletConnectSessionGoneError();
  await waitForRelay(client);
  await focusWalletApp(ext.walletType, session);
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("The wallet did not answer within 5 minutes.")), SIGN_TIMEOUT_MS));
  try {
    const result = await Promise.race([
      client.request<{ signedXDR?: string; signedTxXdr?: string }>({ topic: session.topic, chainId: STELLAR_CHAIN, request: { method: SIGN_METHOD, params: { xdr } } }),
      timeout
    ]);
    const signed = result?.signedXDR ?? result?.signedTxXdr;
    if (!signed) throw new Error("The wallet returned no signed transaction.");
    return signed;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/reject|denied|cancel|USER_REJECTED/i.test(msg)) throw new WalletConnectCancelledError();
    throw e;
  }
};

export class WalletConnectSessionGoneError extends Error {
  constructor() {
    super("Your wallet session has expired — reconnect the wallet in Settings to sign.");
    this.name = "WalletConnectSessionGone";
  }
}

export const disconnectWalletConnect = async (topic: string | null): Promise<void> => {
  if (!topic) return;
  try {
    const client = await getClient();
    await client.disconnect({ topic, reason: { code: 6000, message: "User disconnected" } });
  } catch {
    /* already gone */
  }
};

/** True when the stored session is still usable (for the Settings status line). */
export const hasLiveSession = async (topic: string | null): Promise<boolean> => {
  if (!topic) return false;
  try {
    return !!(await liveSession(await getClient(), topic));
  } catch {
    return false;
  }
};

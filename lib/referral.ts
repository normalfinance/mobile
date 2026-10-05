// Referrals — web hooks/use-referral-tracking.ts + lib/referral-api.ts:
// capture ?ref= / ?referral= / ?referrer= from an incoming link (first code
// wins, kept 30 days), then once a Stellar address exists:
//   POST referral/user { walletAddress } → GET referral/codes?code= →
//   if !referral.isUsed: POST referral/activate { code, refereeWalletAddress } →
//   POST referral/actions { userWalletAddress, referralCode, action: 'signup' }
// Failures are silent (web). No UI shows a code, stats or rewards on web either.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";

import { apiFetch } from "@/lib/api";

const KEY = "referral_v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface Stored {
  code: string;
  capturedAt: number;
  activated?: boolean;
  signupRecorded?: boolean;
}

const read = async (): Promise<Stored | null> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Stored) : null;
    if (!v || Date.now() - v.capturedAt > TTL_MS) return null;
    return v;
  } catch {
    return null;
  }
};
const write = (v: Stored) => AsyncStorage.setItem(KEY, JSON.stringify(v)).catch(() => undefined);

const codeFromUrl = (url: string): string | null => {
  try {
    const u = new URL(url);
    const code = u.searchParams.get("ref") || u.searchParams.get("referral") || u.searchParams.get("referrer");
    return code && /^[A-Za-z0-9_-]{2,64}$/.test(code) ? code : null;
  } catch {
    return null;
  }
};

/** Remember a referral code from a link; the first code wins (web). */
export const captureReferralFromUrl = async (url: string | null): Promise<void> => {
  const code = url ? codeFromUrl(url) : null;
  if (!code) return;
  if (await read()) return;
  await write({ code, capturedAt: Date.now() });
};

/** Listen for links for the app's lifetime (initial URL + later opens). */
export const startReferralCapture = (): (() => void) => {
  void Linking.getInitialURL().then((u) => captureReferralFromUrl(u)).catch(() => undefined);
  const sub = Linking.addEventListener("url", ({ url }) => void captureReferralFromUrl(url));
  return () => sub.remove();
};

/** Apply a captured code for this Stellar address; idempotent, silent. */
export const applyReferral = async (stellarAddress: string): Promise<void> => {
  const stored = await read();
  if (!stored || stored.signupRecorded) return;
  try {
    await apiFetch("/api/referral/user", { body: { walletAddress: stellarAddress } }).catch(() => undefined);
    if (!stored.activated) {
      const lookup = await apiFetch<{ referral?: { isUsed?: boolean } | null }>("/api/referral/codes", { query: { code: stored.code } });
      if (!lookup?.referral) return; // unknown code — nothing to apply
      if (!lookup.referral.isUsed) {
        await apiFetch("/api/referral/activate", { body: { code: stored.code, refereeWalletAddress: stellarAddress } });
      }
      stored.activated = true;
      await write(stored);
    }
    await apiFetch("/api/referral/actions", { body: { userWalletAddress: stellarAddress, referralCode: stored.code, action: "signup" } });
    stored.signupRecorded = true;
    await write(stored);
  } catch {
    /* silent (web); retried on the next launch */
  }
};

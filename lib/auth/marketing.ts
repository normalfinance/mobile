// Product-updates consent — web onboarding-wizard.tsx:281-298 and
// settings-general.tsx: POST /api/marketing/opt-in { optIn } plus the
// user_metadata.marketing_opt_in flag; GET returns the current value.
// A consent ticked on Create account (no session yet) is parked locally and
// applied by components/wallet/WalletEvents.tsx once the user is signed in.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const PENDING_KEY = "marketing_opt_in_pending_v1";
export const LEGAL = {
  terms: "https://www.normalfinance.io/legal/tos",
  privacy: "https://www.normalfinance.io/legal/pp",
  disclaimer: "https://www.normalfinance.io/legal/disclaimer",
  contact: "https://www.normalfinance.io/contact"
} as const;

export const getMarketingOptIn = async (): Promise<boolean | null> => {
  try {
    const d = await apiFetch<{ optIn?: boolean }>("/api/marketing/opt-in");
    return typeof d?.optIn === "boolean" ? d.optIn : null;
  } catch {
    return null;
  }
};

export const setMarketingOptIn = async (optIn: boolean): Promise<void> => {
  await apiFetch("/api/marketing/opt-in", { body: { optIn } });
  await supabase.auth.updateUser({ data: { marketing_opt_in: optIn } }).catch(() => undefined);
};

export const parkMarketingOptIn = () => AsyncStorage.setItem(PENDING_KEY, "1").catch(() => undefined);
/** Apply a consent parked before sign-in; no-op when none. */
export const applyParkedMarketingOptIn = async () => {
  if ((await AsyncStorage.getItem(PENDING_KEY).catch(() => null)) !== "1") return;
  try {
    await setMarketingOptIn(true);
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    /* retried next launch */
  }
};

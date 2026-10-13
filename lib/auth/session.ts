// The ONE way to leave a session on this phone. supabase-js keeps the local
// session when the server's /logout answers anything but 401/403/404 — a
// deleted user, a dead network or a 5xx therefore left the app "signed in"
// with a token the server no longer honours (live 2026-10-13 after account
// deletion: the app stayed on an empty Home, then bounced to sign-in once the
// token refresh failed). So: ask the server politely, then clear everything
// locally no matter what it said, and let the provider drop its state.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";

import { resetOnboarding } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";

let queryClientRef: QueryClient | null = null;
/** Registered once by the root layout so sign-out can drop every cached read. */
export const registerQueryClient = (qc: QueryClient) => {
  queryClientRef = qc;
};

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | undefined> =>
  Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);

export const clearLocalSession = async (): Promise<void> => {
  resetOnboarding();
  queryClientRef?.clear();
  // Best effort: revoke the refresh token server-side (auth-js ignores a
  // 401/403/404 from /logout and removes the session; any other answer keeps
  // it, which is why the storage wipe below never depends on this call).
  await withTimeout(supabase.auth.signOut().catch(() => undefined), 4000);
  // auth-js reads the session from STORAGE on every call (GoTrueClient
  // __loadSession), so removing the key is the definitive local sign-out.
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith("sb-") || k.includes("supabase.auth"));
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch {
    /* nothing persisted */
  }
  await withTimeout(supabase.auth.signOut({ scope: "local" }).catch(() => undefined), 2000);
};

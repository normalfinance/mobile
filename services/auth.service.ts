import { useQuery } from "@tanstack/react-query";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";
import Constants from "expo-constants";

import { supabase } from "@/lib/supabase";
import { STALE_TIMES } from "@/lib/utils/query.utils";
import {
  getCachedSession,
  getCachedUser,
  useSupabaseAuth
} from "@/providers/supabase-auth-provider";

WebBrowser.maybeCompleteAuthSession();

export interface AuthCredentials {
  userId: string; // Email address for account consistency and backend lookup
  sessionSecret: string; // Stable Supabase user ID (consistent across sessions)
}

export interface AuthStatus {
  isAuthenticated: boolean;
  credentials: AuthCredentials | null;
  isLoading: boolean;
  error: Error | null;
}

export const getAuthCredentials = (): AuthCredentials | null => {
  const session = getCachedSession();
  const user = getCachedUser();

  if (!session || !user || !user.email) {
    return null;
  }

  return {
    userId: user.email,
    sessionSecret: user.id
  };
};

export const getCurrentUserId = (): string | null => {
  const credentials = getAuthCredentials();
  return credentials?.userId || null;
};

export const getCurrentSessionSecret = (): string | null => {
  const credentials = getAuthCredentials();
  return credentials?.sessionSecret || null;
};

export const isUserAuthenticated = (): boolean => {
  return !!getCachedSession();
};

export const requireAuth = (): AuthCredentials => {
  const credentials = getAuthCredentials();
  if (!credentials) {
    throw new Error("User must be authenticated to perform this action");
  }
  return credentials;
};

// Query Keys
export const authQueryKeys = {
  all: ["auth"] as const,
  credentials: () => [...authQueryKeys.all, "credentials"] as const,
  status: () => [...authQueryKeys.all, "status"] as const
};

// Custom Hooks
export const useAuthCredentials = () => {
  const { session, user, isLoading } = useSupabaseAuth();

  return useQuery({
    queryKey: authQueryKeys.credentials(),
    queryFn: () => {
      if (!session || !user?.email) {
        throw new Error("Not authenticated");
      }

      return {
        userId: user.email,
        sessionSecret: user.id
      } satisfies AuthCredentials;
    },
    enabled: !isLoading && !!session && !!user?.email,
    staleTime: STALE_TIMES.SHORT,
    retry: false
  });
};

export const useAuthStatus = (): AuthStatus => {
  const { session, isLoading: authLoading } = useSupabaseAuth();
  const credentialsQuery = useAuthCredentials();

  return {
    isAuthenticated: !!session && !!credentialsQuery.data,
    credentials: credentialsQuery.data ?? null,
    isLoading: authLoading || credentialsQuery.isLoading,
    error: credentialsQuery.error as Error | null
  };
};

export const signInWithGoogle = async (): Promise<boolean> => {
  const redirectTo = AuthSession.makeRedirectUri({
    scheme: "normalapp",
    path: "wallet-setup",
    native: "normalapp://wallet-setup"
  });

  // `redirectTo` must be listed verbatim in Supabase → Authentication → URL Configuration
  // → Redirect URLs, or Supabase falls back to the web Site URL.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      // Always show Google's account chooser. The auth browser shares Safari's
      // cookies, so without this Google silently reuses whichever account is
      // already signed in there.
      queryParams: { prompt: "select_account" }
    }
  });

  if (error) {
    throw error;
  }

  const { url } = data ?? {};

  if (!url) {
    throw new Error("Unable to start Google authentication flow.");
  }

  // The auth browser intercepts the `normalapp://wallet-setup?code=…` redirect and
  // hands it back here as `authResult.url`. It is NOT delivered to the app as a
  // deep link, so the wallet-setup screen never sees `params.code`; the PKCE
  // exchange has to happen right here.
  const authResult = await WebBrowser.openAuthSessionAsync(url, redirectTo);

  if (authResult.type !== "success") {
    // "cancel" / "dismiss" — the user closed the browser.
    return false;
  }

  const callback = new URL(authResult.url);
  const params = new URLSearchParams(
    callback.search || callback.hash.replace(/^#/, "?")
  );

  const providerError = params.get("error_description") ?? params.get("error");
  if (providerError) {
    throw new Error(providerError.replace(/\+/g, " "));
  }

  const code = params.get("code");
  if (code) {
    // PKCE (the configured flow): one-time code → session.
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      throw exchangeError;
    }
  } else {
    // Implicit flow fallback: tokens arrive in the URL fragment. Only happens if
    // the client's flowType is ever changed away from "pkce".
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) {
      throw new Error(
        "Google sign-in returned neither an authorization code nor a session."
      );
    }
    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token
    });
    if (sessionError) {
      throw sessionError;
    }
  }

  // The session is now set; SupabaseAuthProvider's onAuthStateChange fires and
  // app/(auth)/_layout.tsx redirects to /wallet-setup on its own.
  return true;
};

// Utility function for components that need auth
export const useRequireAuth = (): AuthCredentials => {
  const authStatus = useAuthStatus();

  if (authStatus.isLoading) {
    throw new Error("Authentication loading");
  }

  if (!authStatus.isAuthenticated || !authStatus.credentials) {
    throw new Error("Authentication required");
  }

  return authStatus.credentials;
};

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

  // Ensure the Supabase Google provider redirect matches `normalapp://wallet-setup`
  // and the provider is enabled in the Supabase dashboard before using this helper.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true
    }
  });

  if (error) {
    throw error;
  }

  const { url } = data ?? {};

  if (!url) {
    throw new Error("Unable to start Google authentication flow.");
  }

  // Open the browser for OAuth - the redirect will bring user back to wallet-setup
  // where the code exchange will happen
  const authResult = await WebBrowser.openAuthSessionAsync(url, redirectTo);

  // Return true if user completed OAuth (even if we don't have session yet)
  // The code exchange will happen on the wallet-setup page
  return authResult.type === "success";
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

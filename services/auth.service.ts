import { useAuth, useUser } from "@clerk/clerk-expo";
import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES } from "../lib/utils/query.utils";

export interface AuthCredentials {
  userId: string; // Email address for account consistency and backend lookup
  sessionSecret: string; // Clerk's stable user ID (consistent across all auth sessions)
}

export interface AuthStatus {
  isAuthenticated: boolean;
  credentials: AuthCredentials | null;
  isLoading: boolean;
  error: Error | null;
}

export const getAuthCredentials = (): AuthCredentials | null => {
  const auth = useAuth();
  const { user } = useUser();

  console.log("Auth", auth);
  if (!auth.isSignedIn || !user) {
    return null;
  }

  // Access user email and Clerk user ID
  const userEmail = user.primaryEmailAddress?.emailAddress;
  const clerkUserId = auth.userId;

  console.log("User email", userEmail);
  console.log("Clerk user ID", clerkUserId);

  if (!userEmail || !clerkUserId) {
    return null;
  }

  return {
    userId: userEmail, // Use email as stable identifier for backend lookup
    sessionSecret: clerkUserId // Use Clerk's stable user ID (same across all sessions)
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
  const auth = useAuth();
  return auth.isSignedIn ?? false;
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
  const auth = useAuth();
  const { user } = useUser();

  console.log("useAuthCredentials - auth:", { isSignedIn: auth.isSignedIn, userId: auth.userId, isLoaded: auth.isLoaded });
  console.log("useAuthCredentials - user:", { 
    id: user?.id, 
    email: user?.primaryEmailAddress?.emailAddress,
    hasUser: !!user 
  });

  return useQuery({
    queryKey: authQueryKeys.credentials(),
    queryFn: () => {
      console.log("queryFn executing with auth.isSignedIn:", auth.isSignedIn, "user:", !!user);
      
      if (!auth.isSignedIn || !user) {
        throw new Error("Not authenticated");
      }

      const userEmail = user.primaryEmailAddress?.emailAddress;
      const clerkUserId = auth.userId;

      console.log("userEmail:", userEmail, "clerkUserId:", clerkUserId);

      if (!userEmail || !clerkUserId) {
        throw new Error("Missing user credentials");
      }

      const credentials = {
        userId: userEmail,
        sessionSecret: clerkUserId
      } as AuthCredentials;

      console.log("Returning credentials:", credentials);
      return credentials;
    },
    enabled: auth.isLoaded && auth.isSignedIn && !!user,
    staleTime: STALE_TIMES.SHORT,
    retry: false // Don't retry auth failures
  });
};

export const useAuthStatus = (): AuthStatus => {
  const auth = useAuth();
  const credentialsQuery = useAuthCredentials();

  return {
    isAuthenticated: (auth.isSignedIn ?? false) && !!credentialsQuery.data,
    credentials: credentialsQuery.data || null,
    isLoading: !(auth.isLoaded ?? false) || credentialsQuery.isLoading,
    error: credentialsQuery.error as Error | null
  };
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

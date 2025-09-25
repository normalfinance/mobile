import { useAuth, useUser } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { STALE_TIMES } from '../lib/utils/query.utils';

export interface AuthCredentials {
  userId: string;        // Email address for account consistency and backend lookup
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
  
  if (!auth.isSignedIn || !user) {
    return null;
  }

  // Access user email and Clerk user ID
  const userEmail = user.primaryEmailAddress?.emailAddress;
  const clerkUserId = auth.userId;
  
  if (!userEmail || !clerkUserId) {
    return null;
  }

  return {
    userId: userEmail,        // Use email as stable identifier for backend lookup
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
    throw new Error('User must be authenticated to perform this action');
  }
  return credentials;
};

// Query Keys
export const authQueryKeys = {
  all: ['auth'] as const,
  credentials: () => [...authQueryKeys.all, 'credentials'] as const,
  status: () => [...authQueryKeys.all, 'status'] as const,
};

// Custom Hooks
export const useAuthCredentials = () => {
  return useQuery({
    queryKey: authQueryKeys.credentials(),
    queryFn: () => {
      const credentials = getAuthCredentials();
      if (!credentials) {
        throw new Error('Not authenticated');
      }
      return credentials;
    },
    enabled: isUserAuthenticated(),
    staleTime: STALE_TIMES.SHORT,
    retry: false, // Don't retry auth failures
  });
};

export const useAuthStatus = (): AuthStatus => {
  const auth = useAuth();
  const credentialsQuery = useAuthCredentials();
  
  return {
    isAuthenticated: (auth.isSignedIn ?? false) && !!credentialsQuery.data,
    credentials: credentialsQuery.data || null,
    isLoading: !(auth.isLoaded ?? false) || credentialsQuery.isLoading,
    error: credentialsQuery.error as Error | null,
  };
};

// Utility function for components that need auth
export const useRequireAuth = (): AuthCredentials => {
  const authStatus = useAuthStatus();
  
  if (authStatus.isLoading) {
    throw new Error('Authentication loading');
  }
  
  if (!authStatus.isAuthenticated || !authStatus.credentials) {
    throw new Error('Authentication required');
  }
  
  return authStatus.credentials;
};
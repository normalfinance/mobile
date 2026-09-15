// Auth Service - Core functions and hooks. (The seed-phrase wallet and its
// transaction service were removed 2026-09-15; the Turnkey wallet lives in
// lib/turnkey/ and hooks/use-turnkey-wallet.ts.)
export {
  getAuthCredentials,
  getCurrentUserId,
  getCurrentSessionSecret,
  isUserAuthenticated,
  requireAuth,
  authQueryKeys,
  useAuthCredentials,
  useAuthStatus,
  useRequireAuth,
  signInWithGoogle,
  signInWithApple
} from "./auth.service";

export type { AuthCredentials, AuthStatus } from "./auth.service";

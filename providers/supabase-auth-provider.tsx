import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase, type SupabaseClient } from "@/lib/supabase";

let cachedSession: Session | null = null;
let cachedUser: User | null = null;

const setCachedAuthState = (session: Session | null) => {
  cachedSession = session ?? null;
  cachedUser = session?.user ?? null;
};

export const getCachedSession = () => cachedSession;
export const getCachedUser = () => cachedUser;

type SupabaseAuthContextValue = {
  supabase: SupabaseClient;
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | undefined>(
  undefined
);

interface SupabaseAuthProviderProps {
  children: ReactNode;
}

export const SupabaseAuthProvider = ({
  children
}: SupabaseAuthProviderProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const {
        data: { session: initialSession }
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      setSession(initialSession ?? null);
      setCachedAuthState(initialSession);
      setIsLoading(false);
    };

    void syncSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;

      setSession(newSession ?? null);
      setCachedAuthState(newSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setCachedAuthState(null);
  }, []);

  const value = useMemo<SupabaseAuthContextValue>(
    () => ({
      supabase,
      session,
      user: session?.user ?? null,
      isLoading,
      signOut: handleSignOut
    }),
    [session, isLoading, handleSignOut]
  );

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};

export const useSupabaseAuth = (): SupabaseAuthContextValue => {
  const context = useContext(SupabaseAuthContext);

  if (!context) {
    throw new Error(
      "useSupabaseAuth must be used within a SupabaseAuthProvider"
    );
  }

  return context;
};

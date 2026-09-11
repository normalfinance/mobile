import { Redirect, Stack } from "expo-router";

import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

// No pre-login carousel any more (Niko, 2026-09-11): unauthenticated users go
// straight to sign-in; signed-in users go to the tabs, whose layout asks the
// server whether a wallet exists.
export default function UnAuthenticatedLayout() {
  const { session, isLoading } = useSupabaseAuth();

  if (isLoading) {
    return null;
  }

  if (session) {
    return <Redirect href='/(tabs)' />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

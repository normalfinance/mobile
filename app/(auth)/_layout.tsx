import { Redirect, Stack } from "expo-router";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";
import { useEffect, useState } from "react";

import { secureStorage } from "@/lib/utils";
import { STORAGE_KEYS } from "@/lib/constants";

export default function UnAuthenticatedLayout() {
  const { session, isLoading } = useSupabaseAuth();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      const value = await secureStorage.getItem(
        STORAGE_KEYS.ONBOARDING_COMPLETE
      );

      setHasCompletedOnboarding(value === "true");
    };

    void checkOnboarding();
  }, []);

  if (isLoading) {
    return null;
  }

  if (session) {
    return <Redirect href={"/"} />;
  }

  if (hasCompletedOnboarding === null) {
    return null;
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href='/onboarding' />;
  }

  return <Stack />;
}

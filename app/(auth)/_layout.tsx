import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from "react";

import { secureStorage } from "@/lib/utils";
import { STORAGE_KEYS } from "@/lib/constants";

export default function UnAuthenticatedLayout() {
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

  if (hasCompletedOnboarding === null) {
    return null;
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href='/onboarding' />;
  }

  return <Stack />;
}

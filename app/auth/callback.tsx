import { useEffect } from "react";
import { ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

import { Screen, UiText } from "@/components/home/primitives";
import { useColors } from "@/lib/theme/appearance";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

export default function AuthCallbackScreen() {
  const c = useColors();
  const router = useRouter();
  const { session, isLoading } = useSupabaseAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(session ? "/(tabs)" : "/sign-in");
  }, [isLoading, session, router]);

  return (
    <Screen justifyContent='center' alignItems='center' gap={12} padding={24}>
      <ActivityIndicator color={c.muted} />
      <UiText fontSize={16} fontWeight='500'>
        Finishing sign-in…
      </UiText>
      <UiText fontSize={14} color={c.muted}>
        You’ll be redirected in a moment.
      </UiText>
    </Screen>
  );
}

import { useEffect } from "react";
import { useRouter } from "expo-router";
import { Spinner, Text, YStack } from "tamagui";

import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { session, isLoading } = useSupabaseAuth();

  console.log("AuthCallbackScreen", isLoading, session);

  useEffect(() => {
    console.log("AuthCallbackScreen", isLoading, session);
    if (isLoading) {
      return;
    }

    if (session) {
      router.replace("/wallet-setup");
    } else {
      router.replace("/sign-in");
    }
  }, [isLoading, session, router]);

  return (
    <YStack
      flex={1}
      justifyContent='center'
      alignItems='center'
      backgroundColor='#F7F8FA'
      padding='$4'
      space='$3'
    >
      <Spinner size='large' color='#1C252E' />
      <Text fontSize={16} fontWeight='600' color='#1C252E'>
        Finishing sign-in...
      </Text>
      <Text fontSize={14} color='#666D80' textAlign='center'>
        You will be redirected shortly.
      </Text>
    </YStack>
  );
}

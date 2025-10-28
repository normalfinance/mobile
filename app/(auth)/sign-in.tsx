import { useRouter } from "expo-router";
import React from "react";
import { Alert } from "react-native";
import { Image } from "expo-image";
import PasswordlessSignIn from "@/components/passwordless-signin";
import { secureStorage } from "@/lib/utils";
import { STORAGE_KEYS } from "@/lib/constants";
import { Button, Paragraph, Text, XStack, YStack, Separator } from "tamagui";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";
import { signInWithGoogle } from "@/services";

export default function SignInScreen() {
  const router = useRouter();
  const { isLoading: authLoading } = useSupabaseAuth();
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);

  const handleGoogleSignIn = React.useCallback(async () => {
    setIsGoogleLoading(true);

    try {
      const session = await signInWithGoogle();

      if (!session) {
        return;
      }

      await secureStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, "true");
      router.replace("/");
    } catch (error) {
      console.error("Google sign-in error:", error);
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't complete Google sign-in. Please try again.";
      Alert.alert("Google Sign-In Failed", message);
    } finally {
      setIsGoogleLoading(false);
    }
  }, [router]);

  const handleAppleSignIn = React.useCallback(() => {
    Alert.alert(
      "Coming Soon",
      "Apple sign-in is not yet available. Please use email sign-in for now."
    );
  }, []);

  return (
    <YStack
      flex={1}
      bg='#F7F8FA'
      alignItems='center'
      justifyContent='space-around'
      p='$4'
    >
      <YStack alignItems='center' space='$4' justifyContent='space-between'>
        <YStack
          width={64}
          height={64}
          borderRadius={44}
          borderWidth={3}
          borderColor='rgba(148,163,184,0.1)'
          bg='white'
          alignItems='center'
          justifyContent='center'
          shadowColor='rgba(15, 23, 42, 0.08)'
          shadowOffset={{ width: 0, height: 12 }}
          shadowOpacity={1}
          shadowRadius={24}
          overflow='hidden'
        >
          <Image
            source={require("@/assets/icons/normal.png")}
            style={{ width: 56, height: 56 }}
          />
        </YStack>

        <YStack space='$2' alignItems='center'>
          <Text fontSize={24} fontWeight='500' color='#0D0D12'>
            Sign in to Normal
          </Text>
          <Paragraph
            color='#666D80'
            textAlign='center'
            fontWeight='400'
            fontSize={16}
          >
            Welcome back! Enter your email to receive a one-time sign-in code.
          </Paragraph>
          {authLoading && (
            <Text color='#666D80' fontSize={14}>
              Checking your session...
            </Text>
          )}
        </YStack>
      </YStack>

      <PasswordlessSignIn
        onSuccess={async () => {
          await secureStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, "true");
          router.replace("/");
        }}
      />
      <XStack
        // @ts-ignore
        justifyContent='center'
        alignItems='center'
        mv='$0'
      >
        <Separator flex={1} mr='$3' />
        <Text color='$color10'>OR</Text>
        <Separator flex={1} ml='$3' />
      </XStack>

      <YStack space='$3' width='100%'>
        <Button
          size='$5'
          backgroundColor='#FFFFFF'
          borderColor='rgba(208, 213, 221, 0.8)'
          borderWidth={1}
          borderRadius={6}
          fontWeight='600'
          onPress={handleGoogleSignIn}
          disabled={isGoogleLoading}
          opacity={isGoogleLoading ? 0.6 : 1}
        >
          <XStack alignItems='center' justifyContent='center' space='$3'>
            <Image
              source={require("@/assets/icons/auth/google.png")}
              style={{ width: 24, height: 24 }}
            />
            <Text color='#101828' fontWeight='600'>
              {isGoogleLoading ? "Signing in..." : "Sign in with Google"}
            </Text>
          </XStack>
        </Button>

        <Button
          size='$5'
          backgroundColor='#000000'
          borderColor='$borderColor'
          borderWidth={1}
          borderRadius={6}
          onPress={handleAppleSignIn}
        >
          <XStack alignItems='center' justifyContent='center' space='$3'>
            <Image
              source={require("@/assets/icons/auth/apple.png")}
              style={{ width: 24, height: 24 }}
            />
            <Text color='#FFFFFF' fontWeight='600'>
              Sign in with Apple
            </Text>
          </XStack>
        </Button>
      </YStack>
    </YStack>
  );
}

// Sign in: email code (Supabase OTP) or Google (PKCE, services/auth.service.ts).
// On success the auth layout redirects to the tabs; nothing is stored locally.

import React from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Image } from "expo-image";
import { XStack, YStack } from "tamagui";

import PasswordlessSignIn from "@/components/passwordless-signin";
import { Divider, Screen, SecondaryButton, UiText } from "@/components/home/primitives";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { BRAND_ASSETS } from "@/lib/utils/cdn.utils";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";
import { signInWithGoogle } from "@/services";

export default function SignInScreen() {
  const c = useColors();
  const { isLoading: authLoading } = useSupabaseAuth();
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);

  const handleGoogleSignIn = React.useCallback(async () => {
    setIsGoogleLoading(true);
    try {
      // Exchanges the PKCE code itself; the session change redirects us.
      await signInWithGoogle();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "We couldn’t complete Google sign-in.";
      Alert.alert("Google sign-in failed", message);
    } finally {
      setIsGoogleLoading(false);
    }
  }, []);

  const handleAppleSignIn = React.useCallback(() => {
    Alert.alert("Coming soon", "Apple sign-in is not available yet. Use email or Google.");
  }, []);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps='handled'
          showsVerticalScrollIndicator={false}
        >
          <YStack paddingHorizontal={space.gutter} paddingVertical={40} gap={28}>
            <YStack alignItems='center' gap={14}>
              <YStack
                width={64}
                height={64}
                borderRadius={32}
                overflow='hidden'
                backgroundColor={c.iconBg}
              >
                <Image
                  source={{ uri: BRAND_ASSETS.logoSinglePng() }}
                  style={{ width: 64, height: 64 }}
                  contentFit='cover'
                  cachePolicy='memory-disk'
                />
              </YStack>
              <YStack alignItems='center' gap={4}>
                <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>
                  Sign in to Normal
                </UiText>
                <UiText fontSize={14} color={c.muted}>
                  {authLoading ? "Checking your session…" : "Save, hold and swap — securely."}
                </UiText>
              </YStack>
            </YStack>

            <PasswordlessSignIn />

            <XStack alignItems='center' gap={12}>
              <YStack flex={1}>
                <Divider inset={0} />
              </YStack>
              <UiText fontSize={12} color={c.faint}>
                or
              </UiText>
              <YStack flex={1}>
                <Divider inset={0} />
              </YStack>
            </XStack>

            <YStack gap={10}>
              <SecondaryButton
                label={isGoogleLoading ? "Signing in…" : "Continue with Google"}
                onPress={handleGoogleSignIn}
                disabled={isGoogleLoading}
                icon={
                  <Image
                    source={require("@/assets/icons/auth/google.png")}
                    style={{ width: 18, height: 18 }}
                  />
                }
              />
              <XStack
                onPress={handleAppleSignIn}
                height={44}
                borderRadius={radius.smallButton}
                backgroundColor={c.cta}
                pressStyle={{ backgroundColor: c.ctaPressed }}
                alignItems='center'
                justifyContent='center'
                gap={8}
                accessibilityRole='button'
              >
                <Image
                  source={require("@/assets/icons/auth/apple.png")}
                  style={{ width: 18, height: 18, tintColor: c.ctaText }}
                />
                <UiText fontSize={13} fontWeight='500' color={c.ctaText}>
                  Continue with Apple
                </UiText>
              </XStack>
            </YStack>

            <UiText fontSize={11} color={c.faint} textAlign='center' lineHeight={16}>
              By continuing you agree to Normal’s Terms and Privacy Policy.
            </UiText>
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

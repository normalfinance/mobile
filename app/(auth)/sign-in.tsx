// Welcome — the signed-out entry. Two clear paths (Create account / Sign in)
// and the social options, which create or sign in transparently. The auth
// layout redirects to the tabs the moment a session exists.

import React from "react";
import { Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { XStack, YStack } from "tamagui";

import { Divider, PrimaryButton, Screen, SecondaryButton, UiText } from "@/components/home/primitives";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { BRAND_ASSETS } from "@/lib/utils/cdn.utils";
import { signInWithApple, signInWithGoogle } from "@/services";

export default function WelcomeScreen() {
  const c = useColors();
  const router = useRouter();
  const [busy, setBusy] = React.useState<"google" | "apple" | null>(null);

  const google = async () => {
    setBusy("google");
    try {
      await signInWithGoogle();
    } catch (e) {
      Alert.alert("Google sign-in failed", e instanceof Error ? e.message : "We couldn’t complete Google sign-in.");
    } finally {
      setBusy(null);
    }
  };
  const apple = async () => {
    setBusy("apple");
    try {
      await signInWithApple();
    } catch (e) {
      if ((e as { code?: string })?.code === "ERR_REQUEST_CANCELED") return;
      Alert.alert("Apple sign-in failed", e instanceof Error ? e.message : "We couldn’t complete Apple sign-in.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} paddingHorizontal={space.gutter} paddingBottom={24}>
          {/* brand */}
          <YStack flex={1} justifyContent='center' alignItems='center' gap={18}>
            <YStack width={72} height={72} borderRadius={36} overflow='hidden' backgroundColor={c.iconBg}>
              <Image source={{ uri: BRAND_ASSETS.logoSinglePng() }} style={{ width: 72, height: 72 }} contentFit='cover' cachePolicy='memory-disk' />
            </YStack>
            <YStack alignItems='center' gap={6}>
              <UiText fontSize={28} fontWeight='700' letterSpacing={tracking(28)} textAlign='center'>
                Save. Hold. Swap.
              </UiText>
              <UiText fontSize={15} color={c.muted} textAlign='center' lineHeight={21}>
                Earn on your dollars and hold Bitcoin, Ethereum and Solana — secured by a passkey, not a seed phrase.
              </UiText>
            </YStack>
          </YStack>

          {/* actions */}
          <YStack gap={10}>
            <PrimaryButton label='Create account' onPress={() => router.push("/(auth)/create-account")} disabled={!!busy} />
            <SecondaryButton label='Sign in' onPress={() => router.push("/(auth)/log-in")} disabled={!!busy} borderRadius={radius.cta} />

            <XStack alignItems='center' gap={12} paddingVertical={6}>
              <YStack flex={1}><Divider inset={0} /></YStack>
              <UiText fontSize={12} color={c.faint}>or continue with</UiText>
              <YStack flex={1}><Divider inset={0} /></YStack>
            </XStack>

            <XStack gap={10}>
              {Platform.OS === "ios" ? (
                <XStack
                  flex={1}
                  onPress={busy ? undefined : () => void apple()}
                  opacity={busy === "apple" ? 0.6 : 1}
                  height={48}
                  borderRadius={radius.cta}
                  backgroundColor={c.cta}
                  pressStyle={{ backgroundColor: c.ctaPressed }}
                  alignItems='center'
                  justifyContent='center'
                  gap={8}
                  accessibilityRole='button'
                  accessibilityLabel='Continue with Apple'
                >
                  <Image source={require("@/assets/icons/auth/apple.png")} style={{ width: 18, height: 18, tintColor: c.ctaText }} />
                  <UiText fontSize={14} fontWeight='600' color={c.ctaText}>Apple</UiText>
                </XStack>
              ) : null}
              <XStack
                flex={1}
                onPress={busy ? undefined : () => void google()}
                opacity={busy === "google" ? 0.6 : 1}
                height={48}
                borderRadius={radius.cta}
                borderWidth={1}
                borderColor={c.border}
                backgroundColor={c.surface}
                pressStyle={{ backgroundColor: c.pressTint }}
                alignItems='center'
                justifyContent='center'
                gap={8}
                accessibilityRole='button'
                accessibilityLabel='Continue with Google'
              >
                <Image source={require("@/assets/icons/auth/google.png")} style={{ width: 18, height: 18 }} />
                <UiText fontSize={14} fontWeight='600'>Google</UiText>
              </XStack>
            </XStack>

            <UiText fontSize={11} color={c.faint} textAlign='center' lineHeight={16} paddingTop={8}>
              By continuing you agree to Normal’s Terms and Privacy Policy.
            </UiText>
          </YStack>
        </YStack>
      </SafeAreaView>
    </Screen>
  );
}

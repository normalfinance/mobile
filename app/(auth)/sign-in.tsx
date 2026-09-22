// Sign in — the signed-out entry screen IS the sign-in form (email +
// password), with "Forgot password?" and "Email me a code instead" as text
// links, the social options underneath, and "Create account" at the bottom.
// The auth layout redirects to the tabs the moment a session exists.

import React from "react";
import { Alert, Platform } from "react-native";
import { Image } from "expo-image";
import * as AppleAuthentication from "expo-apple-authentication";
import { useLocalSearchParams, useRouter } from "expo-router";
import { XStack, YStack } from "tamagui";

import { AuthScreen, Field, SwitchLine, TextLink } from "@/components/auth/AuthScreen";
import { Divider, PrimaryButton, UiText } from "@/components/home/primitives";
import { friendlyAuthError, looksLikeEmail, normalizeEmail, sendSignInCode, signInWithPassword } from "@/lib/auth/email-auth";
import { useAppearance, useColors } from "@/lib/theme/appearance";
import { radius, tracking } from "@/lib/theme/tokens";
import { BRAND_ASSETS } from "@/lib/utils/cdn.utils";
import { signInWithApple, signInWithGoogle } from "@/services";

const BUTTON_HEIGHT = 48;

export default function SignInScreen() {
  const c = useColors();
  const { scheme } = useAppearance();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = React.useState(params.email ?? "");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState<"password" | "code" | "google" | "apple" | null>(null);
  const canSubmit = looksLikeEmail(email) && password.length > 0;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy("password");
    try {
      await signInWithPassword(email, password); // the auth layout redirects on session
    } catch (e) {
      Alert.alert("Couldn’t sign in", friendlyAuthError(e, "Check your email and password and try again."));
    } finally {
      setBusy(null);
    }
  };

  const emailCode = async () => {
    if (busy) return;
    if (!looksLikeEmail(email)) {
      Alert.alert("Enter your email first", "Type your email above, then we’ll send a code to it.");
      return;
    }
    setBusy("code");
    try {
      const r = await sendSignInCode(email);
      if (r === "ok") router.push({ pathname: "/(auth)/verify-code", params: { email: normalizeEmail(email), kind: "email" } });
    } catch (e) {
      Alert.alert("Couldn’t send the code", friendlyAuthError(e, "Please try again."));
    } finally {
      setBusy(null);
    }
  };

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
    <AuthScreen
      back={false}
      title='Sign in to Normal'
      subtitle='Save, hold and swap — secured by a passkey, not a seed phrase.'
      footer={<SwitchLine text='New to Normal?' action='Create account' onPress={() => router.push("/(auth)/create-account")} />}
    >
      <XStack justifyContent='center' marginTop={-8} marginBottom={4}>
        <YStack width={56} height={56} borderRadius={28} overflow='hidden' backgroundColor={c.iconBg}>
          <Image source={{ uri: BRAND_ASSETS.logoSinglePng() }} style={{ width: 56, height: 56 }} contentFit='cover' cachePolicy='memory-disk' />
        </YStack>
      </XStack>

      <Field label='Email' placeholder='you@example.com' keyboardType='email-address' autoCapitalize='none' autoCorrect={false} autoComplete='email' textContentType='emailAddress' value={email} onChangeText={setEmail} editable={!busy} returnKeyType='next' />
      <Field label='Password' placeholder='Your password' secureTextEntry autoCapitalize='none' autoCorrect={false} autoComplete='password' textContentType='password' value={password} onChangeText={setPassword} editable={!busy} onSubmitEditing={submit} returnKeyType='go' />
      <PrimaryButton label={busy === "password" ? "Signing in…" : "Sign in"} onPress={submit} disabled={!canSubmit} loading={busy === "password"} />
      <XStack justifyContent='space-between' alignItems='center'>
        <TextLink label='Forgot password?' onPress={() => router.push({ pathname: "/(auth)/forgot-password", params: { email: normalizeEmail(email) } })} disabled={!!busy} />
        <TextLink label={busy === "code" ? "Sending code…" : "Email me a code instead"} onPress={() => void emailCode()} disabled={!!busy} />
      </XStack>

      <XStack alignItems='center' gap={12} paddingVertical={4}>
        <YStack flex={1}><Divider inset={0} /></YStack>
        <UiText fontSize={12} color={c.faint}>or continue with</UiText>
        <YStack flex={1}><Divider inset={0} /></YStack>
      </XStack>

      {Platform.OS === "ios" ? (
        // Apple's own button: draws the logo itself and follows the HIG.
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={scheme === "dark" ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radius.cta}
          style={{ height: BUTTON_HEIGHT, width: "100%", opacity: busy === "apple" ? 0.6 : 1 }}
          onPress={() => (busy ? undefined : void apple())}
        />
      ) : null}
      <XStack
        onPress={busy ? undefined : () => void google()}
        opacity={busy === "google" ? 0.6 : 1}
        height={BUTTON_HEIGHT}
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
        <UiText fontSize={15} fontWeight='700' letterSpacing={tracking(15)}>Continue with Google</UiText>
      </XStack>

      <UiText fontSize={11} color={c.faint} textAlign='center' lineHeight={16} paddingTop={4}>
        By continuing you agree to Normal’s Terms and Privacy Policy.
      </UiText>
    </AuthScreen>
  );
}

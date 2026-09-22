// Sign in: email + password, with "Forgot password?" and "Email me a code
// instead" as plain text links (the web's two sign-in modes).

import React from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { XStack } from "tamagui";

import { AuthScreen, Field, SwitchLine, TextLink } from "@/components/auth/AuthScreen";
import { PrimaryButton } from "@/components/home/primitives";
import { friendlyAuthError, looksLikeEmail, normalizeEmail, sendSignInCode, signInWithPassword } from "@/lib/auth/email-auth";

export default function LogInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = React.useState(params.email ?? "");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState<"password" | "code" | null>(null);

  const submit = async () => {
    if (!looksLikeEmail(email) || !password || busy) return;
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

  return (
    <AuthScreen
      title='Welcome back'
      subtitle='Sign in with your password, or have a code emailed to you.'
      footer={<SwitchLine text='New to Normal?' action='Create account' onPress={() => router.replace("/(auth)/create-account")} />}
    >
      <Field label='Email' placeholder='you@example.com' keyboardType='email-address' autoCapitalize='none' autoCorrect={false} autoComplete='email' textContentType='emailAddress' value={email} onChangeText={setEmail} editable={!busy} returnKeyType='next' />
      <Field label='Password' placeholder='Your password' secureTextEntry autoCapitalize='none' autoCorrect={false} autoComplete='password' textContentType='password' value={password} onChangeText={setPassword} editable={!busy} onSubmitEditing={submit} returnKeyType='go' />
      <PrimaryButton label={busy === "password" ? "Signing in…" : "Sign in"} onPress={submit} disabled={!looksLikeEmail(email) || !password} loading={busy === "password"} />
      <XStack justifyContent='space-between' alignItems='center'>
        <TextLink label='Forgot password?' onPress={() => router.push({ pathname: "/(auth)/forgot-password", params: { email: normalizeEmail(email) } })} disabled={!!busy} />
        <TextLink label={busy === "code" ? "Sending code…" : "Email me a code instead"} onPress={() => void emailCode()} disabled={!!busy} />
      </XStack>
    </AuthScreen>
  );
}

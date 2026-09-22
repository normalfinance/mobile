// Forgot password: one field, one button, a done state. The email's link opens
// the website's reset page (Supabase "Reset Password" template).

import React from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { YStack } from "tamagui";
import { MailCheck } from "lucide-react-native";

import { AuthScreen, Field } from "@/components/auth/AuthScreen";
import { IconBox, PrimaryButton, UiText } from "@/components/home/primitives";
import { friendlyAuthError, looksLikeEmail, normalizeEmail, sendPasswordReset } from "@/lib/auth/email-auth";
import { useColors } from "@/lib/theme/appearance";

export default function ForgotPasswordScreen() {
  const c = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = React.useState(params.email ?? "");
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const submit = async () => {
    if (!looksLikeEmail(email) || busy) return;
    setBusy(true);
    try {
      const r = await sendPasswordReset(email);
      if (r === "ok") setSent(true);
    } catch (e) {
      Alert.alert("Couldn’t send the reset email", friendlyAuthError(e, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthScreen title='Check your email' subtitle={`If an account exists for ${normalizeEmail(email)}, a link to choose a new password is on its way.`}>
        <YStack alignItems='center' paddingVertical={16}>
          <IconBox size={56}><MailCheck size={26} color={c.positive} strokeWidth={1.8} /></IconBox>
        </YStack>
        <UiText fontSize={13} color={c.muted} textAlign='center' lineHeight={19}>
          Open the link on any device, choose a new password, then come back here and sign in.
        </UiText>
        <PrimaryButton label='Back to sign in' onPress={() => router.replace("/sign-in")} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title='Reset your password' subtitle='Enter the email you signed up with.'>
      <Field label='Email' placeholder='you@example.com' keyboardType='email-address' autoCapitalize='none' autoCorrect={false} autoComplete='email' textContentType='emailAddress' value={email} onChangeText={setEmail} editable={!busy} onSubmitEditing={submit} returnKeyType='send' />
      <PrimaryButton label={busy ? "Sending…" : "Send reset link"} onPress={submit} disabled={!looksLikeEmail(email)} loading={busy} />
    </AuthScreen>
  );
}

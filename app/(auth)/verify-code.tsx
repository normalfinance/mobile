// Verify the 6-digit code — shared by sign-up confirmation (kind=signup) and
// code sign-in (kind=email). Auto-submits on the sixth digit.

import React from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { XStack } from "tamagui";

import { AuthScreen, TextLink } from "@/components/auth/AuthScreen";
import { CodeInput } from "@/components/auth/CodeInput";
import { PrimaryButton } from "@/components/home/primitives";
import { friendlyAuthError, sendSignInCode, verifyCode, type CodeKind } from "@/lib/auth/email-auth";

export default function VerifyCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; kind?: string }>();
  const email = params.email ?? "";
  const kind: CodeKind = params.kind === "signup" ? "signup" : "email";
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(60);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async (value = code) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    try {
      await verifyCode(email, value, kind); // the auth layout redirects on session
    } catch (e) {
      Alert.alert("Invalid code", friendlyAuthError(e, "That code is wrong or has expired. Request a new one."));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    try {
      // A fresh code for either kind arrives through the sign-in-code path;
      // Supabase accepts it for an unconfirmed sign-up as well.
      const r = await sendSignInCode(email);
      if (r === "ok") {
        setCode("");
        setCooldown(60);
      }
    } catch (e) {
      Alert.alert("Couldn’t resend", friendlyAuthError(e, "Please try again."));
    }
  };

  return (
    <AuthScreen title='Check your email' subtitle={`We sent a 6-digit code to ${email}. It expires in 10 minutes.`}>
      <CodeInput value={code} onChange={setCode} onComplete={(v) => void submit(v)} disabled={busy} />
      <PrimaryButton label={busy ? "Verifying…" : "Continue"} onPress={() => void submit()} disabled={code.length !== 6} loading={busy} />
      <XStack justifyContent='space-between' alignItems='center'>
        <TextLink label={cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"} onPress={() => void resend()} disabled={cooldown > 0 || busy} />
        <TextLink label='Change email' onPress={() => router.back()} disabled={busy} />
      </XStack>
    </AuthScreen>
  );
}

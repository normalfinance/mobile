// Create account: email + password, then the confirmation code.

import React from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";

import { AuthScreen, Field, SwitchLine } from "@/components/auth/AuthScreen";
import { PrimaryButton } from "@/components/home/primitives";
import { MIN_PASSWORD, createAccount, friendlyAuthError, looksLikeEmail, normalizeEmail } from "@/lib/auth/email-auth";

export default function CreateAccountScreen() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const ready = looksLikeEmail(email) && password.length >= MIN_PASSWORD;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const r = await createAccount(email, password);
      if (r === "cancelled") return;
      if (r === "ok") router.push({ pathname: "/(auth)/verify-code", params: { email: normalizeEmail(email), kind: "signup" } });
      // "signedIn": the auth layout redirects to the tabs by itself.
    } catch (e) {
      const msg = friendlyAuthError(e, "Please try again.");
      if (/already an account/i.test(msg)) {
        Alert.alert("Account exists", msg, [{ text: "Cancel", style: "cancel" }, { text: "Sign in", onPress: () => router.replace({ pathname: "/(auth)/log-in", params: { email: normalizeEmail(email) } }) }]);
      } else Alert.alert("Couldn’t create your account", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title='Create your account'
      subtitle='We’ll email you a 6-digit code to confirm it’s you.'
      footer={<SwitchLine text='Already have an account?' action='Sign in' onPress={() => router.replace("/(auth)/log-in")} />}
    >
      <Field label='Email' placeholder='you@example.com' keyboardType='email-address' autoCapitalize='none' autoCorrect={false} autoComplete='email' textContentType='emailAddress' value={email} onChangeText={setEmail} editable={!busy} returnKeyType='next' />
      <Field
        label='Password'
        placeholder={`At least ${MIN_PASSWORD} characters`}
        secureTextEntry
        autoCapitalize='none'
        autoCorrect={false}
        autoComplete='new-password'
        textContentType='newPassword'
        value={password}
        onChangeText={setPassword}
        editable={!busy}
        onSubmitEditing={submit}
        returnKeyType='go'
        hint={password.length > 0 && password.length < MIN_PASSWORD ? `${MIN_PASSWORD - password.length} more character${MIN_PASSWORD - password.length === 1 ? "" : "s"}` : undefined}
      />
      <PrimaryButton label={busy ? "Creating…" : "Create account"} onPress={submit} disabled={!ready} loading={busy} />
    </AuthScreen>
  );
}

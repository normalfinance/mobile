// "Set up this phone": enrol a passkey on this device for a wallet whose
// passkey lives elsewhere, verified by an email code (lib/turnkey/enroll.ts).
// Reached from Settings, and offered automatically when signing fails with
// "no passkey on this phone".

import React from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Input, XStack, YStack } from "tamagui";
import { Check, ChevronLeft, Fingerprint, Mail } from "lucide-react-native";

import {
  Card,
  IconBox,
  IconButton,
  PillButton,
  PrimaryButton,
  Screen,
  UiText
} from "@/components/home/primitives";
import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { describeTurnkeyError } from "@/lib/turnkey/client";
import {
  completeEnrollment,
  startEnrollment,
  type Enrollment,
  type EnrollmentStep
} from "@/lib/turnkey/enroll";
import { ApiError } from "@/lib/api";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

const STEP_LABEL: Record<EnrollmentStep, string> = {
  "verifying-code": "Verifying your code…",
  "logging-in": "Opening a secure session…",
  "creating-passkey": "Creating this phone’s passkey…",
  "attaching-passkey": "Attaching it to your wallet…",
  finishing: "Almost done…"
};

const describe = (e: unknown): string => {
  if (e instanceof ApiError) {
    if (e.message === "no_wallet") return "This account has no Normal wallet yet.";
    if (e.message === "no_email" || e.message === "email_mismatch")
      return "Your login email doesn’t match the email on your wallet.";
    if (e.message === "too_many_authenticators")
      return "This wallet already has the maximum number of devices. Remove one on the website first.";
    if (e.message === "invalid_code") return "That code is wrong or has expired.";
    if (e.message === "login_failed") return "Turnkey rejected the login. Request a new code and try again.";
    if (e.message === "turnkey_error") return "Turnkey is temporarily unavailable. Try again in a minute.";
    if (e.status === 429) return "Too many attempts — wait a few minutes and try again.";
    return e.message;
  }
  return describeTurnkeyError(e);
};

export default function SetupDeviceScreen() {
  const c = useColors();
  const router = useRouter();
  const { user } = useSupabaseAuth();
  const { refetch } = useTurnkeyWallet();

  const [enrollment, setEnrollment] = React.useState<Enrollment | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState<EnrollmentStep | null>(null);
  const [done, setDone] = React.useState(false);

  const sendCode = async () => {
    setBusy(true);
    try {
      setEnrollment(await startEnrollment());
    } catch (e) {
      Alert.alert("Couldn’t send a code", describe(e));
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!enrollment || !user) return;
    setBusy(true);
    try {
      await completeEnrollment(enrollment, code, { id: user.id, email: user.email }, setStep);
      await refetch();
      setDone(true);
    } catch (e) {
      Alert.alert("Setup didn’t complete", describe(e));
      setStep(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps='handled'>
          <YStack paddingHorizontal={space.gutter} paddingTop={56} gap={20}>
            <XStack alignItems='center' gap={4}>
              <IconButton onPress={() => router.back()} label='Back'>
                <ChevronLeft size={22} color={c.ink} strokeWidth={2} />
              </IconButton>
              <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>
                Set up this phone
              </UiText>
            </XStack>

            {done ? (
              <Card padding={20} gap={12} alignItems='center'>
                <IconBox size={56}>
                  <Check size={28} color={c.positive} strokeWidth={2} />
                </IconBox>
                <UiText fontSize={16} fontWeight='500' textAlign='center'>
                  This phone can now sign for your wallet
                </UiText>
                <UiText fontSize={14} color={c.body50} textAlign='center'>
                  Every send, deposit and swap will ask for Face ID.
                </UiText>
                <YStack width='100%' marginTop={4}>
                  <PrimaryButton label='Done' onPress={() => router.replace("/(tabs)")} />
                </YStack>
              </Card>
            ) : !enrollment ? (
              <>
                <UiText fontSize={14} color={c.muted} lineHeight={20}>
                  Your wallet’s passkey lives on another device. Confirm it’s you with a
                  code sent to <UiText fontWeight='600'>{user?.email ?? "your email"}</UiText>,
                  then this phone gets its own passkey.
                </UiText>
                <Card padding={20} gap={14} alignItems='center'>
                  <IconBox size={56}>
                    <Mail size={26} color={c.ink} strokeWidth={1.6} />
                  </IconBox>
                  <UiText fontSize={16} fontWeight='500'>
                    Verify by email
                  </UiText>
                  <YStack width='100%'>
                    <PrimaryButton label='Send me a code' onPress={sendCode} loading={busy} />
                  </YStack>
                </Card>
              </>
            ) : (
              <>
                <UiText fontSize={14} color={c.muted}>
                  Enter the 6-digit code we sent to {user?.email}.
                </UiText>
                <Input
                  backgroundColor={c.inputBg}
                  borderWidth={1}
                  borderColor={c.border}
                  borderRadius={radius.input}
                  height={56}
                  color={c.ink}
                  placeholderTextColor={c.faint}
                  fontFamily='$mono'
                  fontSize={22}
                  letterSpacing={tracking(22) + 6}
                  textAlign='center'
                  placeholder='000000'
                  keyboardType='number-pad'
                  maxLength={6}
                  autoComplete='one-time-code'
                  textContentType='oneTimeCode'
                  value={code}
                  onChangeText={setCode}
                  editable={!busy}
                  autoFocus
                />
                <Card padding={16} gap={10}>
                  <XStack alignItems='center' gap={10}>
                    <IconBox size={32}>
                      <Fingerprint size={16} color={c.ink} strokeWidth={1.8} />
                    </IconBox>
                    <UiText fontSize={13} color={c.muted} flex={1} lineHeight={18}>
                      After the code, Face ID creates a passkey for this phone and adds it
                      to your wallet. Your other devices keep working.
                    </UiText>
                  </XStack>
                </Card>
                <PrimaryButton
                  label={step ? STEP_LABEL[step] : "Continue"}
                  onPress={finish}
                  disabled={code.length !== 6}
                  loading={busy}
                />
                <YStack alignItems='center'>
                  <PillButton label='Send a new code' onPress={busy ? undefined : sendCode} />
                </YStack>
              </>
            )}
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

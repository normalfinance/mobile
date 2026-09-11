// Standalone 6-digit code verification (used by the verify-magic-link route).
// Same verifyOtp call as before; presentation moved to the drawer primitives.

import React, { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { Input, YStack } from "tamagui";
import { Check } from "lucide-react-native";

import { IconBox, PillButton, PrimaryButton, Screen, UiText } from "@/components/home/primitives";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

interface PasswordlessVerifyProps {
  email?: string;
  onSuccess?: () => void;
  onBack?: () => void;
}

export default function PasswordlessVerify({ email, onSuccess, onBack }: PasswordlessVerifyProps) {
  const c = useColors();
  const { supabase } = useSupabaseAuth();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [done, setDone] = useState(false);

  const goBack = () => (onBack ? onBack() : router.replace("/sign-in"));

  const verifyCode = async () => {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert("Missing email", "We need your email address to verify the code.");
      return;
    }
    if (code.trim().length !== 6) {
      Alert.alert("Invalid code", "Please enter the 6-digit code.");
      return;
    }

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: code.trim(),
        type: "email"
      });
      if (error) throw error;

      if (data.session) {
        setDone(true);
        if (onSuccess) onSuccess();
        else setTimeout(() => router.replace("/(tabs)"), 800);
      } else {
        Alert.alert("Verification failed", "The process is not complete. Please request a new code.");
      }
    } catch (error) {
      Alert.alert(
        "Invalid code",
        error instanceof Error ? error.message : "The code is invalid or has expired.",
        [
          { text: "Try again", onPress: () => setCode("") },
          { text: "Back to sign in", style: "cancel", onPress: goBack }
        ]
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Screen paddingHorizontal={space.gutter} paddingTop={24} gap={16}>
      {done ? (
        <YStack alignItems='center' gap={12} paddingTop={40}>
          <IconBox size={56}>
            <Check size={28} color={c.positive} strokeWidth={2} />
          </IconBox>
          <UiText fontSize={16} fontWeight='500'>
            You’re signed in
          </UiText>
          <UiText fontSize={14} color={c.muted}>
            Taking you to your wallet…
          </UiText>
        </YStack>
      ) : (
        <>
          <YStack gap={4}>
            <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>
              Verify your email
            </UiText>
            <UiText fontSize={14} color={c.muted}>
              {email ? `We sent a 6-digit code to ${email}.` : "Enter the 6-digit code from your email."}
            </UiText>
          </YStack>
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
            editable={!isVerifying}
            autoFocus
          />
          <PrimaryButton
            label={isVerifying ? "Verifying…" : "Verify code"}
            onPress={verifyCode}
            disabled={code.length !== 6}
            loading={isVerifying}
          />
          <YStack alignItems='center'>
            <PillButton label='Back to sign in' onPress={goBack} />
          </YStack>
          <UiText fontSize={12} color={c.faint} textAlign='center'>
            Didn’t get it? Check your spam folder or request a new code.
          </UiText>
        </>
      )}
    </Screen>
  );
}

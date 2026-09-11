// Email + 6-digit code sign-in (Supabase signInWithOtp → verifyOtp). Same calls
// as before; only the presentation changed to the drawer's primitives.

import React, { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { Input, XStack, YStack } from "tamagui";

import { PillButton, PrimaryButton, UiText } from "@/components/home/primitives";
import { useColors } from "@/lib/theme/appearance";
import { radius, tracking } from "@/lib/theme/tokens";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

interface PasswordlessSignInProps {
  onSuccess?: () => void;
  onEmailSent?: () => void;
}

export default function PasswordlessSignIn({ onSuccess, onEmailSent }: PasswordlessSignInProps) {
  const c = useColors();
  const { supabase } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    []
  );

  const startCooldownTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: true }
      });
      if (error) throw error;

      setEmailSent(true);
      setCooldown(60);
      startCooldownTimer();
      onEmailSent?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send the code. Please try again.";
      Alert.alert("Couldn’t send code", message);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || code.trim().length !== 6) return;

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: code.trim(),
        type: "email"
      });
      if (error) throw error;

      if (data.session) {
        onSuccess?.();
      } else {
        Alert.alert("Verification incomplete", "We couldn’t verify your session. Request a new code.");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The code is invalid or has expired. Check your email and try again.";
      Alert.alert("Invalid code", message);
      setCode("");
    } finally {
      setIsVerifying(false);
    }
  };

  const resendCode = () => {
    if (cooldown === 0) {
      setCode("");
      void sendCode();
    }
  };

  const resetFlow = () => {
    setEmailSent(false);
    setCode("");
    setCooldown(0);
    if (timer.current) clearInterval(timer.current);
  };

  const inputBase = {
    backgroundColor: c.inputBg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.input,
    height: 48,
    paddingHorizontal: 14,
    color: c.ink,
    placeholderTextColor: c.faint,
    focusStyle: { borderColor: c.borderStrong }
  } as const;

  if (!emailSent) {
    return (
      <YStack gap={10} width='100%'>
        <Input
          {...inputBase}
          fontFamily='$body'
          fontSize={15}
          placeholder='Email address'
          keyboardType='email-address'
          autoCapitalize='none'
          autoCorrect={false}
          autoComplete='email'
          textContentType='emailAddress'
          value={email}
          onChangeText={setEmail}
          editable={!isLoading}
          onSubmitEditing={sendCode}
          returnKeyType='send'
        />
        <PrimaryButton
          label={isLoading ? "Sending…" : "Continue with email"}
          onPress={sendCode}
          disabled={!email.trim()}
          loading={isLoading}
        />
      </YStack>
    );
  }

  return (
    <YStack gap={12} width='100%'>
      <YStack gap={2}>
        <UiText fontSize={14} fontWeight='500'>
          Check your email
        </UiText>
        <UiText fontSize={13} color={c.muted}>
          We sent a 6-digit code to {email.trim().toLowerCase()}.
        </UiText>
      </YStack>
      <Input
        {...inputBase}
        fontFamily='$mono'
        fontSize={22}
        letterSpacing={tracking(22) + 6}
        textAlign='center'
        height={56}
        placeholder='000000'
        keyboardType='number-pad'
        maxLength={6}
        autoComplete='one-time-code'
        textContentType='oneTimeCode'
        value={code}
        onChangeText={setCode}
        editable={!isVerifying}
        onSubmitEditing={verifyCode}
        autoFocus
      />
      <PrimaryButton
        label={isVerifying ? "Verifying…" : "Verify code"}
        onPress={verifyCode}
        disabled={code.length !== 6}
        loading={isVerifying}
      />
      <XStack gap={8} justifyContent='center'>
        <PillButton
          label={cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          onPress={cooldown > 0 ? undefined : resendCode}
        />
        <PillButton label='Change email' onPress={resetFlow} />
      </XStack>
    </YStack>
  );
}

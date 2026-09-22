// Email sign-in, both of the web's modes (auth-login-modal.tsx): the default
// 6-digit code (signInWithOtp → verifyOtp), and a password mode — sign in
// with a password, or create an account with one (signUp → the same 6-digit
// confirmation code → verifyOtp type 'signup'). Forgot password sends
// Supabase's reset email, whose link opens the web's reset page. Every email
// request carries a Turnstile captcha token (Supabase captcha protection is on).

import React, { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { Input, XStack, YStack } from "tamagui";

import { PillButton, PrimaryButton, SecondaryButton, UiText } from "@/components/home/primitives";
import { CaptchaCancelled, requestCaptchaToken } from "@/lib/auth/captcha";
import { useColors } from "@/lib/theme/appearance";
import { radius, tracking } from "@/lib/theme/tokens";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

interface PasswordlessSignInProps {
  onSuccess?: () => void;
  onEmailSent?: () => void;
}

const MIN_PASSWORD = 8;
const RESET_PASSWORD_URL = "https://www.normalfinance.io/auth/reset-password";

export default function PasswordlessSignIn({ onSuccess, onEmailSent }: PasswordlessSignInProps) {
  const c = useColors();
  const { supabase } = useSupabaseAuth();
  const [mode, setMode] = useState<"code" | "password">("code");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  /** Which token Supabase expects for the code on screen. */
  const [verifyType, setVerifyType] = useState<"email" | "signup">("email");
  const [isLoading, setIsLoading] = useState<"code" | "signin" | "signup" | "reset" | null>(null);
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

  const normalizedEmail = () => email.trim().toLowerCase();

  /** Turnstile token, or null when the user closed the check (no alert then). */
  const captcha = async (): Promise<string | null> => {
    try {
      return await requestCaptchaToken();
    } catch (e) {
      if (e instanceof CaptchaCancelled) return null;
      throw e;
    }
  };

  const fail = (title: string, error: unknown, fallback: string) => {
    Alert.alert(title, error instanceof Error ? error.message : fallback);
  };

  const sendCode = async () => {
    const em = normalizedEmail();
    if (!em) return;
    setIsLoading("code");
    try {
      const captchaToken = await captcha();
      if (!captchaToken) return;
      const { error } = await supabase.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, captchaToken } });
      if (error) throw error;
      setVerifyType("email");
      setEmailSent(true);
      setCooldown(60);
      startCooldownTimer();
      onEmailSent?.();
    } catch (error) {
      fail("Couldn’t send code", error, "Failed to send the code. Please try again.");
    } finally {
      setIsLoading(null);
    }
  };

  const signInWithPassword = async () => {
    const em = normalizedEmail();
    if (!em || !password) return;
    setIsLoading("signin");
    try {
      const captchaToken = await captcha();
      if (!captchaToken) return;
      const { data, error } = await supabase.auth.signInWithPassword({ email: em, password, options: { captchaToken } });
      if (error) throw error;
      if (data.session) onSuccess?.();
    } catch (error) {
      fail("Couldn’t sign in", error, "Check your email and password and try again.");
    } finally {
      setIsLoading(null);
    }
  };

  const createWithPassword = async () => {
    const em = normalizedEmail();
    if (!em || password.length < MIN_PASSWORD) return;
    setIsLoading("signup");
    try {
      const captchaToken = await captcha();
      if (!captchaToken) return;
      const { data, error } = await supabase.auth.signUp({ email: em, password, options: { captchaToken } });
      if (error) throw error;
      if (data.session) {
        onSuccess?.(); // confirmations off on the project — signed in already
        return;
      }
      // Supabase sends the "Confirm sign up" email with the 6-digit code.
      setVerifyType("signup");
      setEmailSent(true);
      setCooldown(60);
      startCooldownTimer();
      onEmailSent?.();
    } catch (error) {
      fail("Couldn’t create your account", error, "Please try again.");
    } finally {
      setIsLoading(null);
    }
  };

  const forgotPassword = async () => {
    const em = normalizedEmail();
    if (!em) {
      Alert.alert("Enter your email first", "Type the email you signed up with, then tap Forgot password.");
      return;
    }
    setIsLoading("reset");
    try {
      const captchaToken = await captcha();
      if (!captchaToken) return;
      const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: RESET_PASSWORD_URL, captchaToken });
      if (error) throw error;
      Alert.alert("Check your email", `If an account exists for ${em}, a link to choose a new password is on its way.`);
    } catch (error) {
      fail("Couldn’t send the reset email", error, "Please try again.");
    } finally {
      setIsLoading(null);
    }
  };

  const verifyCode = async () => {
    const em = normalizedEmail();
    if (!em || code.trim().length !== 6) return;
    setIsVerifying(true);
    try {
      let { data, error } = await supabase.auth.verifyOtp({ email: em, token: code.trim(), type: verifyType });
      // A sign-up code is 'signup' per the docs; older projects accept it as 'email'.
      if (error && verifyType === "signup") ({ data, error } = await supabase.auth.verifyOtp({ email: em, token: code.trim(), type: "email" }));
      if (error) throw error;
      if (data.session) onSuccess?.();
      else Alert.alert("Verification incomplete", "We couldn’t verify your session. Request a new code.");
    } catch (error) {
      fail("Invalid code", error, "The code is invalid or has expired. Check your email and try again.");
      setCode("");
    } finally {
      setIsVerifying(false);
    }
  };

  const resendCode = () => {
    if (cooldown !== 0) return;
    setCode("");
    void (verifyType === "signup" ? createWithPassword() : sendCode());
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

  const busy = isLoading !== null;

  if (!emailSent) {
    const emailInput = (
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
        editable={!busy}
        onSubmitEditing={mode === "code" ? sendCode : undefined}
        returnKeyType={mode === "code" ? "send" : "next"}
      />
    );
    if (mode === "code") {
      return (
        <YStack gap={10} width='100%'>
          {emailInput}
          <PrimaryButton label={isLoading === "code" ? "Sending…" : "Continue with email"} onPress={sendCode} disabled={!email.trim()} loading={isLoading === "code"} />
          <XStack justifyContent='center'>
            <PillButton label='Use a password instead' onPress={() => setMode("password")} />
          </XStack>
        </YStack>
      );
    }
    const canSubmit = !!email.trim() && password.length >= MIN_PASSWORD;
    return (
      <YStack gap={10} width='100%'>
        {emailInput}
        <Input
          {...inputBase}
          fontFamily='$body'
          fontSize={15}
          placeholder={`Password (${MIN_PASSWORD}+ characters)`}
          secureTextEntry
          autoCapitalize='none'
          autoCorrect={false}
          autoComplete='password'
          textContentType='password'
          value={password}
          onChangeText={setPassword}
          editable={!busy}
          onSubmitEditing={signInWithPassword}
          returnKeyType='go'
        />
        <PrimaryButton label={isLoading === "signin" ? "Signing in…" : "Sign in"} onPress={signInWithPassword} disabled={!email.trim() || !password || busy} loading={isLoading === "signin"} />
        <SecondaryButton label={isLoading === "signup" ? "Creating…" : "Create account with this password"} onPress={createWithPassword} disabled={!canSubmit || busy} borderRadius={radius.cta} />
        <XStack gap={8} justifyContent='center' flexWrap='wrap'>
          <PillButton label={isLoading === "reset" ? "Sending…" : "Forgot password?"} onPress={busy ? undefined : () => void forgotPassword()} />
          <PillButton label='Use a code instead' onPress={() => setMode("code")} />
        </XStack>
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
          We sent a 6-digit code to {normalizedEmail()}.
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
      <PrimaryButton label={isVerifying ? "Verifying…" : "Verify code"} onPress={verifyCode} disabled={code.length !== 6} loading={isVerifying} />
      <XStack gap={8} justifyContent='center'>
        <PillButton label={cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"} onPress={cooldown > 0 ? undefined : resendCode} />
        <PillButton label='Change email' onPress={resetFlow} />
      </XStack>
    </YStack>
  );
}

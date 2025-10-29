import React, { useState } from "react";
import { Alert } from "react-native";
import { Button, Text, Input, YStack, H6, XStack, Separator } from "tamagui";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

interface PasswordlessSignInProps {
  onSuccess?: () => void;
  onEmailSent?: () => void;
}

export default function PasswordlessSignIn({
  onSuccess,
  onEmailSent
}: PasswordlessSignInProps) {
  const { supabase } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const sendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true
        }
      });

      if (error) {
        throw error;
      }

      setEmailSent(true);
      setCooldown(60);
      startCooldownTimer();
      onEmailSent?.();
    } catch (error) {
      console.error("Send code error:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.";
      Alert.alert("Error", message);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !code.trim() || code.length !== 6) return;

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: code.trim(),
        type: "email"
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        onSuccess?.();
      } else {
        Alert.alert(
          "Verification Incomplete",
          "We couldn't verify your session. Please request a new code."
        );
      }
    } catch (error) {
      console.error("Code verification error:", error);
      const message =
        error instanceof Error
          ? error.message
          : "The code you entered is invalid or has expired. Please check your email and try again.";
      Alert.alert("Invalid Code", message);
      setCode(""); // Clear the code field on error
    } finally {
      setIsVerifying(false);
    }
  };

  const startCooldownTimer = () => {
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resendCode = () => {
    if (cooldown === 0) {
      setCode(""); // Clear code field when resending
      sendCode();
    }
  };

  const resetFlow = () => {
    setEmailSent(false);
    setCode("");
    setCooldown(0);
  };

  return (
    <YStack space='$3' width='100%'>
      {!emailSent ? (
        <YStack space='$3'>
          <Input
            size='$4'
            placeholder='Enter your email'
            keyboardType='email-address'
            autoCapitalize='none'
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            editable={!isLoading}
            borderWidth={1}
            borderColor='$borderColor'
            backgroundColor='$background'
            color='$text'
          />

          <Button
            backgroundColor={email.trim() && !isLoading ? "#1C252E" : "#F2F4F7"}
            size='$4'
            onPress={sendCode}
            disabled={!email.trim() || isLoading}
            opacity={!email.trim() || isLoading ? 0.6 : 1}
            borderRadius={6}
            borderWidth={1}
            borderColor={
              email.trim() && !isLoading ? "#1C252E" : "$borderColor"
            }
          >
            <Text
              color={email.trim() && !isLoading ? "white" : "#1C252E"}
              fontWeight='600'
            >
              {isLoading ? "Sending..." : "Send Code"}
            </Text>
          </Button>
        </YStack>
      ) : (
        <YStack space='$3'>
          <YStack
            bg='#F2F4F7'
            p='$3'
            borderLeftWidth={4}
            borderLeftColor='#1C252E'
          >
            <Text fontSize='$4' color='#1C252E' fontWeight='600'>
              Code sent to {email}
            </Text>
            <Text fontSize='$3' color='#666D80' mt='$1'>
              Enter the 6-digit code from your email below.
            </Text>
          </YStack>
          <Input
            size='$4'
            placeholder='Enter 6-digit code'
            keyboardType='number-pad'
            maxLength={6}
            value={code}
            onChangeText={setCode}
            editable={!isVerifying}
            borderWidth={1}
            borderColor='$borderColor'
            fontSize='$5'
            fontWeight='bold'
          />

          <Button
            backgroundColor={
              code.length === 6 && !isVerifying ? "#1C252E" : "#F2F4F7"
            }
            size='$4'
            borderRadius={6}
            borderWidth={1}
            borderColor={
              code.length === 6 && !isVerifying ? "#1C252E" : "$borderColor"
            }
            onPress={verifyCode}
            disabled={code.length !== 6 || isVerifying}
            opacity={code.length !== 6 || isVerifying ? 0.6 : 1}
          >
            <Text
              color={code.length === 6 && !isVerifying ? "white" : "#1C252E"}
              fontWeight='600'
            >
              {isVerifying ? "Verifying..." : "Verify Code"}
            </Text>
          </Button>

          {/* @ts-ignore */}
          <XStack space='$2' justifyContent='center'>
            <Button
              size='$3'
              onPress={resendCode}
              disabled={cooldown > 0}
              opacity={cooldown > 0 ? 0.6 : 1}
              paddingHorizontal={16}
              borderRadius={6}
              borderWidth={1}
              borderColor={cooldown > 0 ? "#1C252E" : "$borderColor"}
            >
              <Text fontWeight='500'>
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
              </Text>
            </Button>

            <Button
              size='$3'
              variant='outlined'
              onPress={resetFlow}
              borderRadius={6}
              borderWidth={1}
              borderColor='$borderColor'
            >
              <Text fontWeight='500'>Change Email</Text>
            </Button>
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}

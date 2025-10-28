import React, { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { Button, Text, Input, YStack, H4, H6 } from "tamagui";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

interface PasswordlessVerifyProps {
  email?: string;
  onSuccess?: () => void;
  onBack?: () => void;
}

export default function PasswordlessVerify({
  email,
  onSuccess,
  onBack
}: PasswordlessVerifyProps) {
  const { supabase } = useSupabaseAuth();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const verifyCode = async () => {
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      Alert.alert(
        "Missing Email",
        "We need your email address to verify the code."
      );
      return;
    }

    if (!code.trim() || code.length !== 6) {
      Alert.alert("Invalid Code", "Please enter a 6-digit code.");
      return;
    }

    setIsVerifying(true);
    setVerificationStatus("idle");

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
        setVerificationStatus("success");

        if (onSuccess) {
          onSuccess();
        } else {
          setTimeout(() => {
            router.replace("/");
          }, 1500);
        }
      } else {
        console.error("Verification returned without session", data);
        setVerificationStatus("error");
        Alert.alert(
          "Verification Failed",
          "The verification process is not complete. Please request a new code."
        );
      }
    } catch (error) {
      console.error("Code verification error:", error);
      setVerificationStatus("error");

      Alert.alert(
        "Invalid Code",
        error instanceof Error
          ? error.message
          : "The code you entered is invalid or has expired. Please check your email and try again.",
        [
          {
            text: "Try Again",
            onPress: () => setCode("")
          },
          {
            text: "Back to Sign In",
            style: "cancel",
            onPress: () => {
              if (onBack) {
                onBack();
              } else {
                router.replace("/sign-in");
              }
            }
          }
        ]
      );
    } finally {
      setIsVerifying(false);
    }
  };

  if (verificationStatus === "success") {
    return (
      // @ts-ignore
      <YStack flex={1} space='$4' p='$4'>
        <YStack width={60} height={60} bg='$green8'>
          <Text color='white' fontSize='$8'>
            ✓
          </Text>
        </YStack>
        <H4 color='$green10' fontWeight='bold'>
          Sign-in Successful!
        </H4>
        <Text fontSize='$4' color='gray'>
          Redirecting to the app...
        </Text>
      </YStack>
    );
  }

  return (
    <YStack flex={1} p='$4' space='$4'>
      <YStack space='$2'>
        <H4>Verify Your Email</H4>
        {email && <Text color='gray'>We sent a 6-digit code to {email}</Text>}
      </YStack>

      <YStack bg='$blue2' p='$3' borderLeftWidth={4} borderLeftColor='$blue8'>
        <Text fontSize='$4' color='$blue11' fontWeight='600'>
          Check your email
        </Text>
        <Text fontSize='$3' color='$blue10' mt='$1'>
          Enter the 6-digit verification code we just sent you.
        </Text>
      </YStack>

      <YStack space='$3'>
        <H6>Verification Code</H6>
        <Input
          size='$4'
          placeholder='000000'
          keyboardType='number-pad'
          maxLength={6}
          value={code}
          onChangeText={setCode}
          editable={!isVerifying}
          borderWidth={1}
          borderColor='$borderColor'
          fontSize='$6'
          fontWeight='bold'
        />
      </YStack>

      <YStack space='$3'>
        <Button
          theme={code.length === 6 && !isVerifying ? "blue" : undefined}
          size='$4'
          onPress={verifyCode}
          disabled={code.length !== 6 || isVerifying}
          opacity={code.length !== 6 || isVerifying ? 0.6 : 1}
        >
          <Text color='white' fontWeight='bold'>
            {isVerifying ? "Verifying..." : "Verify Code"}
          </Text>
        </Button>

        {onBack && (
          <Button
            size='$4'
            variant='outlined'
            onPress={onBack}
            disabled={isVerifying}
          >
            <Text fontWeight='500'>Back</Text>
          </Button>
        )}
      </YStack>

      <YStack mt='$4'>
        <Text fontSize='$3' color='gray'>
          Didn't receive the code? Check your spam folder or try requesting a
          new code.
        </Text>
      </YStack>
    </YStack>
  );
}

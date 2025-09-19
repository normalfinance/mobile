import React, { useState } from "react";
import {
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator
} from "react-native";
import { useSignIn } from "@clerk/clerk-expo";

interface MagicLinkSignInProps {
  onSuccess?: () => void;
  onEmailSent?: () => void;
}

export default function MagicLinkSignIn({
  onSuccess,
  onEmailSent
}: MagicLinkSignInProps) {
  const { signIn, isLoaded } = useSignIn();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const sendMagicLink = async () => {
    if (!isLoaded || !email.trim()) return;

    setIsLoading(true);
    try {
      const signInAttempt = await signIn.create({
        identifier: email
      });

      if (!signInAttempt.supportedFirstFactors) {
        throw new Error("Email link factor not supported");
      }

      const { strategy } = signInAttempt.supportedFirstFactors.find(
        (factor: any) => factor.strategy === "email_link"
      ) as { strategy: string };

      if (strategy) {
        await signIn.prepareFirstFactor({
          strategy: "email_link",
          emailAddressId: "", //TODO: figure out what is this
          redirectUrl: "normalapp://verify-magic-link"
        });

        setEmailSent(true);
        setCooldown(60); // 60 second cooldown
        startCooldownTimer();
        onEmailSent?.();

        Alert.alert(
          "Magic Link Sent",
          "Check your email for a magic link to sign in.",
          [{ text: "OK" }]
        );
      }
    } catch (error: any) {
      console.error("Magic link error:", error);
      Alert.alert(
        "Error",
        error.errors?.[0]?.message ||
          "Failed to send magic link. Please try again."
      );
    } finally {
      setIsLoading(false);
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

  const resendMagicLink = () => {
    if (cooldown === 0) {
      sendMagicLink();
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 20 }}>
        Sign in with Magic Link
      </Text>

      <TextInput
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 8,
          padding: 12,
          marginBottom: 20,
          fontSize: 16
        }}
        value={email}
        onChangeText={setEmail}
        placeholder='Enter your email'
        keyboardType='email-address'
        autoCapitalize='none'
        autoCorrect={false}
        editable={!isLoading}
      />

      {!emailSent ? (
        <TouchableOpacity
          style={{
            backgroundColor: email.trim() && !isLoading ? "#007AFF" : "#ccc",
            padding: 15,
            borderRadius: 8,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center"
          }}
          onPress={sendMagicLink}
          disabled={!email.trim() || isLoading}
        >
          {isLoading && (
            <ActivityIndicator
              size='small'
              color='white'
              style={{ marginRight: 10 }}
            />
          )}
          <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
            {isLoading ? "Sending..." : "Send Magic Link"}
          </Text>
        </TouchableOpacity>
      ) : (
        <View>
          <View
            style={{
              backgroundColor: "#f0f9ff",
              padding: 15,
              borderRadius: 8,
              borderLeftWidth: 4,
              borderLeftColor: "#0ea5e9",
              marginBottom: 15
            }}
          >
            <Text style={{ fontSize: 16, color: "#0369a1" }}>
              Magic link sent to {email}
            </Text>
            <Text style={{ fontSize: 14, color: "#075985", marginTop: 5 }}>
              Check your email and click the link to sign in.
            </Text>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: cooldown > 0 ? "#ccc" : "#007AFF",
              padding: 15,
              borderRadius: 8,
              alignItems: "center"
            }}
            onPress={resendMagicLink}
            disabled={cooldown > 0}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Magic Link"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

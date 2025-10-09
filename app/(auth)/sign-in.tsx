import { useOAuth } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect } from "react";
import { Alert } from "react-native";
import { Image } from "expo-image";
import PasswordlessSignIn from "@/components/passwordless-signin";
import { Button, Paragraph, Text, XStack, YStack, Separator } from "tamagui";

const useWarmUpBrowser = () => {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

export default function SignInScreen() {
  const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({
    strategy: "oauth_google"
  });
  const { startOAuthFlow: startAppleOAuthFlow } = useOAuth({
    strategy: "oauth_apple"
  });

  const router = useRouter();

  useWarmUpBrowser();

  const onGoogleSignInPress = React.useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startGoogleOAuthFlow({});

      if (createdSessionId) {
        setActive?.({ session: createdSessionId });
        router.replace("/");
      }
    } catch (err) {
      console.error("Google OAuth error", err);
      Alert.alert("Error", "Failed to sign in with Google");
    }
  }, [startGoogleOAuthFlow, router]);

  const onAppleSignInPress = React.useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startAppleOAuthFlow({});

      if (createdSessionId) {
        setActive?.({ session: createdSessionId });
        router.replace("/");
      }
    } catch (err) {
      console.error("Apple OAuth error", err);
      Alert.alert("Error", "Failed to sign in with Apple");
    }
  }, [startAppleOAuthFlow, router]);

  return (
    <YStack
      flex={1}
      bg='#F7F8FA'
      alignItems='center'
      justifyContent='space-around'
      p='$4'
    >
      <YStack alignItems='center' space='$4' justifyContent='space-between'>
        <YStack
          width={64}
          height={64}
          borderRadius={44}
          borderWidth={3}
          borderColor='rgba(148,163,184,0.1)'
          bg='white'
          alignItems='center'
          justifyContent='center'
          shadowColor='rgba(15, 23, 42, 0.08)'
          shadowOffset={{ width: 0, height: 12 }}
          shadowOpacity={1}
          shadowRadius={24}
          overflow='hidden'
        >
          <Image
            source={require("@/assets/icons/normal.png")}
            style={{ width: 56, height: 56 }}
          />
        </YStack>

        <YStack space='$2' alignItems='center'>
          <Text fontSize={24} fontWeight='500' color='#0D0D12'>
            Sign in to your account
          </Text>
          <Paragraph
            color='#666D80'
            textAlign='center'
            fontWeight='400'
            fontSize={16}
          >
            Welcome back! Please enter your details
          </Paragraph>
        </YStack>
      </YStack>

      <PasswordlessSignIn onSuccess={() => router.replace("/")} />
      <XStack
        // @ts-ignore
        justifyContent='center'
        alignItems='center'
        mv='$4'
      >
        <Separator flex={1} mr='$3' />
        <Text color='$color10'>OR</Text>
        <Separator flex={1} ml='$3' />
      </XStack>

      <YStack space='$3' width='100%'>
        <Button
          size='$5'
          backgroundColor='#FFFFFF'
          borderColor='rgba(208, 213, 221, 0.8)'
          borderWidth={1}
          borderRadius={6}
          fontWeight='600'
          onPress={onGoogleSignInPress}
        >
          <XStack alignItems='center' justifyContent='center' space='$3'>
            <Image
              source={require("@/assets/icons/auth/google.png")}
              style={{ width: 24, height: 24 }}
            />
            <Text color='#101828' fontWeight='600'>
              Sign in with Google
            </Text>
          </XStack>
        </Button>

        <Button
          size='$5'
          backgroundColor='#FFFFFF'
          borderColor='$borderColor'
          borderWidth={1}
          borderRadius={6}
          onPress={onAppleSignInPress}
        >
          <XStack alignItems='center' justifyContent='center' space='$3'>
            <Image
              source={require("@/assets/icons/auth/apple.png")}
              style={{ width: 24, height: 24 }}
            />
            <Text color='#1C252E' fontWeight='600'>
              Sign in with Apple
            </Text>
          </XStack>
        </Button>
      </YStack>
    </YStack>
  );
}

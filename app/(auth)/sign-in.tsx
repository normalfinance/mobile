import { useOAuth } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect } from "react";
import { Alert } from "react-native";
import { Image } from "expo-image";
import PasswordlessSignIn from "@/components/passwordless-signin";
import { secureStorage } from "@/lib/utils";
import { STORAGE_KEYS } from "@/lib/constants";
import { Button, Paragraph, Text, XStack, YStack, Separator } from "tamagui";
import { useClerk, useSignIn } from "@clerk/clerk-expo";
import * as AuthSession from "expo-auth-session";

WebBrowser.maybeCompleteAuthSession();

const useWarmUpBrowser = () => {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

export default function SignInScreen() {
  const { loaded } = useClerk();
  const { signIn, isLoaded } = useSignIn();

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const redirectUrl = AuthSession.makeRedirectUri({
    scheme: "normal-app",
    path: "oauth/callback"
  });

  console.log("redirectUrl", redirectUrl);

  const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({
    strategy: "oauth_google",
    redirectUrl: "https://clerk.normalfinance.io/v1/oauth_callback"
  });
  const { startOAuthFlow: startAppleOAuthFlow } = useOAuth({
    strategy: "oauth_apple",
    redirectUrl: redirectUrl
  });

  const router = useRouter();

  useWarmUpBrowser();

  const onGoogleSignInPress = React.useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startGoogleOAuthFlow({});

      if (!createdSessionId) {
        return;
      }

      setActive?.({ session: createdSessionId });
      await secureStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, "true");
      router.replace("/");
    } catch (err) {
      setErrorMessage(JSON.stringify(err));
      console.error("Google OAuth error", err);
      Alert.alert("Error", "Failed to sign in with Google");
    }
  }, [startGoogleOAuthFlow, router]);

  const onAppleSignInPress = React.useCallback(async () => {
    console.log("onAppleSignInPress", loaded, isLoaded);
    if (!loaded || !isLoaded) return;

    try {
      const { createdSessionId, setActive } = await startAppleOAuthFlow({});

      if (!createdSessionId) {
        return;
      }

      setActive?.({ session: createdSessionId });
      await secureStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, "true");
      router.replace("/");
    } catch (err) {
      setErrorMessage(JSON.stringify(err));
      console.error("Apple OAuth error", err);
      Alert.alert("Error", "Failed to sign in with Apple");
    }
  }, [startAppleOAuthFlow, router]);

  useEffect(() => {
    if (!isLoaded || !signIn) return;
    const strategies =
      signIn.supportedSecondFactors?.map((factor) => factor.strategy) ??
      signIn.supportedFirstFactors?.map((factor) => factor.strategy) ??
      [];
    console.log("Supported OAuth strategies:", strategies);
  }, [isLoaded, signIn]);

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
            Sign in to Normal
          </Text>
          <Text>{redirectUrl}</Text>
          <Text color='black'>{errorMessage}</Text>
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

      <PasswordlessSignIn
        onSuccess={async () => {
          await secureStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, "true");
          router.replace("/");
        }}
      />
      <XStack
        // @ts-ignore
        justifyContent='center'
        alignItems='center'
        mv='$0'
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
          backgroundColor='#000000'
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
            <Text color='#FFFFFF' fontWeight='600'>
              Sign in with Apple
            </Text>
          </XStack>
        </Button>
      </YStack>
    </YStack>
  );
}

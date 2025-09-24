import { useOAuth, useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect } from "react";
import PasswordlessSignIn from "@/components/passwordless-signin";
import {
  Button,
  Text,
  H6,
  H3,
  H4,
  Input,
  XStack,
  YStack,
  Separator
} from "tamagui";

export default function Page() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");

  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });

  const useWarmUpBrowser = () => {
    useEffect(() => {
      console.log("useWarmUpBrowser");
      void WebBrowser.warmUpAsync();
      return () => {
        console.log("useWarmUpBrowser coolDownAsync");
        void WebBrowser.coolDownAsync();
      };
    }, []);
  };

  useWarmUpBrowser();

  const onPasswordSignInPress = React.useCallback(async () => {
    if (!isLoaded) return;

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password
      });

      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace("/");
      } else {
        console.error("Sign-in not complete", signInAttempt);
      }
    } catch (err: any) {
      console.error("Password sign-in error", err);
      Alert.alert("Error", err.errors?.[0]?.message || "Failed to sign in");
    }
  }, [isLoaded, emailAddress, password, signIn, setActive, router]);

  const onOAuthSignInPress = React.useCallback(async () => {
    console.log("onOAuthSignInPress");
    try {
      const { createdSessionId, setActive } = await startOAuthFlow({});

      if (createdSessionId) {
        console.log("createdSessionId", createdSessionId);
        setActive!({ session: createdSessionId });
        router.replace("/");
      }
    } catch (err) {
      console.error("OAuth error", err);
      Alert.alert("Error", "Failed to sign in with Google");
    }
  }, [startOAuthFlow, router]);

  return (
    <YStack flex={1} px='$4'>
      <H3 my='$3'>Auth boilerplates</H3>
      {/* Password sign-in */}
      <YStack>
        <H6 mb='$3'>Sign in with Email & Password</H6>
        <Input
          size='$4'
          mb='$3'
          borderWidth={1}
          borderColor='$borderColor'
          autoCapitalize='none'
          value={emailAddress}
          placeholder='Enter email'
          keyboardType='email-address'
          onChangeText={setEmailAddress}
        />
        <Input
          size='$4'
          mb='$3'
          borderWidth={1}
          borderColor='$borderColor'
          value={password}
          placeholder='Enter password'
          secureTextEntry={true}
          onChangeText={setPassword}
        />
        <Button
          theme={emailAddress && password ? "blue" : null}
          size='$4'
          mb='$3'
          onPress={onPasswordSignInPress}
          disabled={!emailAddress || !password}
        >
          Sign In
        </Button>
      </YStack>
      {/* OR Separator */}
      {/* @ts-ignore */}
      <XStack justify='center' alignItems='center' justifyContent='center' my='$3'>
        <Separator flex={1} mr='$3' />
        <Text color='$color10'>OR</Text>
        <Separator flex={1} ml='$3' />
      </XStack>
      {/* Passwordless sign-in */}
      <YStack>
        <PasswordlessSignIn />
      </YStack>
      {/* OR Separator */}
      {/* @ts-ignore */}
      <XStack justify='center' alignItems='center' justifyContent='center' my='$3'>
        <Separator flex={1} mr='$3' />
        <Text color='$color10'>OR</Text>
        <Separator flex={1} ml='$3' />
      </XStack>
      {/* OAuth sign-in */}
      <YStack>
        <H6 mb='$3'>Continue with Google</H6>
        <Button theme='blue' size='$4' onPress={onOAuthSignInPress} mb='$3'>
          Continue with Google
        </Button>
      </YStack>
      {/* Sign up link */}
      <XStack>
        <Text color='$color10'>Dont have an account?</Text>
        <Link href='/sign-up'>
          <Text color='$blue10' fontWeight='bold'>
            Sign up
          </Text>
        </Link>
      </XStack>
    </YStack>
  );
}

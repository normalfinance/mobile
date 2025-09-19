import { useOAuth, useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect } from "react";

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

  const onSignInPress = React.useCallback(async () => {
    console.log("onSignInPress");
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
  }, []);

  return (
    <View>
      <Text>Sign in</Text>
      <TextInput
        autoCapitalize='none'
        value={emailAddress}
        placeholder='Enter email'
        onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
      />
      <TextInput
        value={password}
        placeholder='Enter password'
        secureTextEntry={true}
        onChangeText={(password) => setPassword(password)}
      />
      <TouchableOpacity onPress={onSignInPress}>
        <Text>Continue</Text>
      </TouchableOpacity>
      <View style={{ display: "flex", flexDirection: "row", gap: 3 }}>
        <Text>Don't have an account?</Text>
        <Link href='/sign-up'>
          <Text>Sign up</Text>
        </Link>
      </View>
    </View>
  );
}

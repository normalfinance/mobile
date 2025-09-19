import { useOAuth, useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect } from "react";
import MagicLinkSignIn from "@/components/magic-link-signin";

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
    <View style={{ flex: 1, padding: 20, backgroundColor: "white" }}>
      <Text
        style={{
          fontSize: 28,
          fontWeight: "bold",
          marginBottom: 30,
          textAlign: "center"
        }}
      >
        Auth boilerplates
      </Text>

      {/* Password sign-in */}
      <View style={{ marginBottom: 30 }}>
        <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 15 }}>
          Sign in with Email & Password
        </Text>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 8,
            padding: 12,
            marginBottom: 15,
            fontSize: 16
          }}
          autoCapitalize='none'
          value={emailAddress}
          placeholder='Enter email'
          keyboardType='email-address'
          onChangeText={setEmailAddress}
        />
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 8,
            padding: 12,
            marginBottom: 20,
            fontSize: 16
          }}
          value={password}
          placeholder='Enter password'
          secureTextEntry={true}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          style={{
            backgroundColor: emailAddress && password ? "#007AFF" : "#ccc",
            padding: 15,
            borderRadius: 8,
            alignItems: "center"
          }}
          onPress={onPasswordSignInPress}
          disabled={!emailAddress || !password}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
            Sign In
          </Text>
        </TouchableOpacity>
      </View>

      {/* OR Separator */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginVertical: 5
        }}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: "#ddd" }} />
        <Text style={{ marginHorizontal: 15, color: "#666", fontSize: 16 }}>
          OR
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: "#ddd" }} />
      </View>

      {/* Magic Link sign-in */}
      <View style={{ marginBottom: 5 }}>
        <MagicLinkSignIn />
      </View>

      {/* OR Separator */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginVertical: 15
        }}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: "#ddd" }} />
        <Text style={{ marginHorizontal: 15, color: "#666", fontSize: 16 }}>
          OR
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: "#ddd" }} />
      </View>

      {/* OAuth sign-in */}
      <View style={{ marginBottom: 30 }}>
        <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 15 }}>
          Continue with Google
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: "#007AFF",
            padding: 15,
            borderRadius: 8,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center"
          }}
          onPress={onOAuthSignInPress}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
            Continue with Google
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sign up link */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          marginTop: 30,
          gap: 5
        }}
      >
        <Text style={{ color: "#666" }}>Dont have an account?</Text>
        <Link href='/sign-up'>
          <Text style={{ color: "#007AFF", fontWeight: "bold" }}>Sign up</Text>
        </Link>
      </View>
    </View>
  );
}

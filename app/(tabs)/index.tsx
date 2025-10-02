import React from "react";
import { YStack, H2, Text, Spacer, XStack } from "tamagui";
import { SignOutButton } from "@/components/sign-out";
import { Camera } from "lucide-react-native";

export default function HomeScreen() {
  return (
    // @ts-ignore
    <YStack flex={1} padding='$4' backgroundColor='$background'>
      {/* @ts-ignore */}
      <H2 marginBottom='$4'>RagGy</H2>

      {/* @ts-ignore */}
      <XStack alignItems='center'>
        <Text>Welcome to Normal Finance</Text>
        <Camera />
      </XStack>

      <Spacer size='$4' />
      <SignOutButton />
    </YStack>
  );
}

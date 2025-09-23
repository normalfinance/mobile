import React from "react";
import { YStack, H2, Text, Spacer } from "tamagui";
import { SignOutButton } from "@/components/sign-out";

export default function HomeScreen() {
  return (
    // @ts-ignore
    <YStack flex={1} padding='$4' backgroundColor='$background'>
      {/* @ts-ignore */}
      <H2 marginBottom='$4'>Home</H2>
      <Text>Welcome to Normal Finance</Text>
      <Spacer size='$4' />
      <SignOutButton />
    </YStack>
  );
}

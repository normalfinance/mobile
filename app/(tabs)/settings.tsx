import React from "react";
import { YStack, XStack, H2 } from "tamagui";
import { SignOutButton } from "@/components/sign-out";

export default function SettingsScreen() {
  return (
    // @ts-ignore
    <YStack flex={1} backgroundColor='$background'>
      {/* @ts-ignore */}
      <YStack padding='$4'>
        {/* @ts-ignore */}
        <H2 marginBottom='$4'>Settings</H2>
        <SignOutButton />
      </YStack>
    </YStack>
  );
}

import { Redirect, Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@clerk/clerk-expo";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  const { isSignedIn, userId } = useAuth();

  if (!isSignedIn) {
    return <Redirect href='/sign-in' />;
  }

  if (userId) {
    console.log("userId", userId);
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab
      }}
    >
      <Tabs.Screen
        name='index'
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name='house.fill' color={color} />
          )
        }}
      />
      <Tabs.Screen
        name='explore'
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name='paperplane.fill' color={color} />
          )
        }}
      />
    </Tabs>
  );
}

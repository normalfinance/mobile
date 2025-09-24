import { Redirect } from "expo-router";
import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { Tabs, YStack, H6, Text, View, Spinner } from "tamagui";
import { SafeAreaView } from "react-native-safe-area-context";

import HomeScreen from "./index";
import InvestScreen from "./invest";
import AssetsScreen from "./assets";
import SettingsScreen from "./settings";
import { WalletService } from "@/services";

export default function TabLayout() {
  const { isSignedIn, userId } = useAuth();
  const [activeTab, setActiveTab] = useState("home");
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const [isCheckingWallet, setIsCheckingWallet] = useState(true);

  if (!isSignedIn) {
    return <Redirect href='/sign-in' />;
  }

  useEffect(() => {
    const checkWalletExists = async () => {
      if (!userId) {
        setIsCheckingWallet(false);
        return;
      }

      console.log("Checking wallet existence for user:", userId);
      try {
        const hasWalletResult = await WalletService.hasWallet();
        console.log("Wallet check result:", hasWalletResult);
        setHasWallet(hasWalletResult);
      } catch (error) {
        console.error("Error checking wallet existence:", error);
        setHasWallet(false);
      } finally {
        setIsCheckingWallet(false);
      }
    };

    checkWalletExists();
  }, [userId]);

  if (isCheckingWallet) {
    return (
      // @ts-ignore
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
        <Spinner size="large" color="$blue10" />
        {/* @ts-ignore */}
        <Text marginTop="$4" color="$color11">
          Checking wallet...
        </Text>
      </YStack>
    );
  }

  if (hasWallet === false) {
    console.log("No wallet found, redirecting to wallet setup");
    return <Redirect href='/wallet-setup' />;
  }

  if (userId) {
    console.log("userId", userId, "hasWallet", hasWallet);
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "home":
        return <HomeScreen />;
      case "invest":
        return <InvestScreen />;
      case "assets":
        return <AssetsScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    // @ts-ignore
    <View flex={1} backgroundColor='$background'>
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1}>
          <YStack flex={1}>{renderTabContent()}</YStack>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            orientation='horizontal'
            flexDirection='row'
            width='100%'
          >
            <Tabs.List
              backgroundColor='$background'
              borderTopWidth={1}
              borderTopColor='$borderColor'
              width='100%'
            >
              <Tabs.Tab value='home' flex={1}>
                <Text>Home</Text>
              </Tabs.Tab>
              <Tabs.Tab value='invest' flex={1}>
                <Text>Invest</Text>
              </Tabs.Tab>
              <Tabs.Tab value='assets' flex={1}>
                <Text>Assets</Text>
              </Tabs.Tab>
              <Tabs.Tab value='settings' flex={1}>
                <Text>Settings</Text>
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>
        </YStack>
      </SafeAreaView>
    </View>
  );
}

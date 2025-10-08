import { Redirect, usePathname, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { Tabs, YStack, H6, Text, View, Spinner } from "tamagui";
import { SafeAreaView } from "react-native-safe-area-context";

import HomeScreen from "./index";
import InvestScreen from "./invest";
import AssetsScreen from "./assets";
import PricesScreen from "./prices";
import SettingsScreen from "./settings";
import {
  useHasWallet,
  useHasWalletWithBackendCheck,
  useAuthCredentials
} from "@/services";

type TabKey = "home" | "prices" | "invest" | "assets" | "settings";

const tabRoutes: Record<
  TabKey,
  `/(${"tabs"})${"" | "/prices" | "/invest" | "/assets" | "/settings"}`
> = {
  home: "/(tabs)",
  prices: "/(tabs)/prices",
  invest: "/(tabs)/invest",
  assets: "/(tabs)/assets",
  settings: "/(tabs)/settings"
};

export default function TabLayout() {
  const { isSignedIn, userId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<TabKey>("settings");
  const { data: credentials, isLoading: isLoadingCredentials } =
    useAuthCredentials();
  const { data: hasLocalWallet, isLoading: isCheckingLocalWallet } =
    useHasWallet();
  const shouldCheckBackend = !!credentials && hasLocalWallet === false;
  const { data: hasBackendWallet, isLoading: isCheckingBackendWallet } =
    useHasWalletWithBackendCheck(credentials, shouldCheckBackend);

  const isCheckingWallet =
    isLoadingCredentials ||
    isCheckingLocalWallet ||
    (shouldCheckBackend && isCheckingBackendWallet);

  const resolvedHasWallet =
    hasLocalWallet === true
      ? true
      : hasBackendWallet === true
      ? true
      : hasLocalWallet === false &&
        (!shouldCheckBackend || hasBackendWallet === false)
      ? false
      : undefined;

  useEffect(() => {
    console.log("pathname", pathname);

    const segments = pathname.split("/").filter(Boolean);
    const possibleSegment = segments[0];
    const tabSegment: TabKey =
      possibleSegment && possibleSegment in tabRoutes
        ? (possibleSegment as TabKey)
        : "home";

    if (tabSegment !== activeTab) {
      setActiveTab(tabSegment);
    }
  }, [pathname]);

  if (!isSignedIn) {
    return <Redirect href='/sign-in' />;
  }

  if (isCheckingWallet) {
    return (
      // @ts-ignore
      <YStack
        flex={1}
        // @ts-ignore
        justifyContent='center'
        alignItems='center'
        backgroundColor='$background'
      >
        <Spinner size='large' color='$blue10' />
        {/* @ts-ignore */}
        <Text marginTop='$4' color='$color11'>
          Checking wallet...
        </Text>
      </YStack>
    );
  }

  if (resolvedHasWallet === false) {
    console.log("No wallet found, redirecting to wallet setup");
    return <Redirect href='/wallet-setup' />;
  }

  if (userId) {
    console.log("userId", userId, "hasWallet", resolvedHasWallet);
  }

  const handleTabChange = (value: TabKey) => {
    console.log("handleTabChange", value);
    setActiveTab(value);
    router.push(tabRoutes[value]);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "home":
        return <HomeScreen />;
      case "prices":
        return <PricesScreen />;
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
            onValueChange={handleTabChange}
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
              <Tabs.Tab value='prices' flex={1}>
                <Text>Prices</Text>
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

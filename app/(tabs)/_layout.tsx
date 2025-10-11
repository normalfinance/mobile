import { Redirect, usePathname, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { Tabs, YStack, Text, View, Spinner } from "tamagui";
import { SafeAreaView } from "react-native-safe-area-context";

import HomeScreen from "./index";
import InvestScreen from "./invest";
import PricesScreen from "./prices";
import IndexesScreen from "./indexes";
import SettingsScreen from "./settings";
import {
  useHasWallet,
  useHasWalletWithBackendCheck,
  useAuthCredentials
} from "@/services";

import {
  HomeIcon,
  PricesIcon,
  InvestIcon,
  IndexesIcon,
  SettingsIcon,
  type NavbarIconProps
} from "@/components/icons/navbar";

type TabKey = "home" | "prices" | "invest" | "indexes" | "settings";

const tabRoutes: Record<
  TabKey,
  `/(${"tabs"})${"" | "/prices" | "/invest" | "/indexes" | "/settings"}`
> = {
  home: "/(tabs)",
  prices: "/(tabs)/prices",
  invest: "/(tabs)/invest",
  indexes: "/(tabs)/indexes",
  settings: "/(tabs)/settings"
};

type TabItem = {
  key: TabKey;
  label: string;
  Icon: React.FC<NavbarIconProps>;
};

const TAB_ITEMS: TabItem[] = [
  {
    key: "home",
    label: "Home",
    Icon: HomeIcon
  },
  {
    key: "prices",
    label: "Prices",
    Icon: PricesIcon
  },
  {
    key: "invest",
    label: "Invest",
    Icon: InvestIcon
  },
  {
    key: "indexes",
    label: "Indexes",
    Icon: IndexesIcon
  },
  {
    key: "settings",
    label: "Settings",
    Icon: SettingsIcon
  }
];

const ACTIVE_TAB_COLOR = "#1C252E";
const INACTIVE_TAB_COLOR = "#9DB2CE";

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
      case "indexes":
        return <IndexesScreen />;
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
              paddingVertical='$2'
              gap='$0'
            >
              {TAB_ITEMS.map(({ key, label, Icon }) => {
                const isActive = activeTab === key;
                const color = isActive ? ACTIVE_TAB_COLOR : INACTIVE_TAB_COLOR;

                return (
                  <Tabs.Tab
                    key={key}
                    value={key}
                    flex={1}
                    alignItems='center'
                    justifyContent='center'
                    paddingVertical='$1'
                    paddingHorizontal='$0'
                  >
                    <YStack alignItems='center' space='$1'>
                      <Icon color={color} />
                      <Text
                        fontSize='$1'
                        fontWeight={isActive ? "600" : "500"}
                        color={color}
                      >
                        {label}
                      </Text>
                    </YStack>
                  </Tabs.Tab>
                );
              })}
            </Tabs.List>
          </Tabs>
        </YStack>
      </SafeAreaView>
    </View>
  );
}

import { Redirect, usePathname, useRouter } from "expo-router";
import React from "react";
import { useAuth } from "@clerk/clerk-expo";
import { Tabs, YStack, Text, View, Spinner } from "tamagui";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import HomeScreen from "./index";
import InvestScreen from "./invest";
import PricesScreen from "./prices";
import IndexesScreen from "./indexes";
import SettingsScreen from "./settings";
import WalletSettingsScreen from "./wallet-settings";
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

type TabKey = "home" | "prices" | "invest" | "indexes" | "settings" | "wallet-settings";

const tabRoutes: Record<
  TabKey,
  `/(${"tabs"})${"" | "/prices" | "/invest" | "/indexes" | "/settings" | "/wallet-settings"}`
> = {
  home: "/(tabs)",
  prices: "/(tabs)/prices",
  invest: "/(tabs)/invest",
  indexes: "/(tabs)/indexes",
  settings: "/(tabs)/settings",
  "wallet-settings": "/(tabs)/wallet-settings"
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
  const insets = useSafeAreaInsets();
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

  const activeTab = React.useMemo<TabKey>(() => {
    console.log("pathname", pathname);
    const segments = pathname.split("/").filter(Boolean);
    const possibleSegment = segments[0];
    console.log("possibleSegment", possibleSegment);
    console.log("tabRoutes", tabRoutes);
    return possibleSegment && possibleSegment in tabRoutes
      ? (possibleSegment as TabKey)
      : "home";
  }, [pathname]);

  const handleTabChange = (value: TabKey) => {
    console.log("handleTabChange", value);
    if (value !== activeTab) {
      router.push(tabRoutes[value]);
    }
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
      case "wallet-settings":
        return <WalletSettingsScreen />;
      default:
        return <HomeScreen />;
    }
  };

  if (userId) {
    console.log("userId", userId, "hasWallet", resolvedHasWallet);
  }

  // Single return with all conditional rendering
  return (
    <>
      {!isSignedIn ? (
        <Redirect href='/sign-in' />
      ) : isCheckingWallet ? (
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
      ) : resolvedHasWallet === false ? (
        <>
          {console.log("No wallet found, redirecting to wallet setup")}
          <Redirect href='/wallet-setup' />
        </>
      ) : (
        // @ts-ignore
        <View flex={1} backgroundColor='$background'>
          <YStack flex={1}>
            <SafeAreaView style={{ flex: 1, paddingBottom: 0 }}>
              <YStack 
                flex={1} 
                paddingBottom={20 + insets.bottom}
              >
                {renderTabContent()}
              </YStack>
            </SafeAreaView>

            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              orientation='horizontal'
              flexDirection='row'
              width='100%'
              position='absolute'
              bottom={0}
              left={0}
              right={0}
            >
              <Tabs.List
                backgroundColor='$background'
                borderTopWidth={1}
                borderTopColor='$borderColor'
                width='100%'
                paddingVertical='$2'
                paddingBottom={insets.bottom + 8}
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
        </View>
      )}
    </>
  );
}

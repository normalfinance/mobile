import { Redirect, usePathname, useRouter } from "expo-router";
import React from "react";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";
import { Tabs, YStack, Text, View } from "tamagui";
import {
  SafeAreaView,
  useSafeAreaInsets
} from "react-native-safe-area-context";

import HomeScreen from "./index";
import PricesScreen from "./prices";
import SettingsScreen from "./settings";
import WalletSettingsScreen from "./wallet-settings";
import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";

import {
  HomeIcon,
  PricesIcon,
  SettingsIcon,
  type NavbarIconProps
} from "@/components/icons/navbar";
import { SkeletonBox } from "@/components/ui/skeleton";

type TabKey = "home" | "prices" | "settings" | "wallet-settings";

const tabRoutes: Record<
  TabKey,
  `/(${"tabs"})${"" | "/prices" | "/settings" | "/wallet-settings"}`
> = {
  home: "/(tabs)",
  prices: "/(tabs)/prices",
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
    key: "settings",
    label: "Settings",
    Icon: SettingsIcon
  }
];

const ACTIVE_TAB_COLOR = "#1C252E";
const INACTIVE_TAB_COLOR = "#9DB2CE";

export default function TabLayout() {
  const { session, isLoading: isAuthLoading } = useSupabaseAuth();
  const isSignedIn = !!session;
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // "Does this user have a wallet?" is answered by GET /api/turnkey/wallet,
  // never by anything stored on the phone.
  const {
    status: walletStatus,
    isLoading: isCheckingWallet,
    error: walletError
  } = useTurnkeyWallet(isSignedIn);

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
      case "settings":
        return <SettingsScreen />;
      case "wallet-settings":
        return <WalletSettingsScreen />;
      default:
        return <HomeScreen />;
    }
  };

  // Single return with all conditional rendering
  return (
    <>
      {!isSignedIn ? (
        isAuthLoading ? null : (
          <Redirect href='/sign-in' />
        )
      ) : isCheckingWallet ? (
        // @ts-ignore
        <YStack
          flex={1}
          backgroundColor='$background'
          paddingHorizontal='$5'
          paddingTop='$6'
          paddingBottom='$4'
          space='$6'
        >
          <YStack width='100%' space='$3'>
            <SkeletonBox width='60%' height={28} />
            <SkeletonBox width='80%' height={20} />
          </YStack>

          <YStack width='100%' space='$3'>
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBox key={index} width='100%' height={56} radius={18} />
            ))}
          </YStack>
        </YStack>
      ) : walletStatus === "none" ? (
        <Redirect href='/create-wallet' />
      ) : walletError && walletStatus === "unknown" ? (
        // The request failed (network, 5xx, expired session). Never treat this
        // as "no wallet" — that would route a real user to wallet creation.
        // @ts-ignore
        <YStack
          flex={1}
          backgroundColor='$background'
          padding='$5'
          justifyContent='center'
          alignItems='center'
          space='$3'
        >
          <Text fontSize='$5' fontWeight='600' textAlign='center'>
            Couldn’t reach Normal
          </Text>
          <Text fontSize='$3' color='$gray11' textAlign='center'>
            {walletError.message}
          </Text>
        </YStack>
      ) : (
        // @ts-ignore
        <View flex={1} backgroundColor='$background'>
          <YStack flex={1}>
            <SafeAreaView style={{ flex: 1, paddingBottom: 0 }}>
              <YStack flex={1} paddingBottom={20 + insets.bottom}>
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
                  const color = isActive
                    ? ACTIVE_TAB_COLOR
                    : INACTIVE_TAB_COLOR;

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

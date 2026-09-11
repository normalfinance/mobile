// Five tabs (D12): Home · Savings · Swap · Activity · Settings. Web has no
// bottom navigation; this is the mobile-native equivalent of its top nav +
// drawer. Screens are rendered by key so the tab bar stays custom-styled.

import { Redirect, usePathname, useRouter } from "expo-router";
import React from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, XStack, YStack } from "tamagui";
import {
  ArrowLeftRight,
  Clock,
  House,
  PiggyBank,
  Settings,
  type LucideIcon
} from "lucide-react-native";

import { Skeleton, UiText } from "@/components/home/primitives";
import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { useColors } from "@/lib/theme/appearance";
import { space } from "@/lib/theme/tokens";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

import ActivityScreen from "./activity";
import HomeScreen from "./index";
import SavingsScreen from "./savings";
import SettingsScreen from "./settings";
import SwapScreen from "./swap";

type TabKey = "home" | "savings" | "swap" | "activity" | "settings";

const tabRoutes: Record<
  TabKey,
  `/(${"tabs"})${"" | "/savings" | "/swap" | "/activity" | "/settings"}`
> = {
  home: "/(tabs)",
  savings: "/(tabs)/savings",
  swap: "/(tabs)/swap",
  activity: "/(tabs)/activity",
  settings: "/(tabs)/settings"
};

const TAB_ITEMS: { key: TabKey; label: string; Icon: LucideIcon }[] = [
  { key: "home", label: "Home", Icon: House },
  { key: "savings", label: "Savings", Icon: PiggyBank },
  { key: "swap", label: "Swap", Icon: ArrowLeftRight },
  { key: "activity", label: "Activity", Icon: Clock },
  { key: "settings", label: "Settings", Icon: Settings }
];

export default function TabLayout() {
  const c = useColors();
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
    const segment = pathname.split("/").filter(Boolean)[0];
    return segment && segment in tabRoutes ? (segment as TabKey) : "home";
  }, [pathname]);

  const handleTabChange = (value: TabKey) => {
    if (value !== activeTab) router.push(tabRoutes[value]);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "savings":
        return <SavingsScreen />;
      case "swap":
        return <SwapScreen />;
      case "activity":
        return <ActivityScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <HomeScreen />;
    }
  };

  if (!isSignedIn) {
    return isAuthLoading ? null : <Redirect href='/sign-in' />;
  }

  if (isCheckingWallet) {
    return (
      <YStack
        flex={1}
        backgroundColor={c.surface}
        paddingHorizontal={space.gutter}
        paddingTop={64}
        gap={space.section}
      >
        <Skeleton width='60%' height={28} />
        <Skeleton width='100%' height={180} />
        <Skeleton width='100%' height={56} />
        <Skeleton width='100%' height={56} />
      </YStack>
    );
  }

  if (walletStatus === "none") {
    return <Redirect href='/create-wallet' />;
  }

  if (walletError && walletStatus === "unknown") {
    // The request failed (network, 5xx, expired session). Never treat this
    // as "no wallet" — that would route a real user to wallet creation.
    return (
      <YStack
        flex={1}
        backgroundColor={c.surface}
        padding={space.gutter}
        justifyContent='center'
        alignItems='center'
        gap={8}
      >
        <UiText fontSize={16} fontWeight='500' textAlign='center'>
          Couldn’t reach Normal
        </UiText>
        <UiText fontSize={14} color={c.muted} textAlign='center'>
          {walletError.message}
        </UiText>
      </YStack>
    );
  }

  const barHeight = 56 + insets.bottom;

  return (
    <YStack flex={1} backgroundColor={c.surface}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <YStack flex={1} paddingBottom={barHeight}>
          {renderTabContent()}
        </YStack>
      </SafeAreaView>

      <XStack
        position='absolute'
        bottom={0}
        left={0}
        right={0}
        height={barHeight}
        paddingBottom={insets.bottom}
        backgroundColor={c.surface}
        borderTopWidth={1}
        borderTopColor={c.border}
      >
        {TAB_ITEMS.map(({ key, label, Icon }) => {
          const isActive = activeTab === key;
          const color = isActive ? c.ink : c.muted;
          return (
            <YStack
              key={key}
              flex={1}
              onPress={() => handleTabChange(key)}
              alignItems='center'
              justifyContent='center'
              gap={4}
              paddingTop={8}
              pressStyle={{ opacity: 0.7 }}
              accessibilityRole='tab'
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={label}
            >
              <Icon size={22} color={color} strokeWidth={isActive ? 2 : 1.8} />
              <Text
                fontFamily='$body'
                fontSize={11}
                fontWeight={isActive ? "600" : "500"}
                color={color}
              >
                {label}
              </Text>
            </YStack>
          );
        })}
      </XStack>
    </YStack>
  );
}

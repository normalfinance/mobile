import React from "react";
import { useRouter } from "expo-router";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ChevronRight,
  Globe,
  Lock,
  Wallet,
  Bell,
  Smile,
  CircleDollarSign
} from "lucide-react-native";
import { Text, View, XStack, YStack } from "tamagui";

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

type SettingsItem = {
  key:
    | "language"
    | "currency"
    | "reset"
    | "notifications"
    | "faceId"
    | "wallet";
  label: string;
  Icon: IconComponent;
  disabled: boolean;
};

const ACCOUNT_ITEMS: SettingsItem[] = [
  { key: "language", label: "Language", Icon: Globe, disabled: true },
  {
    key: "currency",
    label: "Currency",
    Icon: CircleDollarSign,
    disabled: true
  },
  { key: "reset", label: "Reset Password", Icon: Lock, disabled: true },
  {
    key: "notifications",
    label: "Notification Settings",
    Icon: Bell,
    disabled: true
  },
  { key: "faceId", label: "Face ID", Icon: Smile, disabled: true },
  { key: "wallet", label: "Wallet Settings", Icon: Wallet, disabled: false }
];

function SettingsRow({
  item,
  onPress
}: {
  item: SettingsItem;
  onPress: (item: SettingsItem) => void;
}) {
  const { Icon } = item;

  return (
    <Pressable onPress={() => onPress(item)} disabled={item.disabled}>
      <View style={{ opacity: item.disabled ? 0.4 : 1 }}>
        <XStack
          alignItems='center'
          justifyContent='space-between'
          paddingVertical='$3'
          paddingHorizontal='$4'
          backgroundColor='#FFFFFF'
        >
          <XStack alignItems='center' space='$3'>
            <View padding='$2' borderRadius={8} backgroundColor='transparent'>
              <Icon size={16} color='#1B1D28' />
            </View>
            <Text fontSize='$3' fontWeight='500' color='#1C252E'>
              {item.label}
            </Text>
          </XStack>
          <ChevronRight size={20} color='#9AA5B5' />
        </XStack>
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleItemPress = (item: SettingsItem) => {
    if (item.disabled) return;

    if (item.key === "wallet") {
      router.push("/(tabs)/wallet-settings");
    }
  };

  return (
    <YStack flex={1} backgroundColor='#F4F7FB' paddingTop={12}>
      <YStack paddingHorizontal='$4' space='$5'>
        <XStack alignItems='center' justifyContent='space-between'>
          <Text fontSize='$6' fontWeight='600' color='#1B1D28'>
            Settings
          </Text>
          <View width={24} />
        </XStack>

        <YStack space='$3'>
          <Text fontSize='$3' color='#6B7280'>
            Account
          </Text>
          <View
            backgroundColor='#FFFFFF'
            borderRadius={12}
            borderWidth={1}
            borderColor='#E2E8F0'
            overflow='hidden'
          >
            {ACCOUNT_ITEMS.map((item, index) => (
              <React.Fragment key={item.key}>
                <SettingsRow item={item} onPress={handleItemPress} />
                {index < ACCOUNT_ITEMS.length - 1 ? (
                  <View height={1} backgroundColor='#EEF2F7' marginLeft={64} />
                ) : null}
              </React.Fragment>
            ))}
          </View>
        </YStack>
      </YStack>
    </YStack>
  );
}

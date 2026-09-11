// Settings — account, appearance (light / dark / system), about, sign out.

import React from "react";
import { Alert, ScrollView } from "react-native";
import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import { XStack, YStack } from "tamagui";
import { Check, Copy, LogOut, Mail, Moon, Smartphone, Sun, Wallet } from "lucide-react-native";

import {
  Card,
  Divider,
  ListRow,
  Mono,
  Screen,
  ScreenTitle,
  SecondaryButton,
  UiText
} from "@/components/home/primitives";
import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { supabase } from "@/lib/supabase";
import { useAppearance, useColors, type AppearanceMode } from "@/lib/theme/appearance";
import { space } from "@/lib/theme/tokens";
import { shortenAddress } from "@/lib/utils/number-format.utils";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

const APPEARANCE: { key: AppearanceMode; label: string; Icon: typeof Sun }[] = [
  { key: "light", label: "Light", Icon: Sun },
  { key: "dark", label: "Dark", Icon: Moon },
  { key: "system", label: "System", Icon: Smartphone }
];

export default function SettingsScreen() {
  const c = useColors();
  const { mode, setMode } = useAppearance();
  const { user } = useSupabaseAuth();
  const { stellarAddress } = useTurnkeyWallet();
  const [copied, setCopied] = React.useState(false);

  const copyAddress = async () => {
    if (!stellarAddress) return;
    await Clipboard.setStringAsync(stellarAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const signOut = () => {
    Alert.alert("Sign out", "You can sign back in with the same email any time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) Alert.alert("Sign out failed", error.message);
        }
      }
    ]);
  };

  const version = Constants.expoConfig?.version ?? "—";

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 96 }}>
        <YStack paddingHorizontal={space.gutter} paddingTop={8} gap={space.section}>
          <ScreenTitle title='Settings' />

          <YStack gap={10}>
            <UiText fontSize={13} color={c.muted}>
              Account
            </UiText>
            <Card>
              <ListRow
                icon={<Mail size={16} color={c.ink} strokeWidth={1.8} />}
                label='Email'
                sub={user?.email ?? "—"}
              />
              <Divider />
              <ListRow
                icon={<Wallet size={16} color={c.ink} strokeWidth={1.8} />}
                label='Stellar address'
                sub={stellarAddress ? undefined : "No Stellar address yet"}
                right={
                  stellarAddress ? (
                    <XStack alignItems='center' gap={8}>
                      <Mono fontSize={12} color={c.muted}>
                        {shortenAddress(stellarAddress, 6, 6)}
                      </Mono>
                      {copied ? (
                        <Check size={16} color={c.positive} strokeWidth={2} />
                      ) : (
                        <Copy size={16} color={c.muted} strokeWidth={2} />
                      )}
                    </XStack>
                  ) : undefined
                }
                onPress={stellarAddress ? copyAddress : undefined}
              />
            </Card>
          </YStack>

          <YStack gap={10}>
            <UiText fontSize={13} color={c.muted}>
              Appearance
            </UiText>
            <Card>
              {APPEARANCE.map(({ key, label, Icon }, i) => (
                <React.Fragment key={key}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    icon={<Icon size={16} color={c.ink} strokeWidth={1.8} />}
                    label={label}
                    right={mode === key ? <Check size={18} color={c.ink} strokeWidth={2} /> : undefined}
                    onPress={() => setMode(key)}
                  />
                </React.Fragment>
              ))}
            </Card>
          </YStack>

          <YStack gap={10}>
            <UiText fontSize={13} color={c.muted}>
              About
            </UiText>
            <Card>
              <ListRow label='Version' right={<Mono fontSize={12} color={c.muted}>{version}</Mono>} />
              <Divider />
              <ListRow label='Network' right={<Mono fontSize={12} color={c.muted}>Stellar mainnet</Mono>} />
            </Card>
          </YStack>

          <SecondaryButton
            label='Sign out'
            onPress={signOut}
            icon={<LogOut size={16} color={c.ink} strokeWidth={1.8} />}
          />
        </YStack>
      </ScrollView>
    </Screen>
  );
}

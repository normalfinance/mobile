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
import { CHAIN_META, useTurnkeyWallet, type WalletChain } from "@/hooks/use-turnkey-wallet";
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
  const { addresses } = useTurnkeyWallet();
  const [copiedChain, setCopiedChain] = React.useState<WalletChain | null>(null);

  const copyAddress = async (chain: WalletChain, address: string) => {
    await Clipboard.setStringAsync(address);
    setCopiedChain(chain);
    setTimeout(() => setCopiedChain((cur) => (cur === chain ? null : cur)), 2000);
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
            </Card>
          </YStack>

          {/* One row per chain the wallet has an address for (lazy creation: a
              chain appears here the first time it is used). Tap to copy. */}
          <YStack gap={10}>
            <UiText fontSize={13} color={c.muted}>
              Wallet addresses
            </UiText>
            <Card>
              {addresses.length === 0 ? (
                <ListRow
                  icon={<Wallet size={16} color={c.ink} strokeWidth={1.8} />}
                  label='No addresses yet'
                  sub='Addresses are created the first time you use an asset.'
                />
              ) : (
                addresses.map(({ chain, address }, i) => (
                  <React.Fragment key={chain}>
                    {i > 0 ? <Divider /> : null}
                    <ListRow
                      icon={
                        <YStack
                          width={10}
                          height={10}
                          borderRadius={5}
                          backgroundColor={CHAIN_META[chain].color}
                        />
                      }
                      label={CHAIN_META[chain].name}
                      sub={CHAIN_META[chain].assets}
                      right={
                        <XStack alignItems='center' gap={8}>
                          <Mono fontSize={12} color={c.muted}>
                            {shortenAddress(address, 6, 6)}
                          </Mono>
                          {copiedChain === chain ? (
                            <Check size={16} color={c.positive} strokeWidth={2} />
                          ) : (
                            <Copy size={16} color={c.muted} strokeWidth={2} />
                          )}
                        </XStack>
                      }
                      onPress={() => void copyAddress(chain, address)}
                    />
                  </React.Fragment>
                ))
              )}
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

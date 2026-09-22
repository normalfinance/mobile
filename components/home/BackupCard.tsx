// Home card while the wallet's recovery phrase has never been confirmed as
// written down (lib/turnkey/provision.ts marks). Web forces this in a gate;
// mobile offers it here and in Settings until the box is ticked.

import React from "react";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { XStack, YStack } from "tamagui";
import { KeyRound } from "lucide-react-native";

import { Card, IconBox, PillButton, UiText } from "@/components/home/primitives";
import { useColors } from "@/lib/theme/appearance";
import { space } from "@/lib/theme/tokens";
import { onBackupStateChange, walletNeedsBackup } from "@/lib/turnkey/provision";

export const useWalletNeedsBackup = (subOrgId: string | undefined): boolean => {
  const isFocused = useIsFocused();
  const [needs, setNeeds] = React.useState(false);
  React.useEffect(() => {
    if (!subOrgId) {
      setNeeds(false);
      return;
    }
    let live = true;
    const read = () => void walletNeedsBackup(subOrgId).then((v) => live && setNeeds(v));
    read();
    const off = onBackupStateChange(read);
    return () => {
      live = false;
      off();
    };
  }, [subOrgId, isFocused]);
  return needs;
};

export const BackupCard = ({ subOrgId }: { subOrgId: string }) => {
  const c = useColors();
  const router = useRouter();
  const needs = useWalletNeedsBackup(subOrgId);
  if (!needs) return null;
  return (
    <Card padding={space.rowX}>
      <XStack alignItems='center' gap={space.rowGap}>
        <IconBox size={36}><KeyRound size={18} color={c.ink} strokeWidth={1.8} /></IconBox>
        <YStack flex={1} gap={2}>
          <UiText fontSize={14} fontWeight='500'>Back up your wallet</UiText>
          <UiText fontSize={12} color={c.muted} lineHeight={17}>Write down your 12-word recovery phrase — it restores every address in this wallet.</UiText>
        </YStack>
        <PillButton label='Back up' onPress={() => router.push("/backup")} />
      </XStack>
    </Card>
  );
};

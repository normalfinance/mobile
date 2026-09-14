// Shown on Home until this phone has proven it can sign for the wallet.
// Tries a passkey signature first (synced iCloud/Google passkeys just work —
// one Face ID, no email); only a phone with no passkey goes to enrolment.

import React from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { XStack, YStack } from "tamagui";
import { Fingerprint } from "lucide-react-native";

import { useColors } from "@/lib/theme/appearance";
import { space } from "@/lib/theme/tokens";
import { describeTurnkeyError } from "@/lib/turnkey/client";
import { ensureDeviceReady } from "@/lib/turnkey/device-check";
import { Card, IconBox, PillButton, PrimaryButton, UiText } from "./primitives";

export const DeviceSetupCard = ({
  subOrgId,
  stellarAddress
}: {
  subOrgId: string;
  stellarAddress: string;
}) => {
  const c = useColors();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);

  if (hidden) return null;

  const verify = async () => {
    setBusy(true);
    try {
      const { outcome, error } = await ensureDeviceReady(subOrgId, stellarAddress, false);
      if (outcome === "ready") return; // the flag flips; Home stops rendering the card
      if (outcome === "needs-setup") {
        router.push("/setup-device");
        return;
      }
      if (outcome === "failed") Alert.alert("Couldn’t verify this phone", describeTurnkeyError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding={space.cardInner} gap={12}>
      <XStack alignItems='flex-start' gap={12}>
        <IconBox size={36}>
          <Fingerprint size={18} color={c.ink} strokeWidth={1.8} />
        </IconBox>
        <YStack flex={1} gap={3}>
          <UiText fontSize={15} fontWeight='600'>
            Set up this phone
          </UiText>
          <UiText fontSize={13} color={c.muted} lineHeight={18}>
            One Face ID check lets this phone send, save and swap. Takes about a minute.
          </UiText>
        </YStack>
      </XStack>
      <XStack gap={8}>
        <YStack flex={1}>
          <PrimaryButton label='Verify with Face ID' onPress={verify} loading={busy} />
        </YStack>
        <PillButton label='Not now' onPress={() => setHidden(true)} />
      </XStack>
    </Card>
  );
};

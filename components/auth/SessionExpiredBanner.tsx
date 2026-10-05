// Web authed-fetch.ts: when a 401 survives one refresh, show a banner with a
// Sign in button — never throw, never redirect on our own. lib/api.ts emits
// the event (debounced 5 s); this listens app-wide.

import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { XStack, YStack } from "tamagui";
import { X } from "lucide-react-native";

import { IconButton, PillButton, UiText } from "@/components/home/primitives";
import { onSessionExpired } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/lib/theme/appearance";
import { radius, space } from "@/lib/theme/tokens";

export function SessionExpiredBanner() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => onSessionExpired(() => setVisible(true)), []);
  if (!visible) return null;

  const signIn = async () => {
    setVisible(false);
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    router.replace("/sign-in");
  };

  return (
    <YStack position='absolute' top={insets.top + 8} left={space.gutter} right={space.gutter} zIndex={1000}>
      <XStack
        alignItems='center'
        gap={10}
        padding={12}
        borderRadius={radius.input}
        backgroundColor={c.chips.amber.bg}
        borderWidth={1}
        borderColor={c.border}
      >
        <UiText fontSize={13} color={c.chips.amber.color} flex={1} lineHeight={18}>
          Your session expired — please sign in again to continue.
        </UiText>
        <PillButton label='Sign in' onPress={() => void signIn()} />
        <IconButton onPress={() => setVisible(false)} label='Dismiss'>
          <X size={16} color={c.muted} strokeWidth={2} />
        </IconButton>
      </XStack>
    </YStack>
  );
}

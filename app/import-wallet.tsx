// Import an existing wallet from its 12- or 24-word recovery phrase (web
// onboarding wizard "Import an existing wallet" → importMnemonicIntoTurnkey).
// Offered only while the account has no wallet: web records a later import
// as a secondary seed the app would not use. The phrase is validated and the
// Stellar address previewed locally before any passkey prompt; it is then
// encrypted on this phone to Turnkey's enclave (lib/turnkey/import.ts).

import React from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Input, XStack, YStack } from "tamagui";
import { ChevronLeft, ClipboardPaste, ShieldCheck } from "lucide-react-native";

import { Card, IconButton, Mono, PillButton, PrimaryButton, Screen, UiText } from "@/components/home/primitives";
import { turnkeyWalletQueryKey, useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { skipOnboarding } from "@/lib/onboarding";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { IMPORT_STAGE_LABEL, importMnemonicIntoTurnkey, isWordlistWord, normalizeMnemonic, stellarAddressFromMnemonic, validateMnemonic, type ImportStage } from "@/lib/turnkey/import";
import { WalletLimitError } from "@/lib/turnkey/provision";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

export default function ImportWalletScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();
  const { wallet, refetch } = useTurnkeyWallet();

  const [phrase, setPhrase] = React.useState("");
  const [stage, setStage] = React.useState<ImportStage | null>(null);
  const [hidden, setHidden] = React.useState(false);

  const normalized = normalizeMnemonic(phrase);
  const words = normalized ? normalized.split(" ") : [];
  const badWord = words.find((w) => !isWordlistWord(w));
  const valid = validateMnemonic(normalized);
  const preview = React.useMemo(() => {
    if (!valid) return null;
    try {
      return stellarAddressFromMnemonic(normalized);
    } catch {
      return null;
    }
  }, [valid, normalized]);
  const hasWallet = !!wallet?.walletId;

  const hint =
    words.length === 0
      ? "Separate the words with spaces. 12 or 24 words."
      : badWord
        ? `“${badWord}” is not a recovery-phrase word — check the spelling.`
        : words.length !== 12 && words.length !== 24
          ? `${words.length} word${words.length === 1 ? "" : "s"} — a phrase has 12 or 24.`
          : valid
            ? "Looks good."
            : "One or more words are out of order or mistyped — re-read your phrase carefully.";

  const paste = async () => {
    const t = (await Clipboard.getStringAsync()).trim();
    if (t) setPhrase(t);
  };

  const run = async () => {
    if (!user || !valid || hasWallet) return;
    try {
      const { wallet: w, stellarMatch } = await importMnemonicIntoTurnkey({ mnemonic: normalized, user: { id: user.id, email: user.email }, wallet, onStage: setStage });
      queryClient.setQueryData(turnkeyWalletQueryKey(user.id), w);
      await refetch();
      setPhrase("");
      skipOnboarding();
      // Clipboard hygiene: a pasted phrase must not outlive the import.
      void Clipboard.setStringAsync("").catch(() => undefined);
      Alert.alert(
        stellarMatch ? "Wallet imported" : "Imported with a mismatch",
        stellarMatch
          ? `Your wallet is secured by this phone’s passkey from now on.\n\nStellar address\n${w.stellarAddress ?? "—"}`
          : "Turnkey derived a different Stellar address than this phrase — contact support before moving funds.",
        [{ text: "Continue", onPress: () => router.replace("/(tabs)") }]
      );
    } catch (e) {
      if (isUserCancelledError(e)) return;
      if (e instanceof WalletLimitError) Alert.alert("Try again later", e.message);
      else Alert.alert("Couldn’t import the wallet", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setStage(null);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={{ paddingBottom: 48 }}>
          <YStack paddingHorizontal={space.gutter} paddingTop={insets.top + 8} gap={16}>
            <XStack alignItems='center' gap={4} marginLeft={-10}>
              <IconButton onPress={() => router.back()} label='Back'><ChevronLeft size={22} color={c.ink} strokeWidth={2} /></IconButton>
              <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>Import a wallet</UiText>
            </XStack>

            {hasWallet ? (
              <Card padding={14} gap={8}>
                <UiText fontSize={14} fontWeight='600'>This account already has a wallet</UiText>
                <UiText fontSize={13} color={c.muted} lineHeight={18}>
                  Importing a second phrase would add a seed the app doesn’t use. To use a different wallet, sign in with the account it belongs to — or send funds to this wallet instead.
                </UiText>
              </Card>
            ) : (
              <>
                <UiText fontSize={13.5} color={c.muted} lineHeight={19}>
                  Bring in a wallet with its 12- or 24-word recovery phrase. The phrase is encrypted on this phone to Turnkey’s secure enclave — Normal never sees it — and your passkey signs from then on.
                </UiText>

                <Card padding={14} gap={10}>
                  <XStack justifyContent='space-between' alignItems='center'>
                    <UiText fontSize={12} color={c.muted}>Recovery phrase</UiText>
                    <XStack gap={6}>
                      <PillButton label={hidden ? "Show" : "Hide"} onPress={() => setHidden((h) => !h)} />
                      <PillButton label='Paste' onPress={() => void paste()} />
                    </XStack>
                  </XStack>
                  <Input
                    value={phrase}
                    onChangeText={setPhrase}
                    multiline
                    numberOfLines={4}
                    secureTextEntry={hidden}
                    autoCapitalize='none'
                    autoCorrect={false}
                    autoComplete='off'
                    textContentType='none'
                    editable={!stage}
                    placeholder='word1 word2 word3 …'
                    minHeight={110}
                    textAlignVertical='top'
                    paddingHorizontal={14}
                    paddingVertical={12}
                    fontFamily='$mono'
                    fontSize={15}
                    lineHeight={24}
                    backgroundColor={c.inputBg}
                    borderWidth={1}
                    borderColor={badWord ? c.failed : c.border}
                    borderRadius={radius.input}
                    color={c.ink}
                    accessibilityLabel='Recovery phrase'
                  />
                  <XStack justifyContent='space-between' alignItems='center' gap={12}>
                    <UiText fontSize={12} color={badWord || (words.length > 0 && !valid && (words.length === 12 || words.length === 24)) ? c.failed : valid ? c.positive : c.muted} flex={1}>{hint}</UiText>
                    <Mono fontSize={12} color={c.muted}>{words.length}/{words.length > 12 ? 24 : 12}</Mono>
                  </XStack>
                  {preview ? (
                    <YStack gap={4} paddingTop={4}>
                      <UiText fontSize={12} color={c.muted}>Stellar address this phrase restores</UiText>
                      <Mono fontSize={12} selectable>{preview}</Mono>
                    </YStack>
                  ) : null}
                  <UiText fontSize={12} color={c.faint} paddingLeft={2}>
                    The pasted phrase is cleared from your clipboard after a successful import.
                  </UiText>
                </Card>

                <Card padding={14} gap={8}>
                  <XStack alignItems='center' gap={8}>
                    <ShieldCheck size={16} color={c.ink} strokeWidth={1.8} />
                    <UiText fontSize={14} fontWeight='600'>What happens next</UiText>
                  </XStack>
                  <UiText fontSize={13} color={c.muted} lineHeight={18}>{wallet ? "Two passkey confirmations: one to start the secure import, one to complete it." : "Three passkey confirmations: create your passkey, start the secure import, complete it."}</UiText>
                  <UiText fontSize={13} color={c.muted} lineHeight={18}>Your Stellar address is set up first; Bitcoin, Ethereum and Solana addresses are added from the same phrase when you first use them.</UiText>
                </Card>

                <PrimaryButton label={stage ? IMPORT_STAGE_LABEL[stage] : "Import with passkey"} onPress={() => void run()} disabled={!valid || !!stage || !user} loading={!!stage} />
                <XStack alignItems='center' justifyContent='center' gap={6}>
                  <ClipboardPaste size={12} color={c.faint} strokeWidth={2} />
                  <UiText fontSize={11} color={c.faint}>Never share your phrase. Normal staff will never ask for it.</UiText>
                </XStack>
              </>
            )}
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

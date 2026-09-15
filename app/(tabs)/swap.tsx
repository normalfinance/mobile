// Swap tab — one shell, two pickers, the engine chosen by the pair (web
// swap-card.tsx + engines/types.ts): XLM ⇄ USDC → Soroswap panel; USDC → BTC/
// ETH/SOL → CCTP outbound panel; the two pairs web routes but mobile hasn't
// built yet (native → USDC, native ⇄ native) show an honest "not yet" card.
// The destination picker is pair-filtered like web; picking a source that
// can't pair with the current destination moves the destination to its
// in-group counterpart.

import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { XStack, YStack } from "tamagui";
import { ChevronDown } from "lucide-react-native";

import { Card, PrimaryButton, Screen, ScreenTitle, UiText } from "@/components/home/primitives";
import { AssetIcon } from "@/components/ui/AssetIcon";
import { AssetPicker } from "@/components/swap/AssetPicker";
import { CctpInboundPanel } from "@/components/swap/CctpInboundPanel";
import { CctpOutboundPanel } from "@/components/swap/CctpOutboundPanel";
import { InFlightTransfers } from "@/components/swap/InFlightTransfers";
import { SoroswapPanel } from "@/components/swap/SoroswapPanel";
import { SWAP_ASSETS, canPair, counterpartOf, routeOf, type CrosschainSymbol, type StellarSymbol, type SwapSymbol } from "@/lib/swap/registry";
import { useColors } from "@/lib/theme/appearance";
import { radius, space } from "@/lib/theme/tokens";

export default function SwapScreen() {
  const c = useColors();
  const [from, setFrom] = React.useState<SwapSymbol>("XLM");
  const [to, setTo] = React.useState<SwapSymbol>("USDC");
  const [amount, setAmount] = React.useState("");
  const [pickerSide, setPickerSide] = React.useState<"from" | "to" | null>(null);

  // web selectFrom / selectTo / handleFlip
  const selectFrom = (sym: SwapSymbol) => {
    if (sym === from) return;
    if (!canPair(sym, to) || sym === to) setTo(sym === to ? from : counterpartOf(sym));
    setFrom(sym);
    setAmount("");
  };
  const selectTo = (sym: SwapSymbol) => {
    if (sym === to) return;
    if (sym === from) setFrom(to);
    setTo(sym);
  };
  const flip = () => {
    if (!canPair(to, from)) return;
    setFrom(to);
    setTo(from);
    setAmount("");
  };

  const pill = (symbol: SwapSymbol, side: "from" | "to") => (
    <XStack
      onPress={() => setPickerSide(side)}
      alignItems='center'
      gap={8}
      paddingVertical={6}
      paddingLeft={6}
      paddingRight={10}
      borderRadius={radius.pill}
      backgroundColor={c.surface}
      borderWidth={1}
      borderColor={c.border}
      pressStyle={{ backgroundColor: c.pressTint }}
      accessibilityRole='button'
      accessibilityLabel={`Choose ${side === "from" ? "asset to pay" : "asset to receive"}`}
    >
      <AssetIcon symbol={symbol} size={24} fontSize='$2' />
      <UiText fontSize={14} fontWeight='600'>{symbol}</UiText>
      <ChevronDown size={16} color={c.muted} strokeWidth={2} />
    </XStack>
  );

  const route = routeOf(from, to);
  const toChoices = SWAP_ASSETS.filter((a) => a.symbol !== from && canPair(from, a.symbol)).map((a) => a.symbol);

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 96 }} keyboardShouldPersistTaps='handled'>
          <YStack paddingHorizontal={space.gutter} paddingTop={8} gap={space.section}>
            <ScreenTitle title='Swap' />

            {route === "soroswap" ? (
              <SoroswapPanel from={from as StellarSymbol} to={to as StellarSymbol} amount={amount} setAmount={setAmount} fromPill={pill(from, "from")} toPill={pill(to, "to")} onFlip={flip} />
            ) : route === "cctp-out" ? (
              <CctpOutboundPanel to={to as CrosschainSymbol} amount={amount} setAmount={setAmount} fromPill={pill(from, "from")} toPill={pill(to, "to")} />
            ) : route === "cctp-in" ? (
              <CctpInboundPanel from={from as CrosschainSymbol} amount={amount} setAmount={setAmount} fromPill={pill(from, "from")} toPill={pill(to, "to")} />
            ) : (
              <Card padding={12} gap={12}>
                <YStack backgroundColor={c.inputBg} borderRadius={radius.input} padding={14} gap={10}>
                  <UiText fontSize={12} color={c.muted}>You pay</UiText>
                  <XStack alignItems='center' justifyContent='flex-end'>{pill(from, "from")}</XStack>
                </YStack>
                <YStack backgroundColor={c.inputBg} borderRadius={radius.input} padding={14} gap={10}>
                  <UiText fontSize={12} color={c.muted}>You receive</UiText>
                  <XStack alignItems='center' justifyContent='flex-end'>{pill(to, "to")}</XStack>
                </YStack>
                <YStack padding={12} borderRadius={radius.input} backgroundColor={c.chips.blue.bg}>
                  <UiText fontSize={13} color={c.ink2} lineHeight={19}>
                    {route === "lifi"
                      ? `${from} → ${to} arrives on mobile soon (LI.FI cross-chain). Available on the web app today.`
                      : "That pair isn’t available. Pick another asset."}
                  </UiText>
                </YStack>
                <PrimaryButton label='Not available yet' disabled />
              </Card>
            )}

            <InFlightTransfers />
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>

      <AssetPicker
        open={pickerSide === "from"}
        title='Pay with'
        symbols={SWAP_ASSETS.map((a) => a.symbol)}
        selected={from}
        onSelect={selectFrom}
        onClose={() => setPickerSide(null)}
      />
      <AssetPicker
        open={pickerSide === "to"}
        title='Receive'
        symbols={toChoices}
        selected={to}
        onSelect={selectTo}
        onClose={() => setPickerSide(null)}
        // Web hides these pairs silently; on a phone the missing rows need a reason.
        footnote={
          from === "XLM"
            ? "XLM can’t go straight to BTC, ETH or SOL — swap XLM → USDC first, then USDC to the coin. It costs the same."
            : from !== "USDC"
              ? `${from} can’t go straight to XLM — cross-chain swaps deliver USDC; swap USDC → XLM afterwards.`
              : undefined
        }
      />
    </Screen>
  );
}

// The amount boxes shared by every swap panel — port of the web swap card's
// input (swap-card.tsx isFiatMode / toggleMode / handleMax). The Swap tab owns
// ONE currency mode for the whole card: in fiat mode "You pay" is typed in USD
// (divided by the live price) and "You receive" leads with USD; the coin
// amounts stay canonical underneath, so quotes never change when you flip.

import React from "react";
import { Input, XStack, YStack } from "tamagui";
import { ArrowDownUp, ArrowUpDown } from "lucide-react-native";

import { IconBox, Mono, PillButton, Skeleton, UiText } from "@/components/home/primitives";

import { useColors } from "@/lib/theme/appearance";
import { radius, tracking } from "@/lib/theme/tokens";
import { fCurrency, fNumber } from "@/lib/utils/number-format.utils";

/** The converted value under an amount — tapping it flips the card between USD and coins. */
const ConvertedLine = ({ text, onPress, muted }: { text: string; onPress?: () => void; muted?: boolean }) => {
  const c = useColors();
  return (
    <XStack
      alignSelf='flex-start'
      alignItems='center'
      gap={5}
      onPress={onPress}
      pressStyle={onPress ? { opacity: 0.5 } : undefined}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel='Switch between US dollars and coins'
      hitSlop={8}
    >
      {onPress ? <ArrowUpDown size={12} color={muted ? c.faint : c.muted} strokeWidth={2.2} /> : null}
      <Mono fontSize={12} color={muted ? c.faint : c.muted}>{text}</Mono>
    </XStack>
  );
};

const floorTo = (v: number, decimals: number): string => {
  const f = 10 ** decimals;
  return (Math.floor(v * f) / f).toFixed(decimals).replace(/\.?0+$/, "") || "0";
};

export function AmountInput({
  amount,
  setAmount,
  symbol,
  price,
  spendable,
  decimals,
  balanceDecimals,
  pill,
  fiat,
  onToggleFiat,
  editable = true,
  insufficient,
  note,
  balanceText
}: {
  /** Token amount (canonical). */
  amount: string;
  setAmount: (v: string) => void;
  symbol: string;
  /** USD per token; 0 = unknown (fiat mode then falls back to coin). */
  price: number;
  /** MAX target, in tokens. */
  spendable: number;
  /** Token input precision. */
  decimals: number;
  balanceDecimals: number;
  pill: React.ReactNode;
  /** The card's currency mode (Swap tab state). */
  fiat: boolean;
  onToggleFiat?: () => void;
  editable?: boolean;
  insufficient?: boolean;
  /** Optional line under the input (e.g. "Keeps 0.003 ETH for fees"). */
  note?: string | null;
  /** Override for the balance text (e.g. "…" while loading). */
  balanceText?: string;
}) {
  const c = useColors();
  const fiatOn = fiat && price > 0;
  const [fiatText, setFiatText] = React.useState("");
  const amountNum = Number(amount.replace(",", ".")) || 0;

  // Entering fiat mode rewrites the typed value from the canonical amount; a
  // reset (amount cleared after a swap) clears the field too.
  React.useEffect(() => {
    if (fiatOn) setFiatText(amountNum > 0 ? (amountNum * price).toFixed(2) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiatOn]);
  React.useEffect(() => {
    if (!amount) setFiatText("");
  }, [amount]);

  const onFiatChange = (v: string) => {
    setFiatText(v);
    const usd = Number(v.replace(",", "."));
    setAmount(Number.isFinite(usd) && usd > 0 ? floorTo(usd / price, Math.min(decimals, 8)) : "");
  };
  const useMax = () => {
    setAmount(floorTo(spendable, Math.min(decimals, 8)));
    if (fiatOn) setFiatText((spendable * price).toFixed(2));
  };

  // Always shown when a price exists — it is the currency switch, so it must
  // be there before the user has typed anything.
  const secondary = price > 0 ? (fiatOn ? `${fNumber(amountNum, { maximumFractionDigits: Math.min(decimals, 8) })} ${symbol}` : `≈ ${fCurrency(amountNum * price)}`) : null;

  return (
    <YStack backgroundColor={c.inputBg} borderRadius={radius.input} padding={14} gap={8}>
      <XStack justifyContent='space-between' alignItems='center'>
        <UiText fontSize={12} color={c.muted}>You pay</UiText>
        <XStack alignItems='center' gap={8}>
          <Mono fontSize={11} color={insufficient ? c.failed : c.muted}>
            {balanceText ?? (fiatOn ? fCurrency(spendable * price) : `${fNumber(spendable, { maximumFractionDigits: balanceDecimals })} ${symbol}`)}
          </Mono>
          <PillButton label='Max' onPress={useMax} />
        </XStack>
      </XStack>
      <XStack alignItems='center' justifyContent='space-between' gap={10}>
        <XStack flex={1} alignItems='center' gap={2}>
          {fiatOn ? <Mono fontSize={28} letterSpacing={tracking(28)} color={amountNum > 0 ? (insufficient ? c.failed : c.ink) : c.faint}>$</Mono> : null}
          <Input
            flex={1}
            unstyled
            backgroundColor='transparent'
            borderWidth={0}
            color={insufficient ? c.failed : c.ink}
            placeholderTextColor={c.faint}
            fontFamily='$mono'
            fontSize={28}
            letterSpacing={tracking(28)}
            placeholder='0.00'
            keyboardType='decimal-pad'
            value={fiatOn ? fiatText : amount}
            onChangeText={fiatOn ? onFiatChange : setAmount}
            editable={editable}
          />
        </XStack>
        {pill}
      </XStack>
      {secondary ? <ConvertedLine text={secondary} onPress={onToggleFiat} muted={amountNum <= 0} /> : null}
      {note ? <Mono fontSize={11} color={c.faint}>{note}</Mono> : null}
    </YStack>
  );
}

/** "You receive": leads with USD in fiat mode, coin otherwise; the other underneath. */
export function ReceiveBox({
  amount,
  symbol,
  price,
  decimals,
  pill,
  fiat,
  onToggleFiat,
  loading,
  qualifier
}: {
  /** Quoted amount in tokens; null = no quote yet. */
  amount: number | null;
  symbol: string;
  price: number;
  decimals: number;
  pill: React.ReactNode;
  fiat: boolean;
  onToggleFiat?: () => void;
  loading?: boolean;
  /** "minimum" | "estimated" — shown after the label. */
  qualifier?: string;
}) {
  const c = useColors();
  const fiatOn = fiat && price > 0;
  const has = amount !== null && amount > 0;
  const coin = has ? `${fNumber(amount!, { maximumFractionDigits: decimals })} ${symbol}` : null;
  const usd = has && price > 0 ? fCurrency(amount! * price) : null;
  const big = fiatOn ? usd : has ? fNumber(amount!, { maximumFractionDigits: decimals }) : null;
  const small = price > 0 ? (fiatOn ? (coin ?? `0 ${symbol}`) : `≈ ${usd ?? fCurrency(0)}`) : null;
  return (
    <YStack backgroundColor={c.inputBg} borderRadius={radius.input} padding={14} gap={8}>
      <UiText fontSize={12} color={c.muted}>You receive{qualifier ? ` (${qualifier})` : ""}</UiText>
      <XStack alignItems='center' justifyContent='space-between' gap={10}>
        {loading && !has ? (
          <Skeleton width={120} height={30} />
        ) : (
          <Mono fontSize={28} letterSpacing={tracking(28)} color={big ? c.ink : c.faint} flex={1} numberOfLines={1}>
            {big ?? "0.00"}
          </Mono>
        )}
        {pill}
      </XStack>
      {small ? <ConvertedLine text={small} onPress={onToggleFiat} muted={!has} /> : null}
    </YStack>
  );
}

/** The 4px seam between the boxes, with the flip button floating on it (adds no height of its own). */
export function SwapMiddle({ onFlip }: { onFlip?: () => void }) {
  const c = useColors();
  return (
    <YStack height={4} alignItems='center' zIndex={1}>
      {onFlip ? (
        <IconBox
          size={32}
          position='absolute'
          top={-14}
          borderWidth={1}
          borderColor={c.border}
          backgroundColor={c.surface}
          onPress={onFlip}
          pressStyle={{ backgroundColor: c.pressTint }}
          accessibilityRole='button'
          accessibilityLabel='Flip assets'
        >
          <ArrowDownUp size={16} color={c.ink} strokeWidth={2} />
        </IconBox>
      ) : null}
    </YStack>
  );
}

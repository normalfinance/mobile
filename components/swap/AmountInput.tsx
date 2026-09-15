// The amount boxes shared by every swap panel — port of the web swap card's
// input (swap-card.tsx isFiatMode / toggleMode / handleMax). The Swap tab owns
// ONE currency mode for the whole card: in fiat mode "You pay" is typed in USD
// (divided by the live price) and "You receive" leads with USD; the coin
// amounts stay canonical underneath, so quotes never change when you flip.

import React from "react";
import { Input, XStack, YStack } from "tamagui";
import { ArrowDownUp, DollarSign } from "lucide-react-native";

import { IconBox, Mono, PillButton, Skeleton, UiText } from "@/components/home/primitives";
import { useColors } from "@/lib/theme/appearance";
import { radius, tracking } from "@/lib/theme/tokens";
import { fCurrency, fNumber } from "@/lib/utils/number-format.utils";

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

  const secondary = amountNum > 0 && price > 0 ? (fiatOn ? `${fNumber(amountNum, { maximumFractionDigits: Math.min(decimals, 8) })} ${symbol}` : `≈ ${fCurrency(amountNum * price)}`) : null;

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
      {secondary || note ? (
        <XStack justifyContent='space-between' alignItems='center' gap={8}>
          <Mono fontSize={12} color={c.muted}>{secondary ?? ""}</Mono>
          {note ? <Mono fontSize={11} color={c.faint} textAlign='right' flexShrink={1}>{note}</Mono> : null}
        </XStack>
      ) : null}
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
  const small = fiatOn ? coin : usd ? `≈ ${usd}` : null;
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
      {small ? <Mono fontSize={12} color={c.muted}>{small}</Mono> : null}
    </YStack>
  );
}

/** The row between the boxes: flip arrow centred, the USD / coin toggle at the right. */
export function SwapMiddle({ onFlip, fiat, onToggleFiat, canFiat = true }: { onFlip?: () => void; fiat: boolean; onToggleFiat: () => void; canFiat?: boolean }) {
  const c = useColors();
  return (
    <XStack alignItems='center' justifyContent='center' marginVertical={-12} zIndex={1} height={32}>
      {onFlip ? (
        <IconBox size={32} borderWidth={1} borderColor={c.border} backgroundColor={c.surface} onPress={onFlip} pressStyle={{ backgroundColor: c.pressTint }} accessibilityRole='button' accessibilityLabel='Flip assets'>
          <ArrowDownUp size={16} color={c.ink} strokeWidth={2} />
        </IconBox>
      ) : null}
      {canFiat ? (
        <XStack position='absolute' right={10} alignItems='center'>
          <XStack
            onPress={onToggleFiat}
            height={28}
            paddingLeft={6}
            paddingRight={9}
            gap={4}
            alignItems='center'
            borderRadius={999}
            borderWidth={1}
            borderColor={fiat ? c.cta : c.border}
            backgroundColor={fiat ? c.cta : c.surface}
            pressStyle={{ backgroundColor: fiat ? c.ctaPressed : c.pressTint }}
            accessibilityRole='button'
            accessibilityLabel={fiat ? "Show amounts in coins" : "Show amounts in US dollars"}
          >
            <DollarSign size={13} color={fiat ? c.ctaText : c.ink} strokeWidth={2.2} />
            <UiText fontSize={11} fontWeight='600' color={fiat ? c.ctaText : c.ink}>USD</UiText>
          </XStack>
        </XStack>
      ) : null}
    </XStack>
  );
}

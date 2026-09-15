// The "You pay" box shared by every swap panel — port of the web swap card's
// input (swap-card.tsx isFiatMode / toggleMode / handleMax): the amount the
// panel holds is ALWAYS the token amount; in fiat mode the typed value is USD
// divided by the live price. Flipping rewrites the typed value so the
// underlying token amount (and any in-flight quote) stays the same.

import React from "react";
import { Input, XStack, YStack } from "tamagui";
import { ArrowUpDown } from "lucide-react-native";

import { IconBox, Mono, PillButton, UiText } from "@/components/home/primitives";
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
  editable = true,
  insufficient,
  note,
  balanceText
}: {
  /** Token amount (canonical). */
  amount: string;
  setAmount: (v: string) => void;
  symbol: string;
  /** USD per token; 0 = unknown (the toggle is then hidden). */
  price: number;
  /** MAX target, in tokens. */
  spendable: number;
  /** Token input precision. */
  decimals: number;
  balanceDecimals: number;
  pill: React.ReactNode;
  editable?: boolean;
  insufficient?: boolean;
  /** Optional line under the input (e.g. "Keeps 0.003 ETH for network fees"). */
  note?: string | null;
  /** Override for the balance text (e.g. "…" while loading). */
  balanceText?: string;
}) {
  const c = useColors();
  const [fiat, setFiat] = React.useState(false);
  const [fiatText, setFiatText] = React.useState("");
  const amountNum = Number(amount.replace(",", ".")) || 0;
  const canFiat = price > 0;

  // The panel resets `amount` after a swap — keep the fiat field in step.
  React.useEffect(() => {
    if (!amount) setFiatText("");
  }, [amount]);

  const toggle = () => {
    if (!canFiat) return;
    if (fiat) {
      // USD → token: the token amount is already canonical; nothing to rewrite.
      setFiat(false);
      return;
    }
    setFiatText(amountNum > 0 ? (amountNum * price).toFixed(2) : "");
    setFiat(true);
  };
  const onFiatChange = (v: string) => {
    setFiatText(v);
    const usd = Number(v.replace(",", "."));
    setAmount(Number.isFinite(usd) && usd > 0 ? floorTo(usd / price, Math.min(decimals, 8)) : "");
  };
  const useMax = () => {
    const token = floorTo(spendable, Math.min(decimals, 8));
    setAmount(token);
    if (fiat) setFiatText((spendable * price).toFixed(2));
  };

  const secondary = amountNum > 0 && canFiat ? (fiat ? `≈ ${fNumber(amountNum, { maximumFractionDigits: Math.min(decimals, 8) })} ${symbol}` : `≈ ${fCurrency(amountNum * price)}`) : null;

  return (
    <YStack backgroundColor={c.inputBg} borderRadius={radius.input} padding={14} gap={10}>
      <XStack justifyContent='space-between' alignItems='center'>
        <UiText fontSize={12} color={c.muted}>You pay</UiText>
        <XStack alignItems='center' gap={8}>
          <Mono fontSize={11} color={insufficient ? c.failed : c.muted}>
            {balanceText ?? (fiat && canFiat ? fCurrency(spendable * price) : `${fNumber(spendable, { maximumFractionDigits: balanceDecimals })} ${symbol}`)}
          </Mono>
          <PillButton label='Max' onPress={useMax} />
        </XStack>
      </XStack>
      <XStack alignItems='center' justifyContent='space-between' gap={10}>
        {fiat ? <Mono fontSize={28} letterSpacing={tracking(28)} color={amountNum > 0 ? c.ink : c.faint}>$</Mono> : null}
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
          value={fiat ? fiatText : amount}
          onChangeText={fiat ? onFiatChange : setAmount}
          editable={editable}
        />
        {canFiat ? (
          <IconBox size={28} onPress={editable ? toggle : undefined} pressStyle={{ backgroundColor: c.pressTint }} accessibilityRole='button' accessibilityLabel='Toggle USD / crypto'>
            <ArrowUpDown size={14} color={c.ink} strokeWidth={2} />
          </IconBox>
        ) : null}
        {pill}
      </XStack>
      {secondary || note ? (
        <XStack justifyContent='space-between' gap={8}>
          <Mono fontSize={11} color={c.faint}>{secondary ?? ""}</Mono>
          {note ? <UiText fontSize={11} color={c.faint} fontFamily='$mono' textAlign='right' flexShrink={1}>{note}</UiText> : null}
        </XStack>
      ) : null}
    </YStack>
  );
}

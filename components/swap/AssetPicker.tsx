// Asset picker sheet for the Swap tab (web: one picker over all five assets;
// the destination list is pair-filtered). Deliberately calm (D12): one row per
// asset — icon, symbol, name, held balance + USD — and a "Set up" chip when the
// wallet has no address on that chain yet.

import React from "react";
import { Modal } from "react-native";
import { XStack, YStack } from "tamagui";
import { X } from "lucide-react-native";

import { Chip, IconButton, Mono, Pressable, UiText } from "@/components/home/primitives";
import { AssetIcon } from "@/components/ui/AssetIcon";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { SWAP_ASSETS, type SwapSymbol } from "@/lib/swap/registry";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking, typeScale as t } from "@/lib/theme/tokens";
import { fAssetQuantity, fCurrency } from "@/lib/utils/number-format.utils";

export const AssetPicker = ({
  open,
  title,
  symbols,
  selected,
  onSelect,
  onClose,
  footnote
}: {
  open: boolean;
  title: string;
  symbols: SwapSymbol[];
  selected: SwapSymbol;
  onSelect: (s: SwapSymbol) => void;
  onClose: () => void;
  /** One line under the list explaining what's missing and why. */
  footnote?: string;
}) => {
  const c = useColors();
  const { portfolioData } = useBackendPortfolio();
  // Niko 2026-08-21: pickers sort by USD value, highest first, "same in all
  // asset pickers"; unheld assets follow in declaration order.
  const rows = SWAP_ASSETS.filter((a) => symbols.includes(a.symbol)).map((a) => ({
    a,
    asset: portfolioData.assets.find((p) => p.asset_code === a.symbol)
  }));
  const held = rows.filter((r) => Number(r.asset?.balance ?? 0) > 0).sort((x, y) => (y.asset?.usdValue ?? 0) - (x.asset?.usdValue ?? 0));
  const unheld = rows.filter((r) => !(Number(r.asset?.balance ?? 0) > 0));
  return (
    <Modal visible={open} transparent animationType='slide' onRequestClose={onClose}>
      <YStack flex={1} justifyContent='flex-end' backgroundColor='rgba(10,10,15,0.45)'>
        <YStack backgroundColor={c.surface} borderTopLeftRadius={radius.dialog} borderTopRightRadius={radius.dialog} padding={space.gutter} paddingBottom={32} gap={8}>
          <XStack justifyContent='space-between' alignItems='center'>
            <UiText fontSize={16} fontWeight='600'>{title}</UiText>
            <IconButton onPress={onClose} label='Close'><X size={20} color={c.muted} strokeWidth={2} /></IconButton>
          </XStack>
          {[...held, ...unheld].map(({ a, asset }) => {
            const hasAddress = !!asset?.address;
            const isSelected = a.symbol === selected;
            return (
              <Pressable
                key={a.symbol}
                onPress={() => {
                  onSelect(a.symbol);
                  onClose();
                }}
                paddingVertical={space.rowY}
                paddingHorizontal={8}
                flexDirection='row'
                alignItems='center'
                justifyContent='space-between'
                minHeight={space.touchTarget}
                backgroundColor={isSelected ? c.pressTint : "transparent"}
              >
                <XStack alignItems='center' gap={space.rowGap}>
                  <AssetIcon symbol={a.symbol} size={36} fontSize='$3' />
                  <YStack>
                    <XStack alignItems='center' gap={6}>
                      <UiText fontSize={t.assetName.size} fontWeight='600' letterSpacing={tracking(t.assetName.size)}>{a.symbol}</UiText>
                      {!hasAddress ? <Chip tone='neutral' label='Set up' /> : null}
                    </XStack>
                    <UiText fontSize={t.assetSub.size} color={c.muted} marginTop={2}>{a.name}</UiText>
                  </YStack>
                </XStack>
                <YStack alignItems='flex-end'>
                  <Mono fontSize={t.assetUsd.size}>{fCurrency(asset?.usdValue ?? 0)}</Mono>
                  <Mono fontSize={t.assetQty.size} color={c.muted} marginTop={2}>{fAssetQuantity(Number(asset?.balance ?? 0), a.symbol)} {a.symbol}</Mono>
                </YStack>
              </Pressable>
            );
          })}
          {footnote ? (
            <UiText fontSize={12} color={c.muted} lineHeight={17} paddingTop={6} paddingHorizontal={8}>
              {footnote}
            </UiText>
          ) : null}
        </YStack>
      </YStack>
    </Modal>
  );
};

// Small building blocks that encode the drawer's design contract once, so
// screens never restate hex values. See lib/theme/tokens.ts.

import React from "react";
import { ActivityIndicator } from "react-native";
import { Text, XStack, YStack, type TextProps, type YStackProps } from "tamagui";

import { chips, ink, radius, space, tracking, type ChipTone } from "@/lib/theme/tokens";

/** White card, 1px border, radius 16, no shadow (connected-wallet.tsx:124-130). */
export const Card = ({ children, ...rest }: YStackProps) => (
  <YStack
    backgroundColor={ink.surface}
    borderWidth={1}
    borderColor={ink.border}
    borderRadius={radius.card}
    {...rest}
  >
    {children}
  </YStack>
);

/** 1px inset divider used only inside the balance card. */
export const Divider = () => (
  <YStack height={1} backgroundColor={ink.divider} marginHorizontal={space.rowX} />
);

/** Any tappable row/tile: exactly one press state, the 0.03 ink tint. */
export const Pressable = ({ children, ...rest }: YStackProps) => (
  <YStack
    borderRadius={radius.row}
    pressStyle={{ backgroundColor: ink.pressTint }}
    {...rest}
  >
    {children}
  </YStack>
);

/** Geist Mono, -0.01em, tabular figures — for numbers, amounts, addresses. */
export const Mono = ({ fontSize = 14, ...rest }: TextProps & { fontSize?: number }) => (
  <Text
    fontFamily='$mono'
    fontSize={fontSize}
    letterSpacing={tracking(fontSize)}
    color={ink.ink}
    {...rest}
  />
);

/** Satoshi UI text with the drawer defaults. */
export const UiText = ({ fontSize = 14, ...rest }: TextProps & { fontSize?: number }) => (
  <Text fontFamily='$body' fontSize={fontSize} color={ink.ink} {...rest} />
);

/** 28×28 (or given size) radius-8 box on #F4F4F7 holding a 16–20px glyph. */
export const IconBox = ({
  size = 28,
  children,
  ...rest
}: YStackProps & { size?: number }) => (
  <YStack
    width={size}
    height={size}
    borderRadius={radius.iconBox}
    backgroundColor={ink.iconBg}
    alignItems='center'
    justifyContent='center'
    {...rest}
  >
    {children}
  </YStack>
);

/** Status chip: 11/600, h20, radius 6 (activity-row.tsx:146-161). */
export const Chip = ({ tone, label }: { tone: ChipTone; label: string }) => (
  <XStack
    height={20}
    paddingHorizontal={7}
    borderRadius={radius.chip}
    backgroundColor={chips[tone].bg}
    alignItems='center'
  >
    <UiText fontSize={11} fontWeight='600' color={chips[tone].color}>
      {label}
    </UiText>
  </XStack>
);

/** The product CTA (swap-card.tsx:1222-1241): full width, ink, r12, 15/700. */
export const PrimaryButton = ({
  label,
  onPress,
  disabled,
  loading
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) => {
  const inactive = disabled || loading;
  return (
    <YStack
      onPress={inactive ? undefined : onPress}
      backgroundColor={inactive ? ink.ctaDisabledBg : ink.ink}
      pressStyle={{ backgroundColor: ink.ctaPressed }}
      borderRadius={radius.cta}
      paddingVertical={13}
      alignItems='center'
      justifyContent='center'
      flexDirection='row'
      gap={8}
      minHeight={space.touchTarget}
    >
      {loading ? <ActivityIndicator size='small' color={ink.ctaDisabledText} /> : null}
      <UiText
        fontSize={15}
        fontWeight='700'
        letterSpacing={tracking(15)}
        color={inactive ? ink.ctaDisabledText : "#FFFFFF"}
      >
        {label}
      </UiText>
    </YStack>
  );
};

/** Pill button (account-drawer.tsx:752-765): r999, 13/500, ink on white. */
export const PillButton = ({
  label,
  onPress
}: {
  label: string;
  onPress?: () => void;
}) => (
  <XStack
    onPress={onPress}
    borderRadius={radius.pill}
    borderWidth={1}
    borderColor={ink.border}
    backgroundColor={ink.surface}
    pressStyle={{ backgroundColor: ink.pressTint }}
    paddingHorizontal={14}
    height={36}
    alignItems='center'
    justifyContent='center'
  >
    <UiText fontSize={13} fontWeight='500'>
      {label}
    </UiText>
  </XStack>
);

/** Empty state (portfolio/index.tsx:236-300): card p24, icon box, 16/500, 14 @50%. */
export const EmptyState = ({
  icon,
  title,
  body,
  action
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) => (
  <Card padding={24} alignItems='center' gap={12}>
    <IconBox size={44}>{icon}</IconBox>
    <UiText fontSize={16} fontWeight='500' textAlign='center'>
      {title}
    </UiText>
    {body ? (
      <UiText fontSize={14} color={ink.body50} textAlign='center'>
        {body}
      </UiText>
    ) : null}
    {action}
  </Card>
);

/** Explicit-size skeleton, like MUI Skeleton text/circular in the drawer. */
export const Skeleton = ({
  width,
  height = 16,
  circle
}: {
  width: number | `${number}%`;
  height?: number;
  circle?: boolean;
}) => (
  <YStack
    width={width}
    height={height}
    borderRadius={circle ? height / 2 : 6}
    backgroundColor={ink.iconBg}
  />
);

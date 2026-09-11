// Small building blocks that encode the drawer's design contract once, so
// screens never restate hex values. All colours come from useColors(), so the
// same components render the light and dark palettes (lib/theme/tokens.ts).

import React from "react";
import { ActivityIndicator } from "react-native";
import { Text, XStack, YStack, type TextProps, type YStackProps } from "tamagui";

import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking, type ChipTone } from "@/lib/theme/tokens";

/** White card, 1px border, radius 16, no shadow (connected-wallet.tsx:124-130). */
export const Card = ({ children, ...rest }: YStackProps) => {
  const c = useColors();
  return (
    <YStack
      backgroundColor={c.surface}
      borderWidth={1}
      borderColor={c.border}
      borderRadius={radius.card}
      {...rest}
    >
      {children}
    </YStack>
  );
};

/** 1px inset divider used only inside the balance card. */
export const Divider = ({ inset = space.rowX }: { inset?: number }) => {
  const c = useColors();
  return <YStack height={1} backgroundColor={c.divider} marginHorizontal={inset} />;
};

/** Any tappable row/tile: exactly one press state, the 0.03 ink tint. */
export const Pressable = ({ children, ...rest }: YStackProps) => {
  const c = useColors();
  return (
    <YStack
      borderRadius={radius.row}
      pressStyle={{ backgroundColor: c.pressTint }}
      {...rest}
    >
      {children}
    </YStack>
  );
};

/** Geist Mono, -0.01em, tabular figures — for numbers, amounts, addresses. */
export const Mono = ({ fontSize = 14, ...rest }: TextProps & { fontSize?: number }) => {
  const c = useColors();
  return (
    <Text
      fontFamily='$mono'
      fontSize={fontSize}
      letterSpacing={tracking(fontSize)}
      color={c.ink}
      {...rest}
    />
  );
};

/** Satoshi UI text with the drawer defaults. */
export const UiText = ({ fontSize = 14, ...rest }: TextProps & { fontSize?: number }) => {
  const c = useColors();
  return <Text fontFamily='$body' fontSize={fontSize} color={c.ink} {...rest} />;
};

/** Screen title row: 22/600 with an optional right slot. */
export const ScreenTitle = ({
  title,
  right
}: {
  title: string;
  right?: React.ReactNode;
}) => (
  <XStack alignItems='center' justifyContent='space-between' minHeight={44}>
    <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>
      {title}
    </UiText>
    {right}
  </XStack>
);

/** 28×28 (or given size) radius-8 box on the icon background. */
export const IconBox = ({
  size = 28,
  children,
  ...rest
}: YStackProps & { size?: number }) => {
  const c = useColors();
  return (
    <YStack
      width={size}
      height={size}
      borderRadius={radius.iconBox}
      backgroundColor={c.iconBg}
      alignItems='center'
      justifyContent='center'
      {...rest}
    >
      {children}
    </YStack>
  );
};

/** 44×44 tappable icon button, radius 8, press tint. */
export const IconButton = ({
  children,
  onPress,
  label
}: {
  children: React.ReactNode;
  onPress?: () => void;
  label: string;
}) => {
  const c = useColors();
  return (
    <YStack
      onPress={onPress}
      width={space.touchTarget}
      height={space.touchTarget}
      borderRadius={radius.iconBox}
      alignItems='center'
      justifyContent='center'
      pressStyle={{ backgroundColor: c.iconPressTint }}
      accessibilityRole='button'
      accessibilityLabel={label}
    >
      {children}
    </YStack>
  );
};

/** Status chip: 11/600, h20, radius 6 (activity-row.tsx:146-161). */
export const Chip = ({ tone, label }: { tone: ChipTone; label: string }) => {
  const c = useColors();
  return (
    <XStack
      height={20}
      paddingHorizontal={7}
      borderRadius={radius.chip}
      backgroundColor={c.chips[tone].bg}
      alignItems='center'
    >
      <UiText fontSize={11} fontWeight='600' color={c.chips[tone].color}>
        {label}
      </UiText>
    </XStack>
  );
};

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
  const c = useColors();
  const inactive = disabled || loading;
  return (
    <YStack
      onPress={inactive ? undefined : onPress}
      backgroundColor={inactive ? c.ctaDisabledBg : c.cta}
      pressStyle={{ backgroundColor: c.ctaPressed }}
      borderRadius={radius.cta}
      paddingVertical={13}
      alignItems='center'
      justifyContent='center'
      flexDirection='row'
      gap={8}
      minHeight={space.touchTarget}
      accessibilityRole='button'
    >
      {loading ? <ActivityIndicator size='small' color={c.ctaDisabledText} /> : null}
      <UiText
        fontSize={15}
        fontWeight='700'
        letterSpacing={tracking(15)}
        color={inactive ? c.ctaDisabledText : c.ctaText}
      >
        {label}
      </UiText>
    </YStack>
  );
};

/** Secondary button: white, 1px border, r10, 13/500 (receive-modal copy button). */
export const SecondaryButton = ({
  label,
  onPress,
  icon,
  disabled
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}) => {
  const c = useColors();
  return (
    <XStack
      onPress={disabled ? undefined : onPress}
      height={44}
      borderRadius={radius.smallButton}
      borderWidth={1}
      borderColor={c.border}
      backgroundColor={c.surface}
      pressStyle={{ backgroundColor: c.iconBg }}
      alignItems='center'
      justifyContent='center'
      gap={8}
      opacity={disabled ? 0.5 : 1}
      accessibilityRole='button'
    >
      {icon}
      <UiText fontSize={13} fontWeight='500'>
        {label}
      </UiText>
    </XStack>
  );
};

/** Pill button (account-drawer.tsx:752-765): r999, 13/500, ink on white. */
export const PillButton = ({
  label,
  onPress
}: {
  label: string;
  onPress?: () => void;
}) => {
  const c = useColors();
  return (
    <XStack
      onPress={onPress}
      borderRadius={radius.pill}
      borderWidth={1}
      borderColor={c.border}
      backgroundColor={c.surface}
      pressStyle={{ backgroundColor: c.pressTint }}
      paddingHorizontal={14}
      height={36}
      alignItems='center'
      justifyContent='center'
      accessibilityRole='button'
    >
      <UiText fontSize={13} fontWeight='500'>
        {label}
      </UiText>
    </XStack>
  );
};

/** Settings-style row: icon box · label · value/chevron. */
export const ListRow = ({
  icon,
  label,
  sub,
  right,
  onPress
}: {
  icon?: React.ReactNode;
  label: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) => {
  const c = useColors();
  return (
    <XStack
      onPress={onPress}
      paddingHorizontal={space.rowX}
      paddingVertical={space.rowY}
      minHeight={space.touchTarget + 8}
      alignItems='center'
      justifyContent='space-between'
      gap={space.rowGap}
      pressStyle={onPress ? { backgroundColor: c.pressTint } : undefined}
    >
      <XStack alignItems='center' gap={space.rowGap} flexShrink={1}>
        {icon ? <IconBox size={32}>{icon}</IconBox> : null}
        <YStack flexShrink={1}>
          <UiText fontSize={14} fontWeight='500'>
            {label}
          </UiText>
          {sub ? (
            <UiText fontSize={12} color={c.muted} marginTop={2}>
              {sub}
            </UiText>
          ) : null}
        </YStack>
      </XStack>
      {right}
    </XStack>
  );
};

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
}) => {
  const c = useColors();
  return (
    <Card padding={24} alignItems='center' gap={12}>
      <IconBox size={44}>{icon}</IconBox>
      <UiText fontSize={16} fontWeight='500' textAlign='center'>
        {title}
      </UiText>
      {body ? (
        <UiText fontSize={14} color={c.body50} textAlign='center'>
          {body}
        </UiText>
      ) : null}
      {action}
    </Card>
  );
};

/** Explicit-size skeleton, like MUI Skeleton text/circular in the drawer. */
export const Skeleton = ({
  width,
  height = 16,
  circle
}: {
  width: number | `${number}%`;
  height?: number;
  circle?: boolean;
}) => {
  const c = useColors();
  return (
    <YStack
      width={width}
      height={height}
      borderRadius={circle ? height / 2 : 6}
      backgroundColor={c.iconBg}
    />
  );
};

/** Full-screen scaffold: surface background, safe gutters, section gaps. */
export const Screen = ({ children, ...rest }: YStackProps) => {
  const c = useColors();
  return (
    <YStack flex={1} backgroundColor={c.surface} {...rest}>
      {children}
    </YStack>
  );
};

// Scaffold for every auth screen: safe area, an optional back chevron, a
// 26/700 title, a muted subtitle, the form, and a footer pinned under it.
// Keyboard-aware; taps outside inputs dismiss the keyboard.

import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Input, XStack, YStack, type InputProps } from "tamagui";
import { ChevronLeft } from "lucide-react-native";

import { IconButton, Screen, UiText } from "@/components/home/primitives";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";

export const AuthScreen = ({ title, subtitle, back = true, children, footer }: { title: string; subtitle?: string; back?: boolean; children: React.ReactNode; footer?: React.ReactNode }) => {
  const c = useColors();
  const router = useRouter();
  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps='handled' showsVerticalScrollIndicator={false}>
            <YStack flex={1} paddingHorizontal={space.gutter} paddingBottom={24}>
              <XStack height={44} alignItems='center' marginLeft={-10}>
                {back ? (
                  <IconButton onPress={() => (router.canGoBack() ? router.back() : router.replace("/sign-in"))} label='Back'>
                    <ChevronLeft size={22} color={c.ink} strokeWidth={2} />
                  </IconButton>
                ) : null}
              </XStack>
              <YStack gap={6} paddingTop={12} paddingBottom={24}>
                <UiText fontSize={26} fontWeight='700' letterSpacing={tracking(26)} lineHeight={32}>
                  {title}
                </UiText>
                {subtitle ? (
                  <UiText fontSize={15} color={c.muted} lineHeight={21}>
                    {subtitle}
                  </UiText>
                ) : null}
              </YStack>
              <YStack gap={12}>{children}</YStack>
              {footer ? <YStack paddingTop={20}>{footer}</YStack> : null}
            </YStack>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
};

/** A labelled field: 12/500 label above a 52px input. */
export const Field = ({ label, hint, ...input }: InputProps & { label: string; hint?: string }) => {
  const c = useColors();
  return (
    <YStack gap={6}>
      <UiText fontSize={12} fontWeight='500' color={c.muted}>
        {label}
      </UiText>
      <Input
        backgroundColor={c.inputBg}
        borderWidth={1}
        borderColor={c.border}
        borderRadius={radius.input}
        height={52}
        paddingHorizontal={14}
        color={c.ink}
        placeholderTextColor={c.faint}
        focusStyle={{ borderColor: c.borderStrong }}
        fontFamily='$body'
        fontSize={16}
        {...input}
      />
      {hint ? (
        <UiText fontSize={12} color={c.faint}>
          {hint}
        </UiText>
      ) : null}
    </YStack>
  );
};

/** An inline text action ("Forgot password?") — text, not a button. */
export const TextLink = ({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) => {
  const c = useColors();
  return (
    <XStack onPress={disabled ? undefined : onPress} alignSelf='flex-start' paddingVertical={6} pressStyle={{ opacity: 0.5 }} accessibilityRole='button' opacity={disabled ? 0.5 : 1}>
      <UiText fontSize={14} fontWeight='500' color={c.ink}>
        {label}
      </UiText>
    </XStack>
  );
};

/** "Already have an account? Sign in" — muted sentence with an ink action. */
export const SwitchLine = ({ text, action, onPress }: { text: string; action: string; onPress: () => void }) => {
  const c = useColors();
  return (
    <XStack justifyContent='center' alignItems='center' gap={6} flexWrap='wrap'>
      <UiText fontSize={14} color={c.muted}>
        {text}
      </UiText>
      <XStack onPress={onPress} pressStyle={{ opacity: 0.5 }} accessibilityRole='button'>
        <UiText fontSize={14} fontWeight='600' color={c.ink}>
          {action}
        </UiText>
      </XStack>
    </XStack>
  );
};

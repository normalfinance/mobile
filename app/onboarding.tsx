import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";

import { secureStorage } from "@/lib/utils";
import { STORAGE_KEYS } from "@/lib/constants";

type Slide = {
  key: string;
  title: string;
  description: string;
  ctaLabel: string;
  showSkip: boolean;
  image?: number;
  customVisual?: JSX.Element;
};

const normalIconContainer = (
  <YStack
    width={120}
    height={120}
    borderRadius={76}
    borderWidth={4}
    borderColor='rgba(148,163,184,0.18)'
    backgroundColor='#FFFFFF'
    alignItems='center'
    justifyContent='center'
    shadowColor='rgba(15,23,42,0.12)'
    shadowOffset={{ width: 0, height: 18 }}
    shadowOpacity={1}
    shadowRadius={30}
    elevation={14}
  >
    <Image
      source={require("@/assets/icons/normal.png")}
      style={{ width: 96, height: 96 }}
    />
  </YStack>
);

const SLIDES: Slide[] = [
  {
    key: "invest-any-asset",
    title: "Invest In Any Asset",
    description: "All your assets. One clear view.",
    ctaLabel: "Next",
    showSkip: true,
    image: require("@/assets/images/splash-screens/splash1.png")
  },
  {
    key: "swap-send-grow",
    title: "Swap, Send & Grow",
    description: "Trade and move assets instantly.",
    ctaLabel: "Next",
    showSkip: true,
    image: require("@/assets/images/splash-screens/splash2.png")
  },
  {
    key: "diversify-indexes",
    title: "Diversify With Indexes",
    description: "Invest smarter with crypto indexes.",
    ctaLabel: "Next",
    showSkip: true,
    image: require("@/assets/images/splash-screens/splash3.png")
  },
  {
    key: "welcome",
    title: "Welcome to Normalfinance",
    description:
      "Your all-in-one gateway to decentralized investing. Invest smarter. Manage everything in one place.",
    ctaLabel: "Get Started",
    showSkip: false,
    customVisual: normalIconContainer
  }
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const verifyOnboardingState = async () => {
      try {
        const value = await secureStorage.getItem(
          STORAGE_KEYS.ONBOARDING_COMPLETE
        );

        if (value === "true") {
          router.replace("/sign-in");
          return;
        }
      } catch (error) {
        console.error("Failed to read onboarding completion", error);
      } finally {
        setIsReady(true);
      }
    };

    void verifyOnboardingState();
  }, [router]);

  const currentSlide = useMemo(() => SLIDES[currentIndex], [currentIndex]);

  const completeOnboarding = useCallback(async () => {
    try {
      await secureStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, "true");
    } catch (error) {
      console.error("Failed to persist onboarding completion", error);
    } finally {
      router.replace("/sign-in");
    }
  }, [router]);

  const handleNext = useCallback(() => {
    if (currentIndex === SLIDES.length - 1) {
      void completeOnboarding();
      return;
    }

    setCurrentIndex((prev) => Math.min(prev + 1, SLIDES.length - 1));
  }, [completeOnboarding, currentIndex]);

  const handleSkip = useCallback(() => {
    if (currentSlide.showSkip) {
      void completeOnboarding();
    }
  }, [completeOnboarding, currentSlide.showSkip]);

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaView style={styles.root}>
      <YStack flex={1} paddingHorizontal='$5' paddingBottom='$6'>
        <XStack
          alignItems='center'
          justifyContent='space-between'
          marginTop='$3'
          marginBottom='$4'
        >
          <XStack width={72} />

          <XStack flex={1} justifyContent='center' space='$2'>
            {SLIDES.map((slide, index) => {
              const isActive = index === currentIndex;
              return (
                <YStack
                  key={slide.key}
                  width={isActive ? 28 : 8}
                  height={8}
                  borderRadius={9999}
                  backgroundColor={isActive ? "#1C2430" : "#D4D9E3"}
                />
              );
            })}
          </XStack>

          {currentSlide.showSkip ? (
            <Button unstyled onPress={handleSkip} paddingHorizontal={0}>
              <Text color='#667085' fontSize={16} fontWeight='500'>
                Skip
              </Text>
            </Button>
          ) : (
            <XStack width={72} />
          )}
        </XStack>

        <YStack flex={1} alignItems='center' justifyContent='space-between'>
          <YStack
            flex={1}
            alignItems='center'
            justifyContent='center'
            width='100%'
            paddingHorizontal='$2'
          >
            {currentSlide.customVisual ? (
              currentSlide.customVisual
            ) : (
              <Image
                source={currentSlide.image!}
                contentFit='contain'
                style={styles.image}
              />
            )}
          </YStack>

          <YStack
            width='100%'
            backgroundColor='#FFFFFF'
            borderRadius={28}
            paddingVertical='$6'
            paddingHorizontal='$5'
            space='$5'
            shadowColor='rgba(15, 23, 42, 0.08)'
            shadowOffset={{ width: 0, height: 18 }}
            shadowOpacity={1}
            shadowRadius={32}
            elevation={16}
          >
            <YStack space='$3' alignItems='center'>
              <Text
                textAlign='center'
                color='#0D0D12'
                fontSize={28}
                fontWeight='600'
                lineHeight={34}
              >
                {currentSlide.title}
              </Text>
              <Paragraph
                textAlign='center'
                color='#667085'
                fontSize={16}
                lineHeight={24}
              >
                {currentSlide.description}
              </Paragraph>
            </YStack>

            <Button
              height={56}
              borderRadius={14}
              backgroundColor='#101828'
              onPress={handleNext}
            >
              <Text color='#FFFFFF' fontSize={16} fontWeight='600'>
                {currentSlide.ctaLabel}
              </Text>
            </Button>
          </YStack>
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F7F8FA"
  },
  image: {
    width: "100%",
    maxWidth: 320,
    aspectRatio: 0.56
  }
});

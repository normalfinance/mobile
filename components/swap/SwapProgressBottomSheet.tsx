import React, { useEffect, useMemo, useRef } from "react";
import { YStack, XStack, Text, Spinner, Circle, View, Button } from "tamagui";
import { Check, Loader2, ExternalLink } from "lucide-react-native";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { useColorScheme } from "react-native";

export type SwapLoadingStep =
  | "checking"
  | "trustline-building"
  | "trustline-submitting"
  | "trustline-confirming"
  | "swap-building"
  | "swap-submitting"
  | "success";

export type SwapLoadingStatus = "loading" | "success" | "error";

interface SwapProgressBottomSheetProps {
  visible: boolean;
  step: SwapLoadingStep;
  status: SwapLoadingStatus;
  tokenSymbol?: string;
  sellAmount?: string;
  buyAmount?: string;
  sellToken?: string;
  buyToken?: string;
  transactionHash?: string;
  onClose?: () => void;
  onViewTransaction?: () => void;
}

const StepIndicator: React.FC<{
  completed: boolean;
  active: boolean;
  label: string;
}> = ({ completed, active, label }) => {
  return (
    <XStack alignItems="center" gap="$2">
      <Circle
        size={24}
        backgroundColor={
          completed ? "$green500" : active ? "$purple500" : "$gray300"
        }
        borderWidth={2}
        borderColor={
          completed ? "$green600" : active ? "$purple600" : "$gray400"
        }
      >
        {completed ? (
          <Check size={14} color="white" />
        ) : active ? (
          <Spinner size="small" color="white" />
        ) : (
          <View width={8} height={8} backgroundColor="white" borderRadius={4} />
        )}
      </Circle>
      <Text
        fontSize="$3"
        color={completed || active ? "$textPrimary" : "$textSecondary"}
        fontWeight={active ? "600" : "400"}
      >
        {label}
      </Text>
    </XStack>
  );
};

export const SwapProgressBottomSheet: React.FC<
  SwapProgressBottomSheetProps
> = ({
  visible,
  step,
  status,
  tokenSymbol,
  sellAmount,
  buyAmount,
  sellToken,
  buyToken,
  transactionHash,
  onClose,
  onViewTransaction,
}) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const colorScheme = useColorScheme();
  const snapPoints = useMemo(() => ["65%"], []);

  // Handle visibility changes
  useEffect(() => {
    console.log(
      "👀 Bottom sheet visibility changed:",
      visible,
      "ref:",
      bottomSheetRef.current
    );
    if (visible) {
      console.log("📈 Attempting to present bottom sheet");
      bottomSheetRef.current?.present();
    } else {
      console.log("📉 Attempting to dismiss bottom sheet");
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  console.log(
    "🎨 SwapProgressBottomSheet render - visible:",
    visible,
    "step:",
    step
  );

  const getStepMessage = (): string => {
    switch (step) {
      case "checking":
        return "Checking trustline...";
      case "trustline-building":
        return `Creating trustline for ${tokenSymbol || "token"}...`;
      case "trustline-submitting":
        return "Submitting trustline to network...";
      case "trustline-confirming":
        return "Confirming trustline creation...";
      case "swap-building":
        return "Preparing swap transaction...";
      case "swap-submitting":
        return "Submitting swap to network...";
      case "success":
        return "Swap completed successfully!";
      default:
        return "Processing...";
    }
  };

  const getProgressPercentage = (): number => {
    switch (step) {
      case "checking":
        return 10;
      case "trustline-building":
        return 25;
      case "trustline-submitting":
        return 40;
      case "trustline-confirming":
        return 55;
      case "swap-building":
        return 70;
      case "swap-submitting":
        return 90;
      case "success":
        return 100;
      default:
        return 0;
    }
  };

  const isTrustlineStep = step.startsWith("trustline-");
  const isSwapStep = step.startsWith("swap-");
  const trustlineCompleted =
    step === "swap-building" ||
    step === "swap-submitting" ||
    step === "success";

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={0}
      pressBehavior="none"
    />
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: colorScheme === "dark" ? "#1a1a1a" : "#ffffff",
      }}
      handleIndicatorStyle={{ backgroundColor: "#D0D5DD" }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
      >
        <YStack gap="$4" paddingTop="$2">
          {/* Header */}
          <YStack alignItems="center" gap="$2">
            {status === "success" ? (
              <Circle size={60} backgroundColor="$green500">
                <Check size={36} color="white" />
              </Circle>
            ) : (
              <Circle size={60} backgroundColor="$purple100">
                <Loader2 size={36} color="#947BFF" />
              </Circle>
            )}
            <Text
              fontSize="$6"
              fontWeight="700"
              color="$textPrimary"
              textAlign="center"
            >
              {status === "success" ? "Success!" : "Processing Transaction"}
            </Text>
          </YStack>

          {/* Progress Bar */}
          <YStack gap="$2">
            <XStack
              height={8}
              backgroundColor="$gray200"
              borderRadius="$4"
              overflow="hidden"
            >
              <View
                height="100%"
                backgroundColor="$purple500"
                width={`${getProgressPercentage()}%`}
                animation="quick"
              />
            </XStack>
            <Text fontSize="$2" color="$textSecondary" textAlign="center">
              {getProgressPercentage()}% Complete
            </Text>
          </YStack>

          {/* Current Step Message */}
          <Text
            fontSize="$4"
            color="$textPrimary"
            textAlign="center"
            fontWeight="500"
          >
            {getStepMessage()}
          </Text>

          {/* Transaction Details */}
          {sellAmount && buyAmount && sellToken && buyToken && (
            <YStack
              backgroundColor="$gray100"
              borderRadius="$4"
              padding="$3"
              gap="$2"
            >
              <XStack justifyContent="space-between">
                <Text fontSize="$3" color="$textSecondary">
                  Selling
                </Text>
                <Text fontSize="$3" color="$textPrimary" fontWeight="600">
                  {sellAmount} {sellToken}
                </Text>
              </XStack>
              <XStack justifyContent="space-between">
                <Text fontSize="$3" color="$textSecondary">
                  Buying
                </Text>
                <Text fontSize="$3" color="$textPrimary" fontWeight="600">
                  {buyAmount} {buyToken}
                </Text>
              </XStack>
            </YStack>
          )}

          {/* Step Indicators */}
          {/* <YStack gap="$3" paddingTop="$2">
            {(isTrustlineStep || trustlineCompleted) && (
              <StepIndicator
                completed={trustlineCompleted}
                active={isTrustlineStep}
                label="Create Trustline"
              />
            )}
            <StepIndicator
              completed={step === "success"}
              active={isSwapStep}
              label="Execute Swap"
            />
            <StepIndicator
              completed={step === "success"}
              active={step === "success"}
              label="Complete"
            />
          </YStack> */}

          {/* Success Message with Transaction Link */}
          {status === "success" && transactionHash && (
            <YStack
              backgroundColor="$green50"
              borderRadius="$4"
              padding="$4"
              gap="$3"
              borderWidth={0.5}
              borderColor="#1B1B1B"
              marginTop="$2"
            >
              <Text
                fontSize="$4"
                color="$green700"
                fontWeight="600"
                textAlign="center"
              >
                Swap transaction submitted successfully!
              </Text>
              {onViewTransaction && (
                <Button
                  size="$3"
                  backgroundColor="$green500"
                  color="white"
                  onPress={onViewTransaction}
                  icon={<ExternalLink size={16} color="black" />}
                  pressStyle={{ opacity: 0.8 }}
                >
                  <Text>View on Stellar Expert</Text>
                </Button>
              )}
            </YStack>
          )}

          {/* Close Button - Only show when complete (success or error) */}
          {(status === "success" || status === "error") && (
            <Button
              size="$4"
              backgroundColor="$purple500"
              color="white"
              onPress={onClose}
              marginTop="$4"
              pressStyle={{ opacity: 0.8 }}
            >
              Done
            </Button>
          )}
        </YStack>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

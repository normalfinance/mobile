import React from "react";
import { XStack, YStack, Text, Circle, Button } from "tamagui";

interface ActionButtonProps {
  label: string;
  icon: string;
  backgroundColor: string;
  onPress: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon,
  backgroundColor,
  onPress
}) => (
  <Button
    onPress={onPress}
    backgroundColor="transparent"
    padding="$0"
    borderWidth={0}
    unstyled
  >
    <YStack alignItems="center" space="$2">
      <Circle size={48} backgroundColor={backgroundColor}>
        <Text fontSize="$5" color="white" fontWeight="700">
          {icon}
        </Text>
      </Circle>
      <Text fontSize="$2" color="$textPrimary" fontWeight="500">
        {label}
      </Text>
    </YStack>
  </Button>
);

interface ActionButtonsProps {
  onSwap?: () => void;
  onSend?: () => void;
  onBuy?: () => void;
  onSell?: () => void;
  onReceive?: () => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onSwap = () => console.log("Swap pressed"),
  onSend = () => console.log("Send pressed"),
  onBuy = () => console.log("Buy pressed"),
  onSell = () => console.log("Sell pressed"),
  onReceive = () => console.log("Receive pressed")
}) => {
  const actions = [
    {
      label: "Swap",
      icon: "⇄",
      backgroundColor: "$blue9",
      onPress: onSwap
    },
    {
      label: "Send",
      icon: "↗",
      backgroundColor: "$green9",
      onPress: onSend
    },
    {
      label: "Buy",
      icon: "+",
      backgroundColor: "$purple9",
      onPress: onBuy
    },
    {
      label: "Sell",
      icon: "−",
      backgroundColor: "$red9",
      onPress: onSell
    },
    {
      label: "Receive",
      icon: "↙",
      backgroundColor: "$orange9",
      onPress: onReceive
    }
  ];

  return (
    <XStack 
      justifyContent="space-between" 
      paddingVertical="$4"
      paddingHorizontal="$2"
      marginBottom="$4"
    >
      {actions.map((action) => (
        <ActionButton
          key={action.label}
          label={action.label}
          icon={action.icon}
          backgroundColor={action.backgroundColor}
          onPress={action.onPress}
        />
      ))}
    </XStack>
  );
};
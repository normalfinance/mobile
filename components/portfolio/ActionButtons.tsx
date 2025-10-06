import React from "react";
import { XStack, YStack, Text, Circle, Button } from "tamagui";

interface ActionButtonProps {
  label: string;
  icon: string;
  backgroundColor: string;
  borderColor: string;
  onPress: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon,
  backgroundColor,
  borderColor,
  onPress
}) => (
  <Button
    onPress={onPress}
    backgroundColor='transparent'
    padding='$0'
    borderColor={borderColor}
    borderWidth={0}
    unstyled
  >
    <YStack alignItems='center' space='$2'>
      <Circle
        size={48}
        backgroundColor={backgroundColor}
        borderColor={borderColor}
        borderRadius='$4'
        borderWidth={1}
      >
        <Text fontSize='$5' color='white' fontWeight='700'>
          {icon}
        </Text>
      </Circle>
      <Text fontSize='$2' color='#1C252E' fontWeight='500'>
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
      backgroundColor: "#2DE9C833",
      borderColor: "#2DE9C81F",
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
      justifyContent='space-between'
      paddingVertical='$4'
      paddingHorizontal='$2'
      marginBottom='$4'
    >
      {actions.map((action) => (
        <ActionButton
          key={action.label}
          label={action.label}
          icon={action.icon}
          backgroundColor={action.backgroundColor}
          borderColor={action.borderColor}
          onPress={action.onPress}
        />
      ))}
    </XStack>
  );
};

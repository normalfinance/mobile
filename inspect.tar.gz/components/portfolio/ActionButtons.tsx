import React, { ReactNode, useMemo } from "react";
import { XStack, YStack, Text, Circle, Button } from "tamagui";
import { SvgUri } from "react-native-svg";
import { useAssets } from "expo-asset";
import { Image } from "expo-image";

type ActionIconKey = "swap" | "send" | "buy" | "sell" | "receive";
type ActionIcons = Record<ActionIconKey, ReactNode>;

const ICON_SOURCES = {
  swap: require("@svgs/swap.svg"),
  send: require("@svgs/send.svg"),
  buy: require("@svgs/buy.png"),
  sell: require("@svgs/sell.svg"),
  receive: require("@svgs/recieve.svg")
} as const;

const ICON_ASSET_LIST = [
  ICON_SOURCES.swap,
  ICON_SOURCES.send,
  ICON_SOURCES.buy,
  ICON_SOURCES.sell,
  ICON_SOURCES.receive
];

interface ActionButtonProps {
  label: string;
  icon: ReactNode;
  backgroundColor: string;
  borderColor?: string;
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
    borderColor={borderColor ?? "transparent"}
    borderWidth={0}
    unstyled
  >
    <YStack alignItems='center' space='$2'>
      <Circle
        size={46}
        backgroundColor={backgroundColor}
        borderColor={borderColor ?? "transparent"}
        borderRadius='$4'
        borderWidth={borderColor ? 1 : 0}
        alignItems='center'
        justifyContent='center'
      >
        {icon}
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
  const [iconAssets] = useAssets(ICON_ASSET_LIST);

  const icons = useMemo<ActionIcons>(() => {
    const fallback: ActionIcons = {
      swap: (
        <Text fontSize='$5' color='white' fontWeight='700'>
          ⇄
        </Text>
      ),
      send: (
        <Text fontSize='$5' color='white' fontWeight='700'>
          ↗
        </Text>
      ),
      buy: (
        <Text fontSize='$5' color='white' fontWeight='700'>
          +
        </Text>
      ),
      sell: (
        <Text fontSize='$5' color='white' fontWeight='700'>
          −
        </Text>
      ),
      receive: (
        <Text fontSize='$5' color='white' fontWeight='700'>
          ↙
        </Text>
      )
    };

    if (!iconAssets) {
      return fallback;
    }

    const [swapAsset, sendAsset, buyAsset, sellAsset, receiveAsset] =
      iconAssets;

    return {
      swap:
        swapAsset != null ? (
          <SvgUri
            width='18'
            height='18'
            uri={swapAsset.localUri ?? swapAsset.uri}
          />
        ) : (
          fallback.swap
        ),
      send:
        sendAsset != null ? (
          <SvgUri
            width='18'
              height='18'
            uri={sendAsset.localUri ?? sendAsset.uri}
          />
        ) : (
          fallback.send
        ),
      buy:
        buyAsset != null ? (
          <Image
            source={{ uri: buyAsset.localUri ?? buyAsset.uri }}
            style={{ width: 18, height: 18 }}
            contentFit='contain'
          />
        ) : (
          fallback.buy
        ),
      sell:
        sellAsset != null ? (
          <SvgUri
            width='18'
            height='18'
            uri={sellAsset.localUri ?? sellAsset.uri}
          />
        ) : (
          fallback.sell
        ),
      receive:
        receiveAsset != null ? (
          <SvgUri
            width='18'
            height='18'
            uri={receiveAsset.localUri ?? receiveAsset.uri}
          />
        ) : (
          fallback.receive
        )
    };
  }, [iconAssets]);

  const actions = [
    {
      label: "Swap",
      icon: icons.swap,
      backgroundColor: "#2DE9C833",
      borderColor: "#2DE9C81F",
      onPress: onSwap
    },
    {
      label: "Send",
      icon: icons.send,
      backgroundColor: "#00AFF733",
      borderColor: "#00AFF71F",
      onPress: onSend
    },
    {
      label: "Buy",
      icon: icons.buy,
      backgroundColor: "#947BFF33",
      borderColor: "#947BFF1F",
      onPress: onBuy
    },
    {
      label: "Sell",
      icon: icons.sell,
      backgroundColor: "#F8279C33",
      borderColor: "#F8279C1F",
      onPress: onSell
    },
    {
      label: "Receive",
      icon: icons.receive,
      backgroundColor: "#FF6F4C33",
      borderColor: "#FF6F4C1F",
      onPress: onReceive
    }
  ];

  return (
    <XStack
      justifyContent='flex-start'
      gap='$4'
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

import React, { useState } from "react";
import {
  YStack,
  XStack,
  H2,
  Text,
  Card,
  Button,
  Input,
  Separator
} from "tamagui";

const SwapCard = () => {
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("BTC");

  return (
    <Card elevate padding='$4' marginVertical='$4'>
      <YStack space='$4'>
        <Text fontSize='$6' fontWeight='bold'>
          Swap
        </Text>
        <YStack space='$2'>
          <Text fontSize='$4' color='$color10'>
            From
          </Text>
          {/* @ts-ignore */}
          <XStack space='$2' alignItems='center'>
            <Input
              flex={1}
              size='$4'
              placeholder='0.00'
              value={fromAmount}
              onChangeText={setFromAmount}
              keyboardType='numeric'
            />
            {/* @ts-ignore */}
            <Text fontSize='$4' fontWeight='600' minWidth={60}>
              {fromCurrency}
            </Text>
          </XStack>
        </YStack>

        {/* @ts-ignore */}
        <XStack justifyContent='center'>
          <Button size='$3' circular>
            ↕️
          </Button>
        </XStack>

        <YStack space='$2'>
          <Text fontSize='$4' color='$color10'>
            To
          </Text>

          {/* @ts-ignore */}
          <XStack space='$2' alignItems='center'>
            <Input
              flex={1}
              size='$4'
              placeholder='0.00'
              value={toAmount}
              onChangeText={setToAmount}
              keyboardType='numeric'
            />
            {/* @ts-ignore */}
            <Text fontSize='$4' fontWeight='600' minWidth={60}>
              {toCurrency}
            </Text>
          </XStack>
        </YStack>

        <Separator />

        <Button
          theme='blue'
          size='$4'
          disabled={!fromAmount || parseFloat(fromAmount) <= 0}
        >
          Preview Swap
        </Button>
      </YStack>
    </Card>
  );
};

export default function InvestScreen() {
  return (
    // @ts-ignore
    <YStack flex={1} padding='$4' backgroundColor='$background'>
      {/* @ts-ignore */}
      <H2 marginBottom='$4'>Invest</H2>
      {/* @ts-ignore */}
      <Text marginBottom='$4'>Swap between different assets</Text>
      <SwapCard />
    </YStack>
  );
}

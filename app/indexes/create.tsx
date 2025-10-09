import React, { useMemo, useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
  YStack,
  XStack,
  Text,
  Button,
  Input,
  Card,
  Avatar,
  Switch,
  TextArea
} from "tamagui";
import { SafeAreaView } from "react-native-safe-area-context";
import { User } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";

import { Picker } from '@react-native-picker/picker';
import { View } from 'react-native';

import { AssetIcon } from "@/components/ui/AssetIcon";
import SemiCircleGauge from "@/components/index/guage";
type AllocationAsset = {
  id: string;
  symbol: string;
  name: string;
  weight: number;
};

const weightingOptions = [
  { label: "Equal weight", value: "equal" },
  { label: "Market cap", value: "market-cap" },
  { label: "Custom", value: "custom" }
];

const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
};

const describeArc = (
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y
  ].join(" ");
};

const AllocationRow: React.FC<{
  asset: AllocationAsset;
  onRemove: (id: string) => void;
}> = ({ asset, onRemove }) => {
  return (
    <XStack
      alignItems='center'
      justifyContent='space-between'
      paddingVertical={12}
      paddingHorizontal={0}
      borderBottomWidth={1}
      borderBottomColor='#DFE3E8'
    >
      <XStack alignItems='center' space='$3'>
        <AssetIcon
          symbol={asset.symbol}
          size={34}
          fontSize='$4'
          fontWeight='700'
        />
        <YStack>
          <Text fontSize='$2' fontWeight='700' color='#1C252E'>
            {asset.name}
          </Text>
        </YStack>
      </XStack>
      <XStack alignItems='center' space='$3'>
        <Text
          fontSize='$3'
          fontWeight='600'
          color='#1C252E'
          fontFamily='$numeric'
        >
          {`${asset.weight}%`}
        </Text>
        <Button
          size='$2'
          borderRadius={6}
          borderColor='#DFE3E8'
          borderWidth={1}
          backgroundColor='#637381'
          onPress={() => onRemove(asset.id)}
        >
          <Text fontSize='$2' fontWeight='700' color='#ffffff'>
            Remove
          </Text>
        </Button>
      </XStack>
    </XStack>
  );
};


const CreateIndexScreen: React.FC = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [label, setLabel] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [weighting, setWeighting] = useState("custom");
  const [assets, setAssets] = useState<AllocationAsset[]>([
    { id: "btc-1", symbol: "BTC", name: "Bitcoin", weight: 25 },
    { id: "eth-1", symbol: "ETH", name: "Ethereum", weight: 25 },
    { id: "sol-1", symbol: "SOL", name: "Solana", weight: 22 }
  ]);

  const totalAllocation = useMemo(
    () => assets.reduce((total, item) => total + item.weight, 0),
    [assets]
  );

  const handleRemoveAsset = (id: string) => {
    setAssets((prev) => prev.filter((asset) => asset.id !== id));
  };

  const handleAddAsset = () => {
    // Placeholder for future asset picker integration
    setAssets((prev) => [
      ...prev,
      {
        id: `asset-${prev.length + 1}`,
        symbol: "NEW",
        name: "New Asset",
        weight: 10
      }
    ]);
  };

  const handleCreateIndex = () => {
    // Placeholder create handler
    router.back();
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <YStack space='$5' paddingTop={16}>
        <YStack space='$3'>
          <Text fontSize='$4' fontWeight='600' color='#1C252E'>
            Create an index
          </Text>
          <YStack alignItems='center' space='$2' margin={8}>
            <Avatar circular size='$6'>
              <Avatar.Image
                accessibilityLabel='Index avatar placeholder'
                src=''
              />
              <Avatar.Fallback
                backgroundColor='#E4E7EB'
                justifyContent='center'
                alignItems='center'
              >
                <Text fontSize='$4' color='#1C252E'>
                  <User />
                </Text>
              </Avatar.Fallback>
            </Avatar>
            <Text fontSize='$2' color='#637381'>
              Upload index asset
            </Text>
          </YStack>
        </YStack>

        <YStack space='$4'>
          <YStack space='$2'>
            <Text fontSize='$2' fontWeight='600' color='#1C252E'>
              Name
            </Text>
            <Input
              placeholder='Index name'
              height={52}
              borderRadius={12}
              borderColor='#DFE3E8'
              backgroundColor='#F9FAFB'
              value={name}
              onChangeText={setName}
            />
          </YStack>

          <YStack space='$2'>
            <Text fontSize='$2' fontWeight='600' color='#1C252E'>
              Symbol
            </Text>
            <Input
              placeholder='Index symbol'
              height={52}
              borderRadius={12}
              borderColor='#DFE3E8'
              backgroundColor='#F9FAFB'
              autoCapitalize='characters'
              value={symbol}
              onChangeText={setSymbol}
            />
          </YStack>

          <YStack space='$2'>
            <Text fontSize='$2' fontWeight='600' color='#1C252E'>
              Label
            </Text>
            <TextArea
              placeholder='Hint text'
              rows={4}
              borderRadius={12}
              borderColor='#DFE3E8'
              backgroundColor='#F9FAFB'
              value={label}
              onChangeText={setLabel}
            />
          </YStack>

          <XStack alignItems='center' justifyContent='flex-start'>
            <Switch
              size='$2'
              marginRight={8}
              backgroundColor='#E4E7EB'
              checked={isPublic}
              onCheckedChange={(value) => setIsPublic(!!value)}
            >
              <Switch.Thumb backgroundColor='#1C252E' />
            </Switch>
            <XStack alignItems='center' space='$2'>
              <Text fontSize='$3' fontWeight='400' color='#1C252E'>
                Public index
              </Text>
            </XStack>
          </XStack>

          <YStack space='$2'>
            <Text fontSize='$2' fontWeight='600' color='#1C252E'>
              Weighting method
            </Text>
            <View
              style={{
                height: 52,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#DFE3E8',
                backgroundColor: '#F9FAFB',
                justifyContent: 'center'
              }}
            >
              <Picker
                selectedValue={weighting}
                onValueChange={setWeighting}
                style={{ height: 50 }}
              >
                {weightingOptions.map((option) => (
                  <Picker.Item
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Picker>
            </View>
          </YStack>
        </YStack>

        <Card padding={10} space='$4'>
          <SemiCircleGauge
            size={250}
            minValue={0}
            maxValue={100}
            initialValue={50}
            strokeWidth={15}
            activeColor='#4CAF50'
            inactiveColor='#E0E0E0'
            knobColor='#2196F3'
            onValueChange={(value) => console.log("Value:", value)}
          />
          <YStack space='$3'>
            {assets.map((asset) => (
              <AllocationRow
                key={asset.id}
                asset={asset}
                onRemove={handleRemoveAsset}
              />
            ))}
          </YStack>
          <XStack alignItems='center' justifyContent='flex-end'>
            <Button
              alignSelf='flex-start'
              size='$3'
              backgroundColor='#1C252E'
              color='#FFFFFF'
              borderRadius={6}
              onPress={handleAddAsset}
              paddingVertical={6}
              paddingHorizontal={12}
            >
              <Text fontSize='$2' fontWeight='700' color='#FFFFFF'>
                Add asset
              </Text>
            </Button>
          </XStack>
        </Card>

        <Button
          height={42}
          backgroundColor='#1C252E'
          color='#FFFFFF'
          borderRadius={6}
          onPress={handleCreateIndex}
          paddingVertical={4}
          paddingHorizontal={12}
        >
          <Text fontSize='$3' fontWeight='700' color='#FFFFFF'>
            Create index
          </Text>
        </Button>
      </YStack>
    </ScrollView>
  );
};

export default CreateIndexScreen;

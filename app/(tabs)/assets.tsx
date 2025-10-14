import React from "react";
import {
  YStack,
  XStack,
  H2,
  H6,
  Text,
  Card,
  ScrollView,
  Spinner
} from "tamagui";
import { useWalletBalanceStatus } from "@/services/balance.service";
import { useWallet } from "@/services/wallet.service";
import { DisplayAsset } from "@/lib/types/balance.types";
import { AssetListSkeleton } from "@/components/ui/skeleton/portfolio-skeletons";

const AssetItem = ({ asset }: { asset: DisplayAsset }) => {
  const formatBalance = (balance: string) => {
    const numBalance = parseFloat(balance);
    if (numBalance === 0) return "0";
    if (numBalance < 0.0001) return "< 0.0001";
    if (numBalance < 1) return numBalance.toFixed(4);
    if (numBalance < 1000) return numBalance.toFixed(2);
    return numBalance.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  return (
    <Card elevate padding='$3' marginVertical='$2'>
      {/* @ts-ignore */}
      <XStack justifyContent='space-between' alignItems='center'>
        <YStack flex={1}>
          <H6>{asset.display_name}</H6>
          <Text color='$color10' fontSize='$3'>
            {asset.asset_code}
          </Text>
          {asset.asset_issuer && (
            <Text color='$color8' fontSize='$2' numberOfLines={1}>
              Issuer: {asset.asset_issuer.substring(0, 12)}...
            </Text>
          )}
        </YStack>

        {/* @ts-ignore */}
        <YStack alignItems='flex-end'>
          <Text fontSize='$4' fontWeight='600'>
            {formatBalance(asset.balance)}
          </Text>
          <Text fontSize='$3' color='$color10'>
            {asset.asset_code}
          </Text>
        </YStack>
      </XStack>
    </Card>
  );
};

export default function AssetsScreen() {
  const { data: wallet } = useWallet();
  const {
    balances,
    isLoading,
    error,
    isAccountNotFound,
    hasBalances,
    refetch
  } = useWalletBalanceStatus();

  const renderContent = () => {
    if (!wallet) {
      return (
        <YStack
          flex={1}
          // @ts-ignore
          justifyContent='center'
          alignItems='center'
          padding='$4'
        >
          {/* @ts-ignore */}
          <Text color='$color10' textAlign='center'>
            No wallet found. Please create or import a wallet first.
          </Text>
        </YStack>
      );
    }

    if (isLoading) {
      return (
        <AssetListSkeleton show={true} itemCount={6} />
      );
    }

    if (isAccountNotFound) {
      return (
        <YStack
          flex={1}
          // @ts-ignore
          justifyContent='center'
          alignItems='center'
          padding='$4'
        >
          {/* @ts-ignore */}
          <Text color='$color10' textAlign='center' marginBottom='$2'>
            Your wallet account is not yet activated on the Stellar network.
          </Text>
          {/* @ts-ignore */}
          <Text color='$color8' textAlign='center' fontSize='$3'>
            Fund your account with at least 1 XLM to activate it and start
            holding assets.
          </Text>
        </YStack>
      );
    }

    if (error) {
      return (
        <YStack
          flex={1}
          // @ts-ignore
          justifyContent='center'
          alignItems='center'
          padding='$4'
        >
          {/* @ts-ignore */}
          <Text color='$red10' textAlign='center' marginBottom='$3'>
            Failed to load your assets
          </Text>
          <Text
            color='$color8'
            // @ts-ignore
            textAlign='center'
            fontSize='$3'
            marginBottom='$4'
          >
            {error.message}
          </Text>
          <Card
            // @ts-ignore
            pressable
            onPress={() => refetch()}
            padding='$3'
            backgroundColor='$color4'
          >
            <Text color='$color12'>Retry</Text>
          </Card>
        </YStack>
      );
    }

    if (!hasBalances) {
      return (
        <YStack
          flex={1}
          // @ts-ignore
          justifyContent='center'
          alignItems='center'
          padding='$4'
        >
          {/* @ts-ignore */}
          <Text color='$color10' textAlign='center'>
            No assets found in your wallet.
          </Text>
        </YStack>
      );
    }

    return (
      // @ts-ignore
      <ScrollView flex={1} paddingHorizontal='$4'>
        <YStack space='$2'>
          {balances.map((asset, index) => (
            <AssetItem
              key={`${asset.asset_code}-${
                asset.asset_issuer || "native"
              }-${index}`}
              asset={asset}
            />
          ))}
        </YStack>
      </ScrollView>
    );
  };

  return (
    // @ts-ignore
    <YStack flex={1} backgroundColor='$background'>
      {/* @ts-ignore */}
      <YStack padding='$4'>
        {/* @ts-ignore */}
        <H2 marginBottom='$2'>Assets</H2>

        {/* @ts-ignore */}
        <Text color='$color10' marginBottom='$4'>
          {wallet
            ? `Wallet: ${wallet.publicKey.substring(0, 12)}...`
            : "Track your cryptocurrency investments"}
        </Text>
      </YStack>

      {renderContent()}
    </YStack>
  );
}

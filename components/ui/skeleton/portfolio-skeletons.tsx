import React from 'react';
import { Skeleton } from 'moti/skeleton';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { View } from 'tamagui';
import { SkeletonBox, SkeletonCircle, SkeletonText } from './index';

interface PortfolioSkeletonProps {
  show?: boolean;
}

export function PortfolioValueSkeleton({ show = true }: PortfolioSkeletonProps) {
  return (
    <Skeleton.Group show={show}>
      <View padding="$4" alignItems="center">
        <SkeletonText show={show} width="40%" height={14} />
        <View marginVertical="$2">
          <SkeletonBox show={show} width={200} height={48} />
        </View>
        <SkeletonText show={show} width="30%" height={16} />
      </View>
    </Skeleton.Group>
  );
}

export function AssetListSkeleton({ show = true, itemCount = 5 }: PortfolioSkeletonProps & { itemCount?: number }) {
  return (
    <Skeleton.Group show={show}>
      <View>
        {Array.from({ length: itemCount }).map((_, index) => (
          <View key={index} flexDirection="row" alignItems="center" padding="$4" gap="$3">
            <SkeletonCircle show={show} width={40} height={40} />
            <View flex={1} gap="$2">
              <SkeletonBox show={show} width="60%" height={16} />
              <SkeletonBox show={show} width="40%" height={14} />
            </View>
            <View alignItems="flex-end" gap="$2">
              <SkeletonBox show={show} width={80} height={16} />
              <SkeletonBox show={show} width={60} height={14} />
            </View>
          </View>
        ))}
      </View>
    </Skeleton.Group>
  );
}

export function ChartSkeleton({ show = true }: PortfolioSkeletonProps) {
  return (
    <Skeleton.Group show={show}>
      <View padding="$4">
        <View flexDirection="row" justifyContent="space-between" marginBottom="$3">
          {['1D', '1W', '1M', '3M', '1Y'].map((period, index) => (
            <SkeletonBox key={index} show={show} width={40} height={32} radius={20} />
          ))}
        </View>
        <SkeletonBox show={show} width="100%" height={200} radius={12} />
      </View>
    </Skeleton.Group>
  );
}

export function TransactionSkeleton({ show = true, itemCount = 3 }: PortfolioSkeletonProps & { itemCount?: number }) {
  return (
    <Skeleton.Group show={show}>
      <View>
        <View padding="$4" paddingBottom="$2">
          <SkeletonBox show={show} width="50%" height={20} />
        </View>
        {Array.from({ length: itemCount }).map((_, index) => (
          <View key={index} flexDirection="row" alignItems="center" padding="$4" gap="$3">
            <SkeletonCircle show={show} width={32} height={32} />
            <View flex={1} gap="$2">
              <SkeletonBox show={show} width="70%" height={16} />
              <SkeletonBox show={show} width="50%" height={14} />
            </View>
            <View alignItems="flex-end" gap="$2">
              <SkeletonBox show={show} width={70} height={16} />
              <SkeletonBox show={show} width={50} height={14} />
            </View>
          </View>
        ))}
      </View>
    </Skeleton.Group>
  );
}

export function ActionButtonsSkeleton({ show = true }: PortfolioSkeletonProps) {
  return (
    <Skeleton.Group show={show}>
      <View flexDirection="row" padding="$4" gap="$3">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonBox key={index} show={show} flex={1} height={48} radius={24} />
        ))}
      </View>
    </Skeleton.Group>
  );
}
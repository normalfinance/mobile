import React from 'react';
import { Skeleton } from 'moti/skeleton';
import { View } from 'tamagui';
import { SkeletonBox, SkeletonCircle } from './index';

interface PriceSkeletonProps {
  show?: boolean;
  itemCount?: number;
}

export function PriceListSkeleton({ show = true, itemCount = 10 }: PriceSkeletonProps) {
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
            <SkeletonBox show={show} width={60} height={24} radius={12} />
          </View>
        ))}
      </View>
    </Skeleton.Group>
  );
}

export function AssetDetailSkeleton({ show = true }: Omit<PriceSkeletonProps, 'itemCount'>) {
  return (
    <Skeleton.Group show={show}>
      <View>
        <View padding="$4" alignItems="center">
          <SkeletonCircle show={show} width={80} height={80} />
          <View marginVertical="$3" alignItems="center" gap="$2">
            <SkeletonBox show={show} width={120} height={24} />
            <SkeletonBox show={show} width={80} height={16} />
          </View>
          <SkeletonBox show={show} width={200} height={48} />
          <View marginTop="$2">
            <SkeletonBox show={show} width={150} height={20} />
          </View>
        </View>

        <View padding="$4">
          <View flexDirection="row" justifyContent="space-between" marginBottom="$3">
            {['1D', '1W', '1M', '3M', '1Y'].map((_, index) => (
              <SkeletonBox key={index} show={show} width={40} height={32} radius={20} />
            ))}
          </View>
          <SkeletonBox show={show} width="100%" height={250} radius={12} />
        </View>

        <View padding="$4">
          <SkeletonBox show={show} width="40%" height={20} />
          <View marginTop="$3" gap="$3">
            {Array.from({ length: 4 }).map((_, index) => (
              <View key={index} flexDirection="row" justifyContent="space-between">
                <SkeletonBox show={show} width="40%" height={16} />
                <SkeletonBox show={show} width="30%" height={16} />
              </View>
            ))}
          </View>
        </View>
      </View>
    </Skeleton.Group>
  );
}
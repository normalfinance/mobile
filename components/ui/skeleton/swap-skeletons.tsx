import React from 'react';
import { Skeleton } from 'moti/skeleton';
import { View } from 'tamagui';
import { SkeletonBox, SkeletonCircle } from './index';

interface SwapSkeletonProps {
  show?: boolean;
}

export function SwapSectionSkeleton({ show = true }: SwapSkeletonProps) {
  return (
    <Skeleton.Group show={show}>
      <View>
        <View padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4" marginVertical="$2">
          <View flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom="$3">
            <SkeletonBox show={show} width="30%" height={16} />
            <SkeletonBox show={show} width="40%" height={16} />
          </View>
          
          <View flexDirection="row" alignItems="center" gap="$3">
            <SkeletonCircle show={show} width={40} height={40} />
            <View flex={1}>
              <SkeletonBox show={show} width="60%" height={20} />
              <View marginTop="$2">
                <SkeletonBox show={show} width="40%" height={14} />
              </View>
            </View>
            <View alignItems="flex-end">
              <SkeletonBox show={show} width={100} height={32} />
            </View>
          </View>
        </View>
      </View>
    </Skeleton.Group>
  );
}

export function AssetSelectorSkeleton({ show = true }: SwapSkeletonProps) {
  return (
    <Skeleton.Group show={show}>
      <View>
        <View padding="$3" marginBottom="$2">
          <SkeletonBox show={show} width="50%" height={20} />
        </View>
        
        {Array.from({ length: 6 }).map((_, index) => (
          <View key={index} flexDirection="row" alignItems="center" padding="$4" gap="$3">
            <SkeletonCircle show={show} width={36} height={36} />
            <View flex={1} gap="$2">
              <SkeletonBox show={show} width="50%" height={16} />
              <SkeletonBox show={show} width="70%" height={14} />
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

export function SwapButtonSkeleton({ show = true }: SwapSkeletonProps) {
  return (
    <Skeleton.Group show={show}>
      <View padding="$4">
        <SkeletonBox show={show} width="100%" height={56} radius={28} />
      </View>
    </Skeleton.Group>
  );
}
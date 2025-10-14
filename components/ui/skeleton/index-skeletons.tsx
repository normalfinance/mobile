import React from 'react';
import { Skeleton } from 'moti/skeleton';
import { View } from 'tamagui';
import { SkeletonBox, SkeletonCircle } from './index';

interface IndexSkeletonProps {
  show?: boolean;
}

export function IndexListSkeleton({ show = true }: IndexSkeletonProps) {
  return (
    <Skeleton.Group show={show}>
      <View>
        {Array.from({ length: 5 }).map((_, index) => (
          <View key={index} padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4" marginVertical="$2">
            <View flexDirection="row" alignItems="center" gap="$3" marginBottom="$3">
              <SkeletonCircle show={show} width={50} height={50} />
              <View flex={1} gap="$2">
                <SkeletonBox show={show} width="60%" height={18} />
                <SkeletonBox show={show} width="80%" height={14} />
              </View>
              <View alignItems="flex-end" gap="$2">
                <SkeletonBox show={show} width={80} height={16} />
                <SkeletonBox show={show} width={60} height={14} />
              </View>
            </View>
            
            <View gap="$2">
              <View flexDirection="row" justifyContent="space-between">
                <SkeletonBox show={show} width="30%" height={14} />
                <SkeletonBox show={show} width="25%" height={14} />
              </View>
              <View flexDirection="row" justifyContent="space-between">
                <SkeletonBox show={show} width="35%" height={14} />
                <SkeletonBox show={show} width="30%" height={14} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </Skeleton.Group>
  );
}

export function GaugeSkeleton({ show = true }: IndexSkeletonProps) {
  return (
    <Skeleton.Group show={show}>
      <View alignItems="center" padding="$4">
        <SkeletonCircle show={show} width={200} height={200} />
        <View marginTop="$3" alignItems="center" gap="$2">
          <SkeletonBox show={show} width={100} height={32} />
          <SkeletonBox show={show} width={80} height={16} />
        </View>
      </View>
    </Skeleton.Group>
  );
}

export function IndexCreateSkeleton({ show = true }: IndexSkeletonProps) {
  return (
    <Skeleton.Group show={show}>
      <View padding="$4" gap="$4">
        <View>
          <SkeletonBox show={show} width="40%" height={20} />
          <View marginTop="$2">
            <SkeletonBox show={show} width="100%" height={48} radius={12} />
          </View>
        </View>

        <View>
          <SkeletonBox show={show} width="30%" height={20} />
          <View marginTop="$2">
            <SkeletonBox show={show} width="100%" height={120} radius={12} />
          </View>
        </View>

        <View>
          <SkeletonBox show={show} width="50%" height={20} />
          <View marginTop="$3" gap="$3">
            {Array.from({ length: 3 }).map((_, index) => (
              <View key={index} flexDirection="row" alignItems="center" gap="$3" padding="$3" backgroundColor="$backgroundStrong" borderRadius="$3">
                <SkeletonCircle show={show} width={32} height={32} />
                <View flex={1}>
                  <SkeletonBox show={show} width="50%" height={16} />
                </View>
                <View width={80}>
                  <SkeletonBox show={show} width="100%" height={40} radius={8} />
                </View>
              </View>
            ))}
          </View>
        </View>

        <SkeletonBox show={show} width="100%" height={56} radius={28} />
      </View>
    </Skeleton.Group>
  );
}
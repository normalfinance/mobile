import React from 'react';
import { Skeleton } from 'moti/skeleton';
import { View } from 'tamagui';
import { SkeletonBox, SkeletonText } from './index';

interface SettingsSkeletonProps {
  show?: boolean;
}

export function SettingsPageSkeleton({ show = true }: SettingsSkeletonProps) {
  return (
    <Skeleton.Group show={show}>
      <View padding="$4">
        <SkeletonBox show={show} width="30%" height={32} marginBottom="$4" />
        
        <View backgroundColor="$backgroundStrong" borderRadius="$4" padding="$4" marginBottom="$4">
          <SkeletonBox show={show} width="50%" height={24} marginBottom="$3" />
          
          <View gap="$3">
            <View gap="$2">
              <SkeletonBox show={show} width="40%" height={16} />
              <View flexDirection="row" alignItems="center" gap="$2">
                <SkeletonBox show={show} flex={1} height={20} />
                <SkeletonBox show={show} width={60} height={32} />
              </View>
            </View>
            
            <View height={1} backgroundColor="$borderColor" />
            
            <View gap="$2">
              <SkeletonBox show={show} width="35%" height={16} />
              <View flexDirection="row" justifyContent="space-between">
                <SkeletonBox show={show} width="25%" height={16} />
                <SkeletonBox show={show} width="35%" height={16} />
              </View>
              <View flexDirection="row" justifyContent="space-between">
                <SkeletonBox show={show} width="20%" height={16} />
                <SkeletonBox show={show} width="40%" height={16} />
              </View>
            </View>
            
            <View height={1} backgroundColor="$borderColor" />
            
            <SkeletonBox show={show} width="100%" height={40} />
          </View>
        </View>
        
        <SkeletonBox show={show} width="100%" height={48} />
      </View>
    </Skeleton.Group>
  );
}
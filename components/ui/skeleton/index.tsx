import React from 'react';
import { Skeleton } from 'moti/skeleton';
import { View } from 'tamagui';

interface BaseSkeletonProps {
  show?: boolean;
  width?: number | string;
  height?: number | string;
  radius?: number;
  children?: React.ReactNode;
}

export function SkeletonBox({ 
  show = true, 
  width = '100%', 
  height = 20, 
  radius = 8,
  children 
}: BaseSkeletonProps) {
  return (
    <Skeleton
      show={show}
      radius={radius}
      colorMode="light"
      width={width}
      height={height}
    >
      {children}
    </Skeleton>
  );
}

export function SkeletonCircle({ 
  show = true, 
  width = 40, 
  height,
  children 
}: BaseSkeletonProps) {
  const size = height || width;
  
  return (
    <Skeleton
      show={show}
      radius="round"
      colorMode="light"
      width={size}
      height={size}
    >
      {children}
    </Skeleton>
  );
}

interface SkeletonTextProps extends BaseSkeletonProps {
  lines?: number;
  lineWidths?: (string | number)[];
}

export function SkeletonText({ 
  show = true, 
  lines = 1, 
  lineWidths,
  children 
}: SkeletonTextProps) {
  if (lines === 1) {
    return (
      <SkeletonBox 
        show={show} 
        width={lineWidths?.[0] || '80%'} 
        height={16}
        children={children}
      />
    );
  }
  
  return (
    <Skeleton.Group show={show}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBox
          key={index}
          show={show}
          width={lineWidths?.[index] || (index === lines - 1 ? '60%' : '100%')}
          height={16}
        />
      ))}
    </Skeleton.Group>
  );
}

interface SkeletonCardProps extends BaseSkeletonProps {
  hasAvatar?: boolean;
  hasSubtext?: boolean;
}

export function SkeletonCard({ 
  show = true, 
  hasAvatar = false, 
  hasSubtext = true,
  children 
}: SkeletonCardProps) {
  return (
    <Skeleton.Group show={show}>
      <View flexDirection="row" alignItems="center" padding="$4" gap="$3">
        {hasAvatar && (
          <SkeletonCircle show={show} width={40} height={40} />
        )}
        <View flex={1} gap="$2">
          <SkeletonBox show={show} width="70%" height={16} />
          {hasSubtext && (
            <SkeletonBox show={show} width="50%" height={14} />
          )}
        </View>
        <SkeletonBox show={show} width={60} height={16} />
      </View>
      {children}
    </Skeleton.Group>
  );
}
import React from 'react';
import { Skeleton } from 'moti/skeleton';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
  const colorScheme = useColorScheme();
  
  return (
    <Skeleton
      show={show}
      radius={radius}
      colorMode={colorScheme}
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
  const colorScheme = useColorScheme();
  const size = height || width;
  
  return (
    <Skeleton
      show={show}
      radius="round"
      colorMode={colorScheme}
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
  const colorScheme = useColorScheme();
  
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
  const colorScheme = useColorScheme();
  
  return (
    <Skeleton.Group show={show}>
      <div style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 16, 
        gap: 12 
      }}>
        {hasAvatar && (
          <SkeletonCircle show={show} width={40} height={40} />
        )}
        <div style={{ flex: 1, gap: 8 }}>
          <SkeletonBox show={show} width="70%" height={16} />
          {hasSubtext && (
            <SkeletonBox show={show} width="50%" height={14} />
          )}
        </div>
        <SkeletonBox show={show} width={60} height={16} />
      </div>
      {children}
    </Skeleton.Group>
  );
}
import React, { useEffect } from 'react';
import { YStack, XStack, Text, Button } from 'tamagui';
import { Animated, Dimensions } from 'react-native';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  actionText?: string;
  onActionPress?: () => void;
  onDismiss?: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'success',
  actionText,
  onActionPress,
  onDismiss,
  duration = 6000
}) => {
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 50,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();

      if (duration > 0) {
        const timer = setTimeout(() => {
          onDismiss?.();
        }, duration);

        return () => clearTimeout(timer);
      }
    } else {
      Animated.spring(slideAnim, {
        toValue: -100,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [visible, slideAnim, duration, onDismiss]);

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '$green9';
      case 'error':
        return '$red9';
      case 'info':
        return '$blue9';
      default:
        return '$green9';
    }
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 16,
        right: 16,
        zIndex: 1000,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <YStack
        backgroundColor={getBackgroundColor()}
        borderRadius="$4"
        padding="$4"
        shadowColor="$shadowColor"
        shadowOffset={{ width: 0, height: 2 }}
        shadowOpacity={0.25}
        shadowRadius={8}
        elevation={8}
      >
        <XStack alignItems="center" justifyContent="space-between" space="$3">
          <Text
            color="white"
            fontSize="$4"
            fontWeight="500"
            flex={1}
            flexWrap="wrap"
          >
            {message}
          </Text>
          
          {actionText && onActionPress && (
            <Button
              size="$3"
              backgroundColor="rgba(255, 255, 255, 0.2)"
              borderColor="rgba(255, 255, 255, 0.3)"
              borderWidth={1}
              onPress={onActionPress}
              paddingHorizontal="$3"
              paddingVertical="$2"
            >
              <Text
                color="white"
                fontSize="$3"
                fontWeight="600"
              >
                {actionText}
              </Text>
            </Button>
          )}
        </XStack>
      </YStack>
    </Animated.View>
  );
};
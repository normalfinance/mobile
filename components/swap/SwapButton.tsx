import React from 'react';
import { Button, Text, Spinner } from 'tamagui';

interface SwapButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  text: string;
}

export const SwapButton: React.FC<SwapButtonProps> = ({
  onPress,
  disabled = false,
  loading = false,
  text
}) => {
  return (
    <Button
      onPress={onPress}
      disabled={disabled || loading}
      backgroundColor={disabled ? "$gray8" : "$blue9"}
      color="white"
      fontSize="$5"
      fontWeight="600"
      // padding="$4"
      borderRadius="$6"
      width="100%"
      opacity={disabled ? 0.6 : 1}
    >
      {loading ? (
        <Spinner size="small" color="white" />
      ) : (
        <Text color="white" fontSize="$5" fontWeight="600">
          {text}
        </Text>
      )}
    </Button>
  );
};
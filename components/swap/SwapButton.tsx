import React from "react";
import { Button, Text, Spinner } from "tamagui";

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
      backgroundColor={disabled ? "$purple100" : "#947BFF33"}
      color='#947BFF'
      fontSize='$5'
      fontWeight='600'
      // padding='$4'
      borderRadius='$card'
      width='100%'
      height={54}
      opacity={disabled ? 0.6 : 1}
      pressStyle={{
        backgroundColor: "$purple600",
        scale: 0.98
      }}
      hoverStyle={{
        backgroundColor: "$purple600"
      }}
    >
      {loading ? (
        <Spinner size='small' color='white' />
      ) : (
        <Text color='#947BFF' fontSize='$2' fontWeight='600'>
          {text}
        </Text>
      )}
    </Button>
  );
};

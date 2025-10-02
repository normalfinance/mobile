import { View, Text } from 'tamagui';

export default function FontTest() {
  return (
    <View padding="$4" space="$4" backgroundColor="$background">
      <Text fontFamily="$heading" fontSize="$8" fontWeight="700">
        Satoshi Heading Font - Text Content
      </Text>
      
      <Text fontFamily="$body" fontSize="$5" fontWeight="400">
        Satoshi Body Font - Regular text content for reading
      </Text>
      
      <Text fontFamily="$text" fontSize="$4" fontWeight="500">
        Satoshi Text Font - General text usage
      </Text>
      
      <Text fontFamily="$numeric" fontSize="$6" fontWeight="600">
        Barlow Numeric: $1,234.56 - 0.05% - 999 tokens
      </Text>
      
      <Text fontFamily="$mono" fontSize="$3" fontWeight="400">
        Barlow Mono: Code snippets, addresses, hashes
      </Text>
      
      <View space="$2" marginTop="$4">
        <Text fontFamily="$text" fontSize="$3">Price:</Text>
        <Text fontFamily="$numeric" fontSize="$7" fontWeight="700">$4,567.89</Text>
      </View>
    </View>
  );
}
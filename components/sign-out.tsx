import { useClerk } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Button, Text } from "tamagui";
import { useDeleteWallet } from "@/services";

export const SignOutButton = () => {
  // Use `useClerk()` to access the `signOut()` function
  const { signOut } = useClerk();
  const router = useRouter();
  const deleteWallet = useDeleteWallet();

  const handleSignOut = async () => {
    try {
      // Clear wallet data from secure storage BEFORE signing out
      console.log("Clearing wallet data from secure storage...");
      await deleteWallet.mutateAsync();
      console.log("Wallet data cleared successfully");
      
      // Then sign out from Clerk
      console.log("Signing out from Clerk...");
      await signOut();
      console.log("Signed out successfully");
      
      router.replace("/(tabs)");
    } catch (err) {
      console.error("Error during sign out:", JSON.stringify(err, null, 2));
    }
  };

  return (
    <Button onPress={handleSignOut}>
      <Text>Sign Out</Text>
    </Button>
  );
};

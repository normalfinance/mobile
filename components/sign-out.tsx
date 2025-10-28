import { useRouter } from "expo-router";
import { Button, Text } from "tamagui";
import { useDeleteWallet } from "@/services";
import { secureStorage } from "@/lib/utils";
import { STORAGE_KEYS } from "@/lib/constants";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

export const SignOutButton = () => {
  const { signOut } = useSupabaseAuth();
  const router = useRouter();
  const deleteWallet = useDeleteWallet();

  const handleSignOut = async () => {
    try {
      // Clear wallet data from secure storage BEFORE signing out
      console.log("Clearing wallet data from secure storage...");
      await deleteWallet.mutateAsync();
      console.log("Wallet data cleared successfully");

      await secureStorage.deleteItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
      console.log("Onboarding state cleared");

      // Then sign out from Supabase
      console.log("Signing out from Supabase...");
      await signOut();
      console.log("Signed out successfully");

      router.replace("/(tabs)");
    } catch (err) {
      console.error("Error during sign out:", JSON.stringify(err, null, 2));
    }
  };

  return (
    <Button onPress={handleSignOut} backgroundColor='$buttonColor'>
      <Text>Sign Out</Text>
    </Button>
  );
};

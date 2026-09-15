import { Redirect } from "expo-router";

// `normalapp://wallet-setup` is the Supabase-allow-listed OAuth redirect
// (services/auth.service.ts). WebBrowser.openAuthSessionAsync intercepts it in
// the normal flow; this route only exists so a cold-start deep link never
// shows "Unmatched route". The tabs gate decides where the user really goes.
export default function WalletSetupRedirect() {
  return <Redirect href='/(tabs)' />;
}

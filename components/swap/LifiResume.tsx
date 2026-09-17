// Mounted once inside the tabs: as soon as the wallet is known, any LI.FI swap
// this phone broadcast and never saw settle (lib/lifi/pending-lifi.ts) is
// restored as a live run and tracked to the end — records it if the app died
// before the source tx confirmed, refreshes balances, and shows it under In
// flight. Renders nothing.

import React from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { registerPushToken } from "@/lib/notifications";
import { resumePendingLifiRuns } from "@/lib/swap/runner";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

let started = false;

export function LifiResume() {
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();
  const { wallet } = useTurnkeyWallet();
  React.useEffect(() => {
    // Once per app process (the tabs tree can remount): the runner dedupes by
    // source tx as well, so a repeat here could never double a swap anyway.
    if (!wallet || started) return;
    started = true;
    void resumePendingLifiRuns({ queryClient, userId: user?.id, wallet, autopilotHint: () => false });
    void registerPushToken(); // no-op until permission is granted / the route exists
  }, [wallet, user?.id, queryClient]);
  return null;
}

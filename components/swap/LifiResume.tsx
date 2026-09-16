// Mounted once inside the tabs: as soon as the wallet is known, any LI.FI swap
// this phone broadcast and never saw settle (lib/lifi/pending-lifi.ts) is
// restored as a live run and tracked to the end — records it if the app died
// before the source tx confirmed, refreshes balances, and shows it under In
// flight. Renders nothing.

import React from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { resumePendingLifiRuns } from "@/lib/swap/runner";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

export function LifiResume() {
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();
  const { wallet } = useTurnkeyWallet();
  const started = React.useRef(false);
  React.useEffect(() => {
    if (!wallet || started.current) return;
    started.current = true;
    void resumePendingLifiRuns({ queryClient, userId: user?.id, wallet, autopilotHint: () => false });
  }, [wallet, user?.id, queryClient]);
  return null;
}

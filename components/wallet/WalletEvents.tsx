// App-wide reactions to wallet provisioning (mounted once in the tabs layout,
// which stays mounted beneath Buy / Send / Asset / Swap-run screens):
// after any wallet creation or chain addition, offer the recovery phrase
// unless the backup is already confirmed (Niko 2026-10-03: "ask me if I want
// to see the passphrase when I set up any wallet"). Get started handles its
// own first creation (it routes to /backup directly), so that one is skipped.

import React from "react";
import { Alert } from "react-native";
import { usePathname, useRouter } from "expo-router";

import { fetchTurnkeyWallet, useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { applyParkedMarketingOptIn } from "@/lib/auth/marketing";
import { applyReferral } from "@/lib/referral";
import { offerUsdcSetup } from "@/lib/stellar/usdc-setup";
import { onWalletProvisioned, walletNeedsBackup } from "@/lib/turnkey/provision";

// One backup offer per wallet per app PROCESS — module scope, not a ref, so a
// remount of this component (the tabs layout re-mounting under a Redirect,
// fast refresh) can never queue a second identical alert behind the first
// (live 2026-10-13: "Later" on the XLM asset page revealed another copy).
const offeredBackup = new Set<string>();

export function WalletEvents() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = React.useRef(pathname);
  pathRef.current = pathname;
  React.useEffect(() => {
    void applyParkedMarketingOptIn(); // ticked on Create account, before a session existed
  }, []);
  // Referral: applied once (idempotent) as soon as a Stellar address exists (web: only Stellar addresses are referral wallets).
  const { wallet } = useTurnkeyWallet();
  React.useEffect(() => {
    if (wallet?.stellarAddress) void applyReferral(wallet.stellarAddress);
  }, [wallet?.stellarAddress]);
  // Stellar just set up (any entry point but Get started, which hands over via
  // /backup → Home params): continue to USDC — fund, then trustline (Niko
  // 2026-10-13). Savings has its own setup card, so not from there.
  const offerUsdc = React.useCallback(async () => {
    if (pathRef.current.startsWith("/savings")) return;
    const w = await fetchTurnkeyWallet().catch(() => null);
    if (!w?.stellarAddress) return;
    await new Promise((r) => setTimeout(r, 900)); // the passkey sheet / previous alert is still dismissing
    await offerUsdcSetup({
      address: w.stellarAddress,
      openReceive: (asset) => router.navigate({ pathname: "/(tabs)", params: { receive: "stellar", asset } }),
      buyXlm: () => router.push({ pathname: "/buy", params: { asset: "XLM" } })
    });
  }, [router]);
  React.useEffect(() => {
    const off = onWalletProvisioned(async (e) => {
        if (pathRef.current.startsWith("/create-wallet")) return; // Get started shows /backup itself
        if (offeredBackup.has(e.subOrgId)) return;
        offeredBackup.add(e.subOrgId);
        const afterBackup = e.chain === "stellar" ? () => void offerUsdc() : undefined;
        if (!(await walletNeedsBackup(e.subOrgId))) {
          afterBackup?.();
          return;
        }
        // The passkey sheet is still dismissing when this fires; an alert
        // presented during that transition is silently dropped by iOS
        // (live 2026-10-03: no offer after adding Stellar from the asset page).
        await new Promise((r) => setTimeout(r, 900));
        if (pathRef.current.startsWith("/backup")) return; // already looking at it
        const chainName = e.chain.charAt(0).toUpperCase() + e.chain.slice(1);
        Alert.alert(
          e.kind === "created" ? "Back up your new wallet?" : `${chainName} added — back up your wallet?`,
          e.kind === "created"
            ? "Your wallet has a 12-word recovery phrase. Writing it down now means you can restore it if you ever lose this phone."
            : `Your new ${chainName} address depends on the same recovery phrase. You haven’t confirmed writing it down yet.`,
          [
            { text: "Later", style: "cancel", onPress: afterBackup },
            { text: "Show recovery phrase", onPress: () => router.push("/backup") }
          ]
        );
    });
    return () => {
      off();
    };
  }, [router, offerUsdc]);
  return null;
}

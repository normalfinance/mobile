// App-wide reactions to wallet provisioning (mounted once in the tabs layout,
// which stays mounted beneath Buy / Send / Asset / Swap-run screens):
// after any wallet creation or chain addition, offer the recovery phrase
// unless the backup is already confirmed (Niko 2026-10-03: "ask me if I want
// to see the passphrase when I set up any wallet"). Get started handles its
// own first creation (it routes to /backup directly), so that one is skipped.

import React from "react";
import { Alert } from "react-native";
import { usePathname, useRouter } from "expo-router";

import { onWalletProvisioned, walletNeedsBackup } from "@/lib/turnkey/provision";

export function WalletEvents() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = React.useRef(pathname);
  pathRef.current = pathname;
  React.useEffect(() => {
    const off = onWalletProvisioned(async (e) => {
        if (pathRef.current.startsWith("/create-wallet")) return; // Get started shows /backup itself
        if (!(await walletNeedsBackup(e.subOrgId))) return;
        const chainName = e.chain.charAt(0).toUpperCase() + e.chain.slice(1);
        Alert.alert(
          e.kind === "created" ? "Back up your new wallet?" : `${chainName} added — back up your wallet?`,
          e.kind === "created"
            ? "Your wallet has a 12-word recovery phrase. Writing it down now means you can restore it if you ever lose this phone."
            : `Your new ${chainName} address depends on the same recovery phrase. You haven’t confirmed writing it down yet.`,
          [
            { text: "Later", style: "cancel" },
            { text: "Show recovery phrase", onPress: () => router.push("/backup") }
          ]
        );
    });
    return () => {
      off();
    };
  }, [router]);
  return null;
}

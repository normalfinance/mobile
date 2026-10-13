// After a Stellar address is set up, ask whether to continue to USDC (Niko
// 2026-10-13). A brand-new account holds 0 XLM, so the trustline cannot be
// added yet: the offer depends on the Horizon probe — unfunded → get XLM
// first; funded → add the trustline (one passkey). Once per address per app
// session; Home's USDC setup row stays until the trustline exists.

import { Alert } from "react-native";

import { deriveSetupStep, probeStellarAccount } from "@/lib/savings/engine";

const offeredFor = new Set<string>();

export type ReceiveAssetChoice = "XLM" | "USDC";

export const offerUsdcSetup = async (p: {
  address: string;
  /** Open the Receive sheet on that asset — XLM to fund, USDC for the trustline step. */
  openReceive: (asset: ReceiveAssetChoice) => void;
  buyXlm: () => void;
  force?: boolean;
}): Promise<void> => {
  if (!p.force && offeredFor.has(p.address)) return;
  offeredFor.add(p.address);
  const probe = await probeStellarAccount(p.address).catch(() => null);
  const step = deriveSetupStep(probe);
  if (!step || step === "ready") return;
  if (step === "activate") {
    Alert.alert(
      "Add USDC to your Stellar wallet?",
      "Your wallet can hold USDC once your Stellar account has a little XLM — about 3 (1 activates the account, 0.5 is reserved for the USDC trustline, the rest pays fees) — and a USDC trustline. Get the XLM first; Home will offer the trustline as soon as it lands.",
      [
        { text: "Later", style: "cancel" },
        { text: "Buy XLM", onPress: p.buyXlm },
        { text: "Receive XLM", onPress: () => p.openReceive("XLM") }
      ]
    );
    return;
  }
  Alert.alert(
    "Add the USDC trustline now?",
    "Your Stellar account is active. One passkey confirmation lets this wallet hold USDC on Stellar — a tiny network fee, and 0.5 XLM stays reserved while the trustline exists.",
    [
      { text: "Not now", style: "cancel" },
      { text: "Add trustline", onPress: () => p.openReceive("USDC") }
    ]
  );
};

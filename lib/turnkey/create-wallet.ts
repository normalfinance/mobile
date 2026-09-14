// New user: passkey → sub-org + Stellar wallet → link the Stellar address.
// Order and routes are web's (docs/web-agent-answers.md Q25, Q54):
//   registerPasskey()  → POST /api/turnkey/wallet { challenge, attestation, chain: "stellar" }
//                      → POST /api/wallets/link { walletAddress }   (activity + ownership checks read linked_wallets)
// The wallet route is idempotent: an existing row returns 200 { wallet }.

import { apiFetch } from "@/lib/api";
import type { TurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { invalidateCredentials } from "./credentials";
import { registerPasskey } from "./passkey";

interface WalletResponse {
  wallet: Partial<TurnkeyWallet> & { stellarAddress?: string | null };
}

export const createWalletWithPasskey = async (user: {
  id: string;
  email?: string | null;
}): Promise<{ stellarAddress: string | null }> => {
  const attestation = await registerPasskey(user);

  const created = await apiFetch<WalletResponse>("/api/turnkey/wallet", {
    body: {
      challenge: attestation.challenge,
      attestation: attestation.attestation,
      chain: "stellar"
    }
  });

  const stellarAddress = created?.wallet?.stellarAddress ?? null;

  if (stellarAddress) {
    // Web links the Normal wallet's own Stellar address after creation
    // (onboarding-wizard.tsx:678). Non-fatal here: the wallet already exists.
    await apiFetch("/api/wallets/link", {
      body: { walletAddress: stellarAddress, walletName: "Normal Wallet" }
    }).catch(() => undefined);
  }

  invalidateCredentials();
  return { stellarAddress };
};

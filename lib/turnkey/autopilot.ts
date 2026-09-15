// Autopilot — the one-time consent ceremony that makes cross-chain swaps
// single-signature (port of web lib/turnkey/autopilot-consent.ts + revoke).
// ONE or TWO passkey prompts create, on the USER'S OWN sub-org:
//   1. an API-only user "Normal Autopilot" credentialed with the SERVER'S
//      public key (one keypair serves all consenting users; the private half
//      never leaves the server), and
//   2. a NARROW policy: that user may sign ONLY Base-chain transactions with
//      zero native value to the allowlisted contracts (USDC, Circle
//      TokenMessengerV2, LI.FI diamond). Enforcement is Turnkey's signer, not
//      our server's good behaviour — a stolen server key can do nothing else.
// Truth lives in Turnkey (GET api/autopilot/status reads the sub-org), so a
// revoke from any surface is immediately authoritative. Absent public key =
// feature dark (CLAUDE.md Q40).

import { apiFetch } from "@/lib/api";
import { BASE_USDC, EVM_CCTP } from "@/lib/cctp/config";
import { createPasskeyClient } from "./client";

export const AUTOPILOT_PUBLIC_KEY = process.env.EXPO_PUBLIC_AUTOPILOT_PUBLIC_KEY || "";
export const autopilotAvailable = () => !!AUTOPILOT_PUBLIC_KEY;
export const AUTOPILOT_USER_NAME = "Normal Autopilot";
const POLICY_NAME = "normal-autopilot-base-legs";
const BASE_CHAIN_ID = "8453";

/** Same constants the burn/pivot code sends to; LI.FI diamond verified
 *  against li.quest/v1/chains (8453) on web, 2026-08-20. */
const ALLOWED_CONTRACTS = {
  usdc: BASE_USDC,
  circleTokenMessengerV2: EVM_CCTP.tokenMessengerV2,
  lifiDiamond: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE"
} as const;

/** Validated against Turnkey's live policy parser on web (2026-08-21):
 *  membership uses `in`; `.contains()` takes a literal and fails to parse. */
export const autopilotPolicyCondition = (): string => {
  const list = Object.values(ALLOWED_CONTRACTS)
    .map((a) => `'${a.toLowerCase()}'`)
    .join(", ");
  return `eth.tx.chain_id == ${BASE_CHAIN_ID} && eth.tx.value == 0 && eth.tx.to in [${list}]`;
};

export interface AutopilotStatus {
  active: boolean;
  autopilotUserId: string | null;
  reason?: string;
}

/** Unknown ≠ inactive: a failed read means "no autopilot for this run". */
export const fetchAutopilotStatus = async (): Promise<AutopilotStatus> => {
  try {
    const d = await apiFetch<{ success?: boolean; active?: boolean; autopilotUserId?: string | null; reason?: string }>("/api/autopilot/status");
    return { active: d?.active === true, autopilotUserId: d?.autopilotUserId ?? null, reason: d?.reason };
  } catch {
    return { active: false, autopilotUserId: null, reason: "unknown" };
  }
};

/**
 * The ceremony. IDEMPOTENT: a half-run (user created, policy never reached)
 * is repaired by reusing the existing delegate — re-creating it fails with
 * "credential public keys must be unique" (web incident 2026-08-21).
 */
export const grantAutopilotConsent = async (subOrgId: string): Promise<{ autopilotUserId: string; policyId: string }> => {
  if (!AUTOPILOT_PUBLIC_KEY) throw new Error("Automatic completion isn’t configured on this build.");
  const status = await fetchAutopilotStatus();
  const client = await createPasskeyClient();

  let autopilotUserId = status.autopilotUserId ?? "";
  if (!autopilotUserId) {
    const userActivity = await client.createApiOnlyUsers({
      type: "ACTIVITY_TYPE_CREATE_API_ONLY_USERS",
      timestampMs: String(Date.now()),
      organizationId: subOrgId,
      parameters: {
        apiOnlyUsers: [
          {
            userName: AUTOPILOT_USER_NAME,
            apiKeys: [{ apiKeyName: "normal-autopilot-key", publicKey: AUTOPILOT_PUBLIC_KEY }],
            userTags: []
          }
        ]
      }
    });
    // Tolerant parsing: the result key differs across API versions (web).
    const result = (userActivity?.activity?.result ?? {}) as { createApiOnlyUsersResult?: { userIds?: string[] }; createUsersResult?: { userIds?: string[] } };
    autopilotUserId = result.createApiOnlyUsersResult?.userIds?.[0] ?? result.createUsersResult?.userIds?.[0] ?? "";
    if (!autopilotUserId) throw new Error("Turnkey did not create the autopilot user");
  }

  const policyActivity = await client.createPolicy({
    type: "ACTIVITY_TYPE_CREATE_POLICY_V3",
    timestampMs: String(Date.now()),
    organizationId: subOrgId,
    parameters: {
      policyName: POLICY_NAME,
      effect: "EFFECT_ALLOW",
      consensus: `approvers.any(user, user.id == '${autopilotUserId}')`,
      condition: autopilotPolicyCondition(),
      notes: "Completes swaps the user started: Base legs to allowlisted contracts only."
    }
  });
  const policyId = policyActivity?.activity?.result?.createPolicyResult?.policyId ?? "";
  if (!policyId) throw new Error("Turnkey did not create the autopilot policy");
  return { autopilotUserId, policyId };
};

/** One passkey prompt deletes the delegate; its key and policies die with it. */
export const revokeAutopilotConsent = async (subOrgId: string, autopilotUserId: string): Promise<void> => {
  const client = await createPasskeyClient();
  const activity = await client.deleteUsers({
    type: "ACTIVITY_TYPE_DELETE_USERS",
    timestampMs: String(Date.now()),
    organizationId: subOrgId,
    parameters: { userIds: [autopilotUserId] }
  });
  const deleted = activity?.activity?.result?.deleteUsersResult?.userIds;
  if (!deleted?.includes(autopilotUserId)) throw new Error("Turnkey did not delete the user");
};

// Account deletion (App Store guideline 5.1.1(v)) — final web contract
// (web agent 2026-10-12, Niko's decision: the recovery phrase must be exported
// first, server-verified against Turnkey's activity log, never overridable):
//   DELETE /api/account { confirm: "DELETE", override?: boolean, dryRun?: boolean }
//     200 { success, dryRun?, balances, deleted, anonymised }
//     400 { code:'CONFIRM' }
//     409 { code:'EXPORT_REQUIRED', wallets:[walletId…] }   export each seed (≤24 h old)
//     409 { code:'IN_FLIGHT', counts:{cctp, ramp, moneygram} } never overridable
//     409 { code:'FUNDS_PRESENT', balances:[{symbol, chain, balance}], unreadable }
//                                 overridable with override:true
//     503 { code:'UNAVAILABLE', unreadable? }   a balance could not be read / backend down
// Deleted: users + referrals, push devices, fills, linked wallets, enrolments,
// wallet seeds + wallets rows, the Supabase auth user (last). Anonymised: CCTP,
// ramp and MoneyGram rows. Untouched: the Turnkey sub-org and passkeys.

import { ApiError, apiFetch } from "@/lib/api";
import { unregisterPushToken } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

export interface FundsBalance {
  symbol: string;
  chain: string;
  balance: string | number;
}

export type DeleteBlock =
  | { code: "EXPORT_REQUIRED"; wallets: string[]; message: string }
  | { code: "IN_FLIGHT"; counts: { cctp?: number; ramp?: number; moneygram?: number }; message: string }
  | { code: "FUNDS_PRESENT"; balances: FundsBalance[]; unreadable: string[]; message: string }
  | { code: "UNAVAILABLE"; unreadable: string[]; message: string };

export class AccountDeleteBlockedError extends Error {
  constructor(public readonly block: DeleteBlock) {
    super(block.message);
    this.name = "AccountDeleteBlocked";
  }
}

const toBlock = (e: unknown): AccountDeleteBlockedError | null => {
  if (!(e instanceof ApiError) || (e.status !== 409 && e.status !== 503)) return null;
  const b = (e.body ?? {}) as { code?: string; error?: string; wallets?: string[]; counts?: DeleteBlock extends { counts: infer C } ? C : never; balances?: FundsBalance[]; unreadable?: string[] };
  const message = b.error ?? e.message;
  switch (b.code) {
    case "EXPORT_REQUIRED":
      return new AccountDeleteBlockedError({ code: "EXPORT_REQUIRED", wallets: b.wallets ?? [], message });
    case "IN_FLIGHT":
      return new AccountDeleteBlockedError({ code: "IN_FLIGHT", counts: (b.counts as { cctp?: number; ramp?: number; moneygram?: number }) ?? {}, message });
    case "FUNDS_PRESENT":
      return new AccountDeleteBlockedError({ code: "FUNDS_PRESENT", balances: b.balances ?? [], unreadable: b.unreadable ?? [], message });
    case "UNAVAILABLE":
      return new AccountDeleteBlockedError({ code: "UNAVAILABLE", unreadable: b.unreadable ?? [], message });
    default:
      return null;
  }
};

const call = async (body: Record<string, unknown>) => {
  try {
    return await apiFetch<{ success: boolean; balances?: FundsBalance[] }>("/api/account", { method: "DELETE", body: { confirm: "DELETE", ...body } });
  } catch (e) {
    throw toBlock(e) ?? e;
  }
};

/** Runs every gate, deletes nothing. Resolves when all gates pass. */
export const checkAccountDeletion = (opts: { override?: boolean } = {}) => call({ dryRun: true, ...(opts.override ? { override: true } : {}) });

export const deleteAccount = async (opts: { override?: boolean } = {}): Promise<void> => {
  await unregisterPushToken().catch(() => undefined);
  await call(opts.override ? { override: true } : {});
  // The auth user was deleted last server-side; the JWT is already invalid.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
};

/** Every seed the account holds — each must be exported before deletion. */
export const listWalletSeeds = async (): Promise<{ walletId: string; label?: string; isPrimary?: boolean }[]> => {
  const d = await apiFetch<{ wallets?: { walletId: string; label?: string; isPrimary?: boolean }[] }>("/api/turnkey/wallets");
  return d?.wallets ?? [];
};

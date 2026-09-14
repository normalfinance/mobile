// Normal Savings on mobile — a port of the web engine, not a reinterpretation:
//   hooks/stellar/use-defindex-savings.tsx   deposit / withdraw flow + pre-checks
//   lib/stellar/fee-pair.ts                   sign-both-first pairing, submitFeePair
//   lib/portfolio/normalize.ts                reconcileSavingsPosition (no-clobber)
//   lib/normal-wallet-setup.ts                probe + USDC trustline
//   utils/normal-fees.ts                      copied verbatim → ./normal-fees.ts
//
// Money rules that are NOT negotiable (web findings, each cost real users):
//   #26  sign BOTH transactions before anything is submitted; the fee tx is
//        chained one sequence behind the service tx, so it can only apply
//        after the deposit/withdraw did. Rejecting either prompt costs nothing.
//   #27  the server records the transaction BEFORE broadcasting — we never
//        submit a savings tx to Horizon ourselves; everything goes through
//        POST /api/fees/execute-pair.
//   #52  a position read that started before an action must not overwrite
//        the post-action value (epoch guard in hooks/use-savings.ts).
//   #67  Soroban fees are paid in XLM above the reserve; block actions below
//        MIN_XLM_FOR_SOROBAN_TX and say why.

import { Asset, Horizon, Networks, Operation, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import type { TurnkeyClient } from "@turnkey/http";

import { ApiError, apiFetch } from "@/lib/api";
import {
  HORIZON_URL,
  MAINNET_USDC,
  awaitTxVisible,
  friendlyHorizonError,
  horizon,
  xlmFeeStatus,
  type XlmFeeStatus
} from "@/lib/stellar/send";
import { createPasskeyClient, isUserCancelledError } from "@/lib/turnkey/client";
import { signStellarXdrWithTurnkey } from "@/lib/turnkey/stellar-signer";
import { getSavingsDepositFee, getYieldCommission } from "./normal-fees";

// Web build-fee-payment.ts: fee txs of a pair get a 15-minute window so the
// server escrow can retry after the service tx lands.
export const FEE_PAIR_TIMEOUT_SECONDS = 900;

// ---------------------------------------------------------------------------
// Types (web types/savings.ts)
// ---------------------------------------------------------------------------

export interface SavingsPosition {
  shares: string;
  currentValue: string;
  totalDeposited: string;
  earnings: string;
  lifetimeEarnings?: string;
}

export const ZERO_POSITION: SavingsPosition = {
  shares: "0",
  currentValue: "0",
  totalDeposited: "0",
  earnings: "0"
};

/** One Horizon read → everything the setup flow and the fee light need. */
export interface StellarAccountProbe {
  exists: boolean;
  hasUsdcTrustline: boolean;
  xlmBalance: number;
  usdcBalance: number;
  subentryCount: number;
  feeStatus: XlmFeeStatus | null; // null until the account exists
}

export type SetupStep = "activate" | "trustline" | "ready";

/** First unmet condition wins (web deriveSetupStep). An activated account whose
 *  fee XLM ran dry goes back to "activate" — the step doubles as a top-up. */
export const deriveSetupStep = (probe: StellarAccountProbe | null): SetupStep | null => {
  if (!probe) return null;
  if (!probe.exists) return "activate";
  if (probe.feeStatus === "blocked") return "activate";
  if (!probe.hasUsdcTrustline) return "trustline";
  return "ready";
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const isNotFound = (e: unknown) =>
  (e as { response?: { status?: number } })?.response?.status === 404 ||
  (e as { name?: string })?.name === "NotFoundError";

/** 404 = not activated. Transient Horizon failures get two more attempts —
 *  web doc 95 W4: a wrong "no" here made a user fund the account twice. */
export const probeStellarAccount = async (
  address: string,
  attempt = 0
): Promise<StellarAccountProbe> => {
  try {
    const acc = await horizon().loadAccount(address);
    const xlm = Number(acc.balances.find((b) => b.asset_type === "native")?.balance ?? 0);
    const usdc = acc.balances.find(
      (b) => "asset_code" in b && b.asset_code === MAINNET_USDC.code && b.asset_issuer === MAINNET_USDC.issuer
    );
    return {
      exists: true,
      hasUsdcTrustline: !!usdc,
      xlmBalance: xlm,
      usdcBalance: usdc ? Number(usdc.balance) : 0,
      subentryCount: acc.subentry_count,
      feeStatus: xlmFeeStatus(xlm, acc.subentry_count)
    };
  } catch (e) {
    if (isNotFound(e)) {
      return { exists: false, hasUsdcTrustline: false, xlmBalance: 0, usdcBalance: 0, subentryCount: 0, feeStatus: null };
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      return probeStellarAccount(address, attempt + 1);
    }
    throw e;
  }
};

interface UserPositionResponse {
  success: boolean;
  userPosition: SavingsPosition | null;
  reason?: string;
  error?: string;
}

export class PositionUnavailableError extends Error {
  constructor() {
    super("Savings position unavailable right now.");
    this.name = "PositionUnavailableError";
  }
}

/** GET savings/user-position. `null` from the route means "upstream failed,
 *  keep what you had" — surfaced as a throw so a cached value survives and a
 *  cold screen shows a skeleton, never a confident $0 (web finding). */
export const fetchSavingsPosition = async (
  address: string,
  fresh = false
): Promise<SavingsPosition | null> => {
  const data = await apiFetch<UserPositionResponse>("/api/savings/user-position", {
    anonymous: true,
    query: { user: address, network: "mainnet", ...(fresh ? { refresh: 1 } : {}) }
  });
  if (!data?.success) throw new Error(data?.error || "Failed to fetch savings position");
  return data.userPosition ?? null;
};

/** Web reconcileSavingsPosition, verbatim logic: never clobber a held position
 *  with a transient 0; treat a deposits dip while value held as indexer lag. */
export const reconcileSavingsPosition = (
  apiPos: SavingsPosition | null | undefined,
  prev: SavingsPosition | null
): SavingsPosition => {
  const apiCV = apiPos ? parseFloat(apiPos.currentValue || "0") : 0;
  const prevCV = prev ? parseFloat(prev.currentValue || "0") : 0;
  if (apiCV <= 0 && prevCV > 0 && prev) return prev;
  if (!apiPos) return ZERO_POSITION;
  if (prev) {
    const apiTD = parseFloat(apiPos.totalDeposited);
    const prevTD = parseFloat(prev.totalDeposited);
    const currentValue = parseFloat(apiPos.currentValue);
    const depositsFell = apiTD < prevTD - 0.001;
    const valueHeld = currentValue >= prevCV - 0.001;
    const depositsLagging = depositsFell && valueHeld;
    const stale = apiTD > currentValue + 0.001 || depositsLagging;
    if (stale) {
      return {
        ...apiPos,
        totalDeposited: prev.totalDeposited,
        earnings: Math.max(currentValue - prevTD, 0).toFixed(7)
      };
    }
  }
  return apiPos;
};

// ---------------------------------------------------------------------------
// USDC trustline (web addCompanionUsdcTrustline): one classic tx, one passkey.
// ---------------------------------------------------------------------------

export const addUsdcTrustline = async ({
  subOrgId,
  address
}: {
  subOrgId: string;
  address: string;
}): Promise<string> => {
  const server = horizon();
  const account = await server.loadAccount(address);
  const tx = new TransactionBuilder(account, { fee: "2000", networkPassphrase: Networks.PUBLIC })
    .addOperation(Operation.changeTrust({ asset: new Asset(MAINNET_USDC.code, MAINNET_USDC.issuer) }))
    .setTimeout(120)
    .build();
  const signed = await signStellarXdrWithTurnkey({
    xdr: tx.toXDR(),
    subOrgId,
    stellarAddress: address,
    networkPassphrase: Networks.PUBLIC
  });
  try {
    const result = await server.submitTransaction(TransactionBuilder.fromXDR(signed, Networks.PUBLIC));
    return result.hash;
  } catch (e) {
    throw new Error(friendlyHorizonError(e));
  }
};

// ---------------------------------------------------------------------------
// Fee pair (web lib/stellar/fee-pair.ts)
// ---------------------------------------------------------------------------

export type FeePairKind = "savings_deposit" | "savings_withdraw";

export interface FeePairResult {
  serviceHash: string;
  feeHash: string | null;
  /** false = fee escrowed; the cron sweeper collects it within minutes. */
  feeSubmitted: boolean;
}

const getTransactionSequence = (xdrString: string): string => {
  const tx = TransactionBuilder.fromXDR(xdrString, Networks.PUBLIC);
  if (!(tx instanceof Transaction)) throw new Error("Cannot read sequence from a fee-bump transaction");
  return tx.sequence;
};

type OnChainStatus = "success" | "failed" | "not_found";

const probeOnChain = async (server: Horizon.Server, hash: string): Promise<OnChainStatus> => {
  try {
    const tx = await server.transactions().transaction(hash).call();
    return (tx as { successful?: boolean }).successful !== false ? "success" : "failed";
  } catch (e) {
    if (isNotFound(e)) return "not_found";
    throw e;
  }
};

/** Poll Horizon until the tx appears (~40s max). */
const awaitOnChain = async (server: Horizon.Server, hash: string): Promise<OnChainStatus> => {
  for (let i = 0; i < 10; i += 1) {
    try {
      const status = await probeOnChain(server, hash);
      if (status !== "not_found") return status;
    } catch {
      /* Horizon hiccup — keep polling */
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  return "not_found";
};

interface ExecutePairResponse {
  success: boolean;
  servicePending?: boolean;
  serviceHash?: string;
  feeHash?: string | null;
  feeSubmitted?: boolean;
  error?: string;
}

/** Retrying after ANY throw from here is safe: a fresh pair reuses the same
 *  sequence numbers, so at most one pair can ever apply on-chain. */
const submitFeePair = async (params: {
  signedServiceXdr: string;
  signedFeeXdr: string | null;
  kind: FeePairKind;
  record: { vaultAddress: string; amount: string; feeAmount: string | null };
}): Promise<FeePairResult> => {
  const { signedServiceXdr, signedFeeXdr, kind, record } = params;
  const server = horizon();
  const serviceHash = TransactionBuilder.fromXDR(signedServiceXdr, Networks.PUBLIC).hash().toString("hex");

  const post = () =>
    apiFetch<ExecutePairResponse>("/api/fees/execute-pair", {
      body: { serviceXdr: signedServiceXdr, feeXdr: signedFeeXdr, kind, record }
    });
  let data: ExecutePairResponse;
  try {
    try {
      data = await post();
    } catch (e) {
      // 429 = our own user limiter (30/10s); the SAME signed pair is resubmitted
      // after a pause — no re-signing needed (execute-pair contract, 2026-09-15).
      if (e instanceof ApiError && e.status === 429) {
        await new Promise((r) => setTimeout(r, 3000));
        data = await post();
      } else {
        throw e;
      }
    }
  } catch (e) {
    if (e instanceof ApiError) {
      // The server answered: nothing was broadcast unless it says so.
      throw new Error(e.message || "Failed to submit transaction. No fee was charged.");
    }
    // The request itself died — we cannot tell whether it reached the server.
    const status = await awaitOnChain(server, serviceHash);
    if (status === "success") {
      const feeHash = signedFeeXdr
        ? TransactionBuilder.fromXDR(signedFeeXdr, Networks.PUBLIC).hash().toString("hex")
        : null;
      return { serviceHash, feeHash, feeSubmitted: false };
    }
    if (status === "failed") throw new Error("Transaction failed on-chain. No fee was charged.");
    throw new Error(
      "Could not confirm submission. Check your activity in a minute — if nothing appears, it is safe to try again."
    );
  }

  if (!data?.success) throw new Error(data?.error || "Failed to submit transaction. No fee was charged.");

  if (data.servicePending && data.serviceHash) {
    const status = await awaitOnChain(server, data.serviceHash);
    if (status === "failed") throw new Error("Transaction failed on-chain. No fee was charged.");
    if (status === "not_found") {
      throw new Error(
        "Your transaction is taking longer than expected. Check your activity in a couple of minutes before trying again."
      );
    }
  }

  // Ledger-based "Done" (web recipe step 2): the success screen must not
  // appear before Horizon can show the transaction. Budget-bounded, never throws.
  await awaitTxVisible(data.serviceHash ?? serviceHash);

  return {
    serviceHash: data.serviceHash ?? serviceHash,
    feeHash: data.feeHash ?? null,
    feeSubmitted: !!data.feeSubmitted
  };
};

// ---------------------------------------------------------------------------
// Deposit / withdraw
// ---------------------------------------------------------------------------

/** Sign, retrying once if the OS passkey sheet fails to open right after the
 *  previous one (web: intermittent "timed out or was not allowed" on the
 *  second ceremony). A user cancel is never retried. */
const signWithRetry = async (params: Parameters<typeof signStellarXdrWithTurnkey>[0]): Promise<string> => {
  try {
    return await signStellarXdrWithTurnkey(params);
  } catch (e) {
    if (isUserCancelledError(e)) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    if (!/timed out|not allowed|TimedOut/i.test(msg)) throw e;
    await new Promise((r) => setTimeout(r, 600));
    return signStellarXdrWithTurnkey(params);
  }
};

export type DepositStep = "checking" | "deposit_sign" | "fee_sign" | "deposit_broadcast";
export type WithdrawStep = "withdraw_sign" | "commission_sign" | "withdraw_broadcast";

const buildRoute = async (path: string, body: unknown): Promise<string> => {
  const data = await apiFetch<{ success?: boolean; xdr?: string; error?: string }>(path, { body });
  if (!data?.xdr) throw new Error(data?.error || "The server did not return a transaction.");
  return data.xdr;
};

const buildFeeXdr = (caller: string, amount: number, serviceXdr: string) =>
  buildRoute("/api/fees/build-payment", {
    caller,
    amount: amount.toFixed(7),
    assetCode: "USDC",
    assetIssuer: MAINNET_USDC.issuer,
    sourceSequence: getTransactionSequence(serviceXdr),
    timeoutSeconds: FEE_PAIR_TIMEOUT_SECONDS
  });

export interface DepositParams {
  subOrgId: string;
  address: string;
  vaultAddress: string;
  /** Gross amount typed by the user; the 0.5% fee comes out of it. */
  amount: number;
  onStep?: (step: DepositStep) => void;
}

export const depositToSavings = async ({
  subOrgId,
  address,
  vaultAddress,
  amount,
  onStep
}: DepositParams): Promise<FeePairResult & { netAmount: number; feeAmount: number }> => {
  if (!(amount > 0)) throw new Error("Enter an amount.");
  const feeAmount = getSavingsDepositFee(amount);
  const netAmount = +(amount - feeAmount).toFixed(7);

  // Pre-flight: canonical USDC covers fee + net, and XLM can pay the Soroban fee.
  onStep?.("checking");
  const probe = await probeStellarAccount(address);
  if (!probe.exists) throw new Error("Your Stellar account isn’t active yet.");
  if (!probe.hasUsdcTrustline) throw new Error("Add the USDC trustline before depositing.");
  if (probe.usdcBalance < amount) {
    throw new Error(
      `Insufficient USDC: you have ${probe.usdcBalance.toFixed(2)} USDC but need ${amount.toFixed(2)} USDC (${feeAmount.toFixed(2)} fee + ${netAmount.toFixed(2)} deposit).`
    );
  }
  if (probe.feeStatus === "blocked") throw new Error("Not enough XLM to pay the network fee. Top up at least 0.5 XLM.");

  // 1. Deposit XDR for the NET amount (carries sequence N+1).
  const depositXdr = await buildRoute("/api/savings/deposit", { amount: netAmount.toFixed(7), caller: address });
  // 2. Fee payment chained directly behind it (N+2).
  const feeXdr = await buildFeeXdr(address, feeAmount, depositXdr);

  // 3. BOTH signatures before anything is submitted. One passkey client for
  //    both prompts so the credential list is fetched once.
  const client: TurnkeyClient = await createPasskeyClient();
  onStep?.("deposit_sign");
  const signedDeposit = await signWithRetry({ xdr: depositXdr, subOrgId, stellarAddress: address, client });
  onStep?.("fee_sign");
  const signedFee = await signWithRetry({ xdr: feeXdr, subOrgId, stellarAddress: address, client });

  // 4. Server funnel: record → escrow fee → submit deposit → collect fee.
  onStep?.("deposit_broadcast");
  const pair = await submitFeePair({
    signedServiceXdr: signedDeposit,
    signedFeeXdr: signedFee,
    kind: "savings_deposit",
    record: { vaultAddress, amount: netAmount.toFixed(7), feeAmount: feeAmount.toFixed(7) }
  });
  return { ...pair, netAmount, feeAmount };
};

export interface WithdrawParams {
  subOrgId: string;
  address: string;
  vaultAddress: string;
  amount: number;
  /** Snapshot taken BEFORE the action — drives the commission math. */
  position: SavingsPosition | null;
  onStep?: (step: WithdrawStep) => void;
}

export const withdrawFromSavings = async ({
  subOrgId,
  address,
  vaultAddress,
  amount,
  position,
  onStep
}: WithdrawParams): Promise<FeePairResult & { commissionAmount: number }> => {
  if (!(amount > 0)) throw new Error("Enter an amount.");
  const currentValue = parseFloat(position?.currentValue || "0");
  const earnings = parseFloat(position?.earnings || "0");
  if (amount > currentValue + 1e-7) throw new Error("That’s more than you have in savings.");
  const commissionAmount = getYieldCommission({ withdrawAmount: amount, currentValue, earnings });

  const probe = await probeStellarAccount(address);
  if (probe.feeStatus === "blocked") throw new Error("Not enough XLM to pay the network fee. Top up at least 0.5 XLM.");

  // 1. Withdraw XDR; the commission (when owed) chains behind it, so it can
  //    only apply after the withdrawal put USDC in the wallet.
  const withdrawXdr = await buildRoute("/api/savings/withdraw", { amount: amount.toFixed(7), caller: address });

  if (commissionAmount > 0) {
    const commissionXdr = await buildFeeXdr(address, commissionAmount, withdrawXdr);
    const client = await createPasskeyClient();
    onStep?.("withdraw_sign");
    const signedWithdraw = await signWithRetry({ xdr: withdrawXdr, subOrgId, stellarAddress: address, client });
    onStep?.("commission_sign");
    const signedCommission = await signWithRetry({ xdr: commissionXdr, subOrgId, stellarAddress: address, client });
    onStep?.("withdraw_broadcast");
    const pair = await submitFeePair({
      signedServiceXdr: signedWithdraw,
      signedFeeXdr: signedCommission,
      kind: "savings_withdraw",
      record: { vaultAddress, amount: amount.toFixed(7), feeAmount: commissionAmount.toFixed(7) }
    });
    return { ...pair, commissionAmount };
  }

  // No commission owed — one signature, but STILL through the server funnel (#27).
  onStep?.("withdraw_sign");
  const signedWithdraw = await signWithRetry({ xdr: withdrawXdr, subOrgId, stellarAddress: address });
  onStep?.("withdraw_broadcast");
  const single = await submitFeePair({
    signedServiceXdr: signedWithdraw,
    signedFeeXdr: null,
    kind: "savings_withdraw",
    record: { vaultAddress, amount: amount.toFixed(7), feeAmount: null }
  });
  return { ...single, commissionAmount: 0 };
};

/** Optimistic position after a deposit, from the PRE-action snapshot (an
 *  absolute target, never a delta on the live value — web double-count bug). */
export const positionAfterDeposit = (before: SavingsPosition | null, netAmount: number): SavingsPosition => {
  const base = before ?? ZERO_POSITION;
  return {
    ...base,
    currentValue: (parseFloat(base.currentValue) + netAmount).toFixed(7),
    totalDeposited: (parseFloat(base.totalDeposited) + netAmount).toFixed(7)
  };
};

export const positionAfterWithdraw = (before: SavingsPosition | null, amount: number): SavingsPosition => {
  const base = before ?? ZERO_POSITION;
  const cv = Math.max(parseFloat(base.currentValue) - amount, 0);
  const td = Math.max(parseFloat(base.totalDeposited) - amount, 0);
  return { ...base, currentValue: cv.toFixed(7), totalDeposited: td.toFixed(7), earnings: Math.max(cv - td, 0).toFixed(7) };
};

export { HORIZON_URL };

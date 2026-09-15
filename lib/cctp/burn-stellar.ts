// Outbound burn on Stellar — port of web lib/cctp/burn-stellar.ts:
// approve (skipped while a prior allowance covers it) + deposit_for_burn on
// Circle's TokenMessengerMinterV2, each a Soroban invocation prepared
// (simulated) BEFORE the passkey prompt, signed with the Turnkey Stellar
// signer, submitted to Soroban RPC and polled to SUCCESS.
//
// Custody: the destination recipient (the user's own Base address, 32-byte
// padded) is fixed inside the user-signed burn. destinationCaller = 0 (open
// execution). The relayer can only replay this message; it can never redirect.

import { Account, Address, Asset, Contract, Networks, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from "@stellar/stellar-sdk";

import { signWithRetry } from "@/lib/savings/engine";
import { CCTP_MAX_FEE, CCTP_MIN_FINALITY_THRESHOLD, SOROBAN_RPC_URL, STELLAR_CCTP, wireToStellar7 } from "./config";

const APPROVE_AMOUNT_7 = 10_000_000_000_000_000n; // ~$1B ceiling; transfer_from can't exceed the real balance
const APPROVE_EXPIRY_LEDGERS = 500_000; // ≈ 1 month

const server = () => new rpc.Server(SOROBAN_RPC_URL);

const readSacAllowance = async (s: rpc.Server, usdcSac: string, from: string, spender: string): Promise<bigint> => {
  try {
    const tx = new TransactionBuilder(new Account(from, "0"), {
      fee: "1000",
      networkPassphrase: Networks.PUBLIC,
      timebounds: { minTime: 0, maxTime: 0 }
    })
      .addOperation(new Contract(usdcSac).call("allowance", new Address(from).toScVal(), new Address(spender).toScVal()))
      .build();
    const sim = await s.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) return BigInt(scValToNative(sim.result.retval));
  } catch {
    /* treat as no allowance → approve */
  }
  return 0n;
};

export class StellarSubmitError extends Error {
  txHash?: string;
  mayStillLand = false;
}

const submitSigned = async (s: rpc.Server, signedXdr: string, label: string): Promise<string> => {
  const tx = TransactionBuilder.fromXDR(signedXdr, Networks.PUBLIC);
  const sent = await s.sendTransaction(tx);
  if (sent.status === "ERROR") throw new Error(`${label} submit failed: ${JSON.stringify(sent.errorResult ?? sent)}`);
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await s.getTransaction(sent.hash);
    if (res.status === "SUCCESS") return sent.hash;
    if (res.status === "FAILED") {
      const err = new StellarSubmitError(`${label} failed on-chain (${sent.hash})`);
      err.txHash = sent.hash;
      throw err;
    }
  }
  // May STILL land after the window — hand the hash back so the row keeps it.
  const err = new StellarSubmitError(`${label} timed out (${sent.hash})`);
  err.txHash = sent.hash;
  err.mayStillLand = true;
  throw err;
};

const invokeAsUser = async (p: {
  s: rpc.Server;
  subOrgId: string;
  source: string;
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  label: string;
  onSigning?: () => void;
}): Promise<string> => {
  const account = await p.s.getAccount(p.source);
  let tx = new TransactionBuilder(account, { fee: "10000000", networkPassphrase: Networks.PUBLIC })
    .addOperation(new Contract(p.contractId).call(p.method, ...p.args))
    .setTimeout(120)
    .build();
  // Simulation surfaces arg/balance errors BEFORE the passkey prompt.
  tx = await p.s.prepareTransaction(tx);
  p.onSigning?.();
  const signed = await signWithRetry({ xdr: tx.toXDR(), subOrgId: p.subOrgId, stellarAddress: p.source, networkPassphrase: Networks.PUBLIC });
  return submitSigned(p.s, signed, p.label);
};

export interface StellarBurnParams {
  subOrgId: string;
  stellarAddress: string;
  amountWire: bigint;
  destinationDomain: number;
  /** 32-byte mint recipient on the destination (evmAddressToBytes). */
  mintRecipient: Uint8Array;
  onStep?: (step: "approve" | "burn") => void;
  /** Fires right before EACH passkey prompt (never during prepare/simulate). */
  onSigning?: () => void;
}

/** approve (if needed) + deposit_for_burn. Returns both hashes. */
export const burnUsdcOnStellar = async (params: StellarBurnParams): Promise<{ approveTxHash: string; burnTxHash: string }> => {
  if (params.mintRecipient.length !== 32 || params.mintRecipient.every((b) => b === 0)) {
    throw new Error("refusing to burn: invalid mint recipient");
  }
  const s = server();
  const usdcSac = new Asset("USDC", STELLAR_CCTP.usdcIssuer).contractId(Networks.PUBLIC);
  const amount7 = wireToStellar7(params.amountWire);

  let approveTxHash = "skipped";
  const allowance = await readSacAllowance(s, usdcSac, params.stellarAddress, STELLAR_CCTP.tokenMessengerMinter);
  if (allowance < amount7) {
    params.onStep?.("approve");
    const { sequence } = await s.getLatestLedger();
    approveTxHash = await invokeAsUser({
      s,
      subOrgId: params.subOrgId,
      source: params.stellarAddress,
      contractId: usdcSac,
      method: "approve",
      args: [
        new Address(params.stellarAddress).toScVal(),
        new Address(STELLAR_CCTP.tokenMessengerMinter).toScVal(),
        nativeToScVal(APPROVE_AMOUNT_7, { type: "i128" }),
        nativeToScVal(sequence + APPROVE_EXPIRY_LEDGERS, { type: "u32" })
      ],
      label: "approve",
      onSigning: params.onSigning
    });
  }

  params.onStep?.("burn");
  const burnTxHash = await invokeAsUser({
    s,
    subOrgId: params.subOrgId,
    source: params.stellarAddress,
    contractId: STELLAR_CCTP.tokenMessengerMinter,
    method: "deposit_for_burn",
    args: [
      new Address(params.stellarAddress).toScVal(),
      nativeToScVal(amount7, { type: "i128" }),
      nativeToScVal(params.destinationDomain, { type: "u32" }),
      xdr.ScVal.scvBytes(Buffer.from(params.mintRecipient)),
      new Address(usdcSac).toScVal(),
      xdr.ScVal.scvBytes(Buffer.alloc(32)), // destinationCaller = 0 (open execution)
      nativeToScVal(CCTP_MAX_FEE, { type: "i128" }),
      nativeToScVal(CCTP_MIN_FINALITY_THRESHOLD, { type: "u32" })
    ],
    label: "deposit_for_burn",
    onSigning: params.onSigning
  });

  return { approveTxHash, burnTxHash };
};

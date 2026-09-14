// A signing test that moves nothing: build a real Stellar transaction for the
// user's account (a bumpSequence no-op), sign it through Turnkey with the
// passkey, verify the ed25519 signature locally against the public key, and
// never submit it. This proves rpId + associated domain + stamper + enclave
// signing end to end with zero risk.

import { Horizon, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

import { signStellarXdrWithTurnkey, verifyStellarSignature } from "./stellar-signer";

const HORIZON_URL =
  process.env.EXPO_PUBLIC_MAINNET_HORIZON_URL || "https://horizon.stellar.org";

export interface SignTestResult {
  ok: boolean;
  detail: string;
  signedXdrPreview?: string;
  ms: number;
}

export const runSignTest = async (subOrgId: string, stellarAddress: string): Promise<SignTestResult> => {
  const started = Date.now();

  // Read-only Horizon call: the account must exist on chain (funded) to have
  // a sequence number. Unfunded → explain, don't fail obscurely.
  const horizon = new Horizon.Server(HORIZON_URL);
  let account;
  try {
    account = await horizon.loadAccount(stellarAddress);
  } catch {
    return {
      ok: false,
      detail: "This Stellar account is not funded yet, so there is no sequence number to sign. Fund it with a little XLM first.",
      ms: Date.now() - started
    };
  }

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: Networks.PUBLIC
  })
    .addOperation(Operation.bumpSequence({ bumpTo: account.sequenceNumber() }))
    .setTimeout(60)
    .build();

  const signed = await signStellarXdrWithTurnkey({
    xdr: tx.toXDR(),
    subOrgId,
    stellarAddress,
    networkPassphrase: Networks.PUBLIC
  });

  const valid = verifyStellarSignature(signed, stellarAddress, Networks.PUBLIC);
  return {
    ok: valid,
    detail: valid
      ? "Turnkey signed with your passkey and the signature verifies against your Stellar public key. Nothing was submitted."
      : "Turnkey returned a signature but it does not verify against your address.",
    signedXdrPreview: `${signed.slice(0, 24)}…${signed.slice(-12)}`,
    ms: Date.now() - started
  };
};

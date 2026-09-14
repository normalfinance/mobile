// Ported from normal-v1-interface packages/web/src/lib/turnkey/stellar-signer.ts
// @ 6a403a8d (docs/web-agent-answers.md Q53) — byte-for-byte the same request.
//
// Turnkey has no native Stellar transaction type, so we hash the transaction
// locally (SHA-256 of the signature base — what Stellar actually signs) and
// have the enclave sign the digest raw with the ed25519 key. hashFunction must
// be HASH_FUNCTION_NOT_APPLICABLE for ed25519 per Turnkey's API. With quorum 1
// and a passkey stamp the activity is COMPLETED in the response — no polling.

import { Keypair, Networks, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import type { TurnkeyClient } from "@turnkey/http";

import { createPasskeyClient } from "./client";

export interface SignStellarParams {
  xdr: string;
  subOrgId: string;
  stellarAddress: string;
  /** Always pass explicitly; defaults to PUBLIC (mainnet-only app). */
  networkPassphrase?: string;
  /** Inject a client (tests / enrolment); default = passkey-stamped. */
  client?: TurnkeyClient;
}

export const signStellarXdrWithTurnkey = async ({
  xdr: xdrString,
  subOrgId,
  stellarAddress,
  networkPassphrase = Networks.PUBLIC,
  client
}: SignStellarParams): Promise<string> => {
  const tx = TransactionBuilder.fromXDR(xdrString, networkPassphrase);
  const payload = tx.hash().toString("hex");

  const turnkey = client ?? (await createPasskeyClient());
  const result = await turnkey.signRawPayload({
    type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
    timestampMs: String(Date.now()),
    organizationId: subOrgId,
    parameters: {
      signWith: stellarAddress,
      payload,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE"
    }
  });

  const sig = result?.activity?.result?.signRawPayloadResult;
  if (!sig?.r || !sig?.s) throw new Error("Turnkey signing failed — no signature returned");

  // ed25519 signature is r||s (64 bytes); v is unused
  const signature = Buffer.from(sig.r + sig.s, "hex");
  const hint = Keypair.fromPublicKey(stellarAddress).signatureHint();
  tx.signatures.push(new xdr.DecoratedSignature({ hint, signature }));

  return tx.toXDR();
};

/**
 * Local proof that a signed XDR carries a valid signature from `stellarAddress`
 * — lets us test the whole passkey → Turnkey → ed25519 path without
 * submitting anything to the network.
 */
export const verifyStellarSignature = (
  signedXdr: string,
  stellarAddress: string,
  networkPassphrase: string = Networks.PUBLIC
): boolean => {
  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  const hash = tx.hash();
  const keypair = Keypair.fromPublicKey(stellarAddress);
  return tx.signatures.some((s) => keypair.verify(hash, s.signature()));
};

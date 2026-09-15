// BTC send — port of web send-adapters/bitcoin.ts. The server builds the
// unsigned PSBT from mempool.space UTXOs (POST turnkey/build-btc-tx), Turnkey
// signs it via the passkey (SIGN_TRANSACTION_V2 / TRANSACTION_TYPE_BITCOIN),
// the server finalises + broadcasts (POST turnkey/broadcast-btc; idempotent by
// the pre-computed txid, so a retry can never double-spend). Hard rule 13:
// MAX = all UTXOs minus the sweep fee; hard rule 8 (LI.FI PSBTs) is separate.

import { apiFetch } from "@/lib/api";
import { createPasskeyClient } from "@/lib/turnkey/client";
import { signWithRetryEvm } from "./evm";
import { BTC_DUST_LIMIT_SAT, BTC_DUST_MESSAGE } from "./native-dust";

export const isValidBtcAddress = (a: string) =>
  /^bc1q[a-z0-9]{38,39}$/i.test(a) || /^bc1p[a-z0-9]{58}$/i.test(a) || /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(a);

interface BtcBuildResult {
  psbtHex: string;
  subOrgId: string;
  estimatedFeeSat: number;
  feeRateSatPerVbyte: number;
  changeAmountSat: number;
}

/** Live MAX: every UTXO minus the fee of the one-output sweep that spends them. */
export const btcMaxSend = async (address: string): Promise<string | null> => {
  const [utxoRes, feeRes] = await Promise.all([
    fetch(`https://mempool.space/api/address/${address}/utxo`),
    fetch("https://mempool.space/api/v1/fees/recommended")
  ]);
  if (!utxoRes.ok) return null;
  const utxos: Array<{ value: number }> = await utxoRes.json();
  if (!utxos.length) return null;
  const rate: number = feeRes.ok ? (await feeRes.json()).halfHourFee || 15 : 15;
  const totalSat = utxos.reduce((s, u) => s + u.value, 0);
  const n = utxos.length;
  const vsize = Math.ceil(((10 + n * 41 + 31) * 4 + (n * 107 + 2)) / 4); // P2WPKH sweep, one output
  const maxSat = totalSat - Math.ceil(rate * vsize);
  if (maxSat <= BTC_DUST_LIMIT_SAT) return null;
  return (maxSat / 1e8).toFixed(8);
};

/** Fee preview for the confirm sheet (the same builder call, unsigned). */
export const btcBuild = (destination: string, amountSat: number) =>
  apiFetch<BtcBuildResult>("/api/turnkey/build-btc-tx", { body: { destination, amountSat } });

export const sendBtc = async ({
  from,
  to,
  amount,
  onStep
}: {
  from: string;
  to: string;
  amount: number;
  onStep?: (s: "checking" | "building" | "signing" | "submitting") => void;
}): Promise<string> => {
  if (!isValidBtcAddress(to)) throw new Error("Enter a valid Bitcoin address (bc1…).");
  const amountSat = Math.round(amount * 1e8);
  if (!amountSat || amountSat <= 0) throw new Error("Enter an amount.");
  if (amountSat <= BTC_DUST_LIMIT_SAT) throw new Error(BTC_DUST_MESSAGE);

  onStep?.("building");
  const { psbtHex, subOrgId } = await btcBuild(to, amountSat);

  onStep?.("signing");
  const turnkey = await createPasskeyClient();
  const signedPsbt = await signWithRetryEvm(() =>
    turnkey.signTransaction({
      type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
      timestampMs: String(Date.now()),
      organizationId: subOrgId,
      parameters: { signWith: from, unsignedTransaction: psbtHex, type: "TRANSACTION_TYPE_BITCOIN" }
    })
  );

  onStep?.("submitting");
  const data = await apiFetch<{ txid?: string; error?: string }>("/api/turnkey/broadcast-btc", {
    body: { signedTxHex: signedPsbt }
  });
  if (!data?.txid) throw new Error(data?.error || "Broadcast failed. Please try again.");
  return data.txid;
};

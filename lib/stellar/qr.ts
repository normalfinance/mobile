// What a scanned Stellar QR code can contain, decoded into send-form fields.
// Both Normal clients (web receive-modal.tsx, our ReceiveSheet) encode the bare
// G-address. Exchanges and other wallets commonly encode a SEP-0007 pay URI:
//   web+stellar:pay?destination=G…&memo=12345&memo_type=MEMO_ID&amount=1.5&asset_code=USDC
// or a plain `stellar:G…` prefix. Anything else is rejected — never guess an
// address out of arbitrary text.

import { isValidStellarAddress } from "./send";

export interface ScannedStellarPayment {
  destination: string;
  memo?: string;
  amount?: string;
  assetCode?: string;
}

const ADDRESS_RE = /^G[A-Z2-7]{55}$/;

export const parseStellarQr = (raw: string): ScannedStellarPayment | { error: string } => {
  const text = raw.trim();
  if (!text) return { error: "Empty QR code." };

  // 1. Bare address (what Normal itself shows).
  const bare = text.toUpperCase();
  if (ADDRESS_RE.test(bare)) {
    return isValidStellarAddress(bare) ? { destination: bare } : { error: "That QR code holds an invalid Stellar address." };
  }

  // 2. `stellar:G…` (some wallets), optionally with a query string.
  // 3. SEP-0007 `web+stellar:pay?…`.
  const m = /^(?:web\+stellar:pay\?|stellar:)(.*)$/i.exec(text);
  if (!m) return { error: "That QR code is not a Stellar address." };
  let body = m[1];
  let destination: string | undefined;
  if (!body.includes("=")) {
    destination = body.split("?")[0].toUpperCase();
    body = body.includes("?") ? body.slice(body.indexOf("?") + 1) : "";
  }
  const params = new URLSearchParams(body);
  destination = (destination ?? params.get("destination") ?? "").toUpperCase();
  if (!isValidStellarAddress(destination)) return { error: "That QR code holds an invalid Stellar address." };

  const result: ScannedStellarPayment = { destination };
  const memoType = (params.get("memo_type") ?? "MEMO_TEXT").toUpperCase();
  const memo = params.get("memo");
  if (memo) {
    if (memoType === "MEMO_TEXT" || memoType === "MEMO_ID") result.memo = memo;
    else return { error: `This QR code uses a ${memoType.replace("MEMO_", "").toLowerCase()} memo, which Normal doesn’t support yet.` };
  }
  const amount = params.get("amount");
  if (amount && /^\d+(\.\d+)?$/.test(amount) && Number(amount) > 0) result.amount = amount;
  const assetCode = params.get("asset_code");
  if (assetCode) result.assetCode = assetCode.toUpperCase();
  return result;
};

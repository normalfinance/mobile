// Turnkey clients. Signing goes straight from the phone to api.turnkey.com,
// stamped by a passkey (Face ID) — exactly as web does with its WebAuthn
// stamper (Q26). A second, short-lived client stamped by an on-device API
// key exists only for device enrolment (lib/turnkey/enroll.ts).

import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { PasskeyStamper } from "@turnkey/react-native-passkey-stamper";

import { TURNKEY_BASE_URL, resolveRpId } from "./config";
import { fetchCredentials, toAllowCredentials } from "./credentials";

/**
 * A client whose requests are stamped by one of THIS account's passkeys.
 * If the credential list cannot be fetched, the prompt is unrestricted rather
 * than blocked — a lookup failure must never prevent signing (web does the same).
 */
export const createPasskeyClient = async (): Promise<TurnkeyClient> => {
  let allowCredentials: ReturnType<typeof toAllowCredentials> = [];
  try {
    const { credentials } = await fetchCredentials();
    allowCredentials = toAllowCredentials(credentials);
  } catch {
    allowCredentials = [];
  }

  const stamper = new PasskeyStamper({
    rpId: resolveRpId(),
    ...(allowCredentials.length ? { allowCredentials } : {})
  });
  return new TurnkeyClient({ baseUrl: TURNKEY_BASE_URL }, stamper);
};

/** A client stamped by a temporary on-device API key (enrolment session). */
export const createSessionClient = (keyPair: {
  publicKey: string;
  privateKey: string;
}): TurnkeyClient =>
  new TurnkeyClient(
    { baseUrl: TURNKEY_BASE_URL },
    new ApiKeyStamper({ apiPublicKey: keyPair.publicKey, apiPrivateKey: keyPair.privateKey })
  );

// ---------------------------------------------------------------------------
// Error classification (react-native-passkey error names)
// ---------------------------------------------------------------------------

const errorName = (e: unknown): string =>
  (e && typeof e === "object" && "error" in e && typeof (e as { error: unknown }).error === "string"
    ? (e as { error: string }).error
    : "") || (e instanceof Error ? e.name : "");

const errorMessage = (e: unknown): string =>
  (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
    ? (e as { message: string }).message
    : "") || (e instanceof Error ? e.message : String(e));

/** iOS found no passkey for this rpId (or none matching allowCredentials). */
export const isNoPasskeyError = (e: unknown): boolean => errorName(e) === "NoCredentials";

export const isUserCancelledError = (e: unknown): boolean =>
  errorName(e) === "UserCancelled";

/** Turnkey error 16: the chosen passkey is not registered on this sub-org. */
export const isForeignPasskeyError = (e: unknown): boolean =>
  /credential ID could not be found/i.test(errorMessage(e));

/** Something a person can act on (web: passkey-stamper.ts error mapper). */
export const describeTurnkeyError = (e: unknown): string => {
  if (isNoPasskeyError(e)) return "No passkey for your wallet is available on this phone.";
  if (isUserCancelledError(e)) return "Face ID was cancelled.";
  if (isForeignPasskeyError(e))
    return "That passkey belongs to a different Normal account. Choose the one for this login.";
  const name = errorName(e);
  if (name === "NotSupported") return "Passkeys are not supported on this device.";
  if (name === "TimedOut") return "The passkey request timed out. Try again.";
  return errorMessage(e) || "Something went wrong with the passkey.";
};

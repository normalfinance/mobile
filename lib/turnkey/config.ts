// Turnkey facts shared by every flow. Mirrors web:
//   rpId  — packages/web/src/lib/turnkey/passkey-stamper.ts resolveRpId()
//           `||` not `??`: a defined-but-blank env var must fall back, never
//           hand WebAuthn an empty rpId. The rpId a passkey is REGISTERED
//           under must be byte-identical to the one it is later ASKED for.
//   base  — hardcoded https://api.turnkey.com in every web client (Q24).

export const TURNKEY_BASE_URL = "https://api.turnkey.com";

export const RP_NAME = "Normal Finance";

export const resolveRpId = (): string =>
  process.env.EXPO_PUBLIC_TURNKEY_RP_ID || "normalfinance.io";

/** Human label Turnkey shows for a passkey created on this phone. */
export const AUTHENTICATOR_NAME = "Normal iPhone passkey";

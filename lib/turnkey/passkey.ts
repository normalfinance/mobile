// Create a passkey on this phone for a Normal user. Parameters mirror web's
// passkey.ts:45-61 (docs/web-agent-answers.md Q55) so the credential list on
// the sub-org stays consistent: rp.id = normalfinance.io, rp.name = "Normal
// Finance", user.id = the Supabase uid bytes, name/displayName = email.
//
// The returned object is exactly the body POST /api/turnkey/wallet expects
// (Q52) and exactly the `authenticators[]` entry CREATE_AUTHENTICATORS_V2
// expects — pass it through untouched.

import { Platform } from "react-native";
import {
  createPasskey,
  isSupported,
  type TurnkeyAuthenticatorParams
} from "@turnkey/react-native-passkey-stamper";

import { AUTHENTICATOR_NAME, RP_NAME, resolveRpId } from "./config";

/** react-native-passkey decodes user.id as base64url (Passkey.swift:45). */
const toBase64Url = (s: string): string =>
  Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const passkeysSupported = (): boolean => isSupported();

export const registerPasskey = async (user: {
  id: string;
  email?: string | null;
}): Promise<TurnkeyAuthenticatorParams> => {
  if (!isSupported()) {
    throw new Error("Passkeys are not supported on this device.");
  }

  return createPasskey(
    {
      rp: { id: resolveRpId(), name: RP_NAME },
      user: {
        id: toBase64Url(user.id),
        name: user.email ?? user.id,
        displayName: user.email ?? "Normal User"
      },
      authenticatorName: `${AUTHENTICATOR_NAME} (${Platform.OS})`,
      timeout: 60_000,
      attestation: "direct",
      authenticatorSelection: {
        residentKey: "preferred",
        requireResidentKey: false,
        userVerification: "preferred"
      }
    },
    // Platform authenticator = Face ID / iCloud Keychain, never a security key.
    { withPlatformKey: true, withSecurityKey: false }
  );
};

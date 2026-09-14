// This account's registered passkeys, from GET /api/turnkey/credentials
// (docs/web-agent-answers.md Q51). Restricting the OS prompt to these ids is
// not cosmetic: an unrestricted prompt offers EVERY normalfinance.io passkey
// on the device, and picking one from another account fails after Face ID
// with Turnkey error 16. Transports are load-bearing too (Q51).
//
// Ids arrive base64url (what web sent at registration) and react-native-
// passkey decodes allowCredentials ids as base64url, so they pass through.

import type { PublicKeyCredentialDescriptor } from "@turnkey/react-native-passkey-stamper";

import { apiFetch } from "@/lib/api";

export interface PasskeyCredential {
  id: string;
  transports: string[];
}

export interface CredentialsInfo {
  credentials: PasskeyCredential[];
  subOrgId: string | null;
  /** Root user id — present once the web adds it to the route; else whoami. */
  userId: string | null;
}

interface CredentialsResponse {
  success: boolean;
  credentials?: { id: string; transports?: string[] }[];
  credentialIds?: string[];
  subOrgId?: string;
  userId?: string;
  error?: string;
}

const CACHE_TTL_MS = 60_000;
let cached: { info: CredentialsInfo; at: number } | null = null;

export const invalidateCredentials = () => {
  cached = null;
};

export const fetchCredentials = async (): Promise<CredentialsInfo> => {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.info;

  const data = await apiFetch<CredentialsResponse>("/api/turnkey/credentials");
  const credentials: PasskeyCredential[] = (
    data.credentials ??
    (data.credentialIds ?? []).map((id) => ({ id, transports: [] as string[] }))
  ).map((c) => ({ id: c.id, transports: c.transports ?? [] }));

  const info: CredentialsInfo = {
    credentials,
    subOrgId: data.subOrgId ?? null,
    userId: data.userId ?? null
  };
  cached = { info, at: Date.now() };
  return info;
};

/** WebAuthn descriptors for the stamper; empty list = unrestricted prompt. */
export const toAllowCredentials = (
  credentials: PasskeyCredential[]
): PublicKeyCredentialDescriptor[] =>
  credentials.map((c) => ({
    type: "public-key",
    id: c.id,
    ...(c.transports.length
      ? { transports: c.transports as PublicKeyCredentialDescriptor["transports"] }
      : {})
  }));

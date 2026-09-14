// Device enrolment by email code (Turnkey OTP: INIT_OTP_V3 → VERIFY_OTP_V2 →
// OTP_LOGIN_V2), approved by Justin 2026-09-14. A signed-in user whose
// passkey lives on another device gets a 15-minute Turnkey session bound to a
// key generated here, uses it for exactly one thing — CREATE_AUTHENTICATORS_V2
// for this phone's new passkey — and throws it away. Signing stays
// passkey-per-transaction.
//
// Backend contract (web repo, agreed 2026-09-14; all withAuth, `error` on failure):
//   POST /api/turnkey/enroll/init     {}                                         → { otpId, otpEncryptionTargetBundle }
//   POST /api/turnkey/enroll/verify   { otpId, encryptedOtpBundle }               → { verificationToken }
//   POST /api/turnkey/enroll/login    { verificationToken, publicKey, clientSignature } → { session, subOrgId, userId }
//   POST /api/turnkey/enroll/complete { authenticatorId, deviceName }              → { ok }
//
// Facts from the installed SDK / Turnkey source:
//   - VERIFY_OTP_V2 has no plaintext code: the phone encrypts it to the enclave's
//     otpEncryptionTargetBundle with @turnkey/crypto encryptOtpCodeToBundle, binding
//     its own P-256 public key.
//   - OTP_LOGIN_V2 requires clientSignature = { publicKey, scheme
//     "CLIENT_SIGNATURE_SCHEME_API_P256", message, signature } where message is
//     JSON.stringify({ login: { publicKey }, tokenId: <verification JWT "id" claim>,
//     type: "USAGE_TYPE_LOGIN" }) — tkhq/sdk packages/core/src/utils.ts
//     getClientSignatureMessageForLogin — signed by the session private key with
//     the API-key stamper's signWithApiKey (same routine that signs X-Stamp).

import { Platform } from "react-native";
import { signWithApiKey } from "@turnkey/api-key-stamper";
import { encryptOtpCodeToBundle, generateP256KeyPair } from "@turnkey/crypto";

import { apiFetch } from "@/lib/api";
import { createSessionClient } from "./client";
import { invalidateCredentials } from "./credentials";
import { registerPasskey } from "./passkey";

interface InitResponse {
  otpId: string;
  otpEncryptionTargetBundle: string;
}
interface VerifyResponse {
  verificationToken: string;
}
interface LoginResponse {
  session: string;
  subOrgId: string;
  userId?: string;
}

export interface Enrollment {
  otpId: string;
  otpEncryptionTargetBundle: string;
}

export type EnrollmentStep =
  | "verifying-code"
  | "logging-in"
  | "creating-passkey"
  | "attaching-passkey"
  | "finishing";

/** Payload claim of a JWT, without verifying it (Turnkey verifies; we only need `id`). */
const jwtClaims = (jwt: string): Record<string, unknown> => {
  const part = jwt.split(".")[1] ?? "";
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
};

export const startEnrollment = async (): Promise<Enrollment> => {
  const data = await apiFetch<InitResponse>("/api/turnkey/enroll/init", { body: {} });
  if (!data?.otpId || !data?.otpEncryptionTargetBundle) {
    throw new Error("The server did not start a verification.");
  }
  return { otpId: data.otpId, otpEncryptionTargetBundle: data.otpEncryptionTargetBundle };
};

export const completeEnrollment = async (
  enrollment: Enrollment,
  otpCode: string,
  user: { id: string; email?: string | null },
  onStep?: (step: EnrollmentStep) => void
): Promise<{ authenticatorId: string }> => {
  // 1. A fresh P-256 key pair; its public key becomes the session's identity.
  const keyPair = generateP256KeyPair();

  // 2. Prove the code — encrypted to the enclave, bound to our public key.
  onStep?.("verifying-code");
  const encryptedOtpBundle = await encryptOtpCodeToBundle(
    otpCode.trim(),
    enrollment.otpEncryptionTargetBundle,
    keyPair.publicKey
  );
  const { verificationToken } = await apiFetch<VerifyResponse>("/api/turnkey/enroll/verify", {
    body: { otpId: enrollment.otpId, encryptedOtpBundle }
  });
  if (!verificationToken) throw new Error("Verification did not return a token.");

  // 3. Log in: prove we hold the private key for the public key being registered.
  onStep?.("logging-in");
  const tokenId = String(jwtClaims(verificationToken).id ?? "");
  if (!tokenId) throw new Error("Verification token has no id.");
  const message = JSON.stringify({
    login: { publicKey: keyPair.publicKey },
    tokenId,
    type: "USAGE_TYPE_LOGIN"
  });
  const signature = await signWithApiKey({
    content: message,
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey
  });
  const login = await apiFetch<LoginResponse>("/api/turnkey/enroll/login", {
    body: {
      verificationToken,
      publicKey: keyPair.publicKey,
      clientSignature: {
        publicKey: keyPair.publicKey,
        scheme: "CLIENT_SIGNATURE_SCHEME_API_P256",
        message,
        signature
      }
    }
  });
  if (!login?.subOrgId) throw new Error("Login did not return a wallet.");

  const session = createSessionClient(keyPair);
  let userId = login.userId ?? null;
  if (!userId) {
    const who = await session.getWhoami({ organizationId: login.subOrgId });
    userId = who.userId;
  }

  // 4. Face ID: create this phone's passkey (iCloud Keychain), then attach it
  //    to the user with the session — the only thing the session ever does.
  onStep?.("creating-passkey");
  const authenticator = await registerPasskey(user);

  onStep?.("attaching-passkey");
  const result = await session.createAuthenticators({
    type: "ACTIVITY_TYPE_CREATE_AUTHENTICATORS_V2",
    timestampMs: String(Date.now()),
    organizationId: login.subOrgId,
    parameters: { userId, authenticators: [authenticator] }
  });
  const authenticatorId =
    result?.activity?.result?.createAuthenticatorsResult?.authenticatorIds?.[0];
  if (!authenticatorId) throw new Error("Turnkey did not attach the new passkey.");

  // 5. Tell the backend (audit row + guardrail email). Non-fatal: the passkey is live.
  onStep?.("finishing");
  await apiFetch("/api/turnkey/enroll/complete", {
    body: {
      authenticatorId,
      deviceName: `${Platform.OS === "ios" ? "iPhone" : "Android"} passkey`
    }
  }).catch(() => undefined);

  invalidateCredentials();
  return { authenticatorId };
};

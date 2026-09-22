// Email auth against Supabase — both of the web's modes (auth-login-modal.tsx,
// onboarding-wizard.tsx): the 6-digit code (signInWithOtp → verifyOtp) and
// password (signUp → the same confirmation code; signInWithPassword; reset by
// email). Supabase captcha protection is on, so every email request carries a
// Turnstile token; a cancelled check resolves to `cancelled` (no alert).

import { supabase } from "@/lib/supabase";
import { CaptchaCancelled, requestCaptchaToken } from "@/lib/auth/captcha";

export const MIN_PASSWORD = 8;
/** The web's reset page handles the PASSWORD_RECOVERY link (src/app/auth/reset-password). */
const RESET_PASSWORD_URL = "https://www.normalfinance.io/auth/reset-password";

export type CodeKind = "email" | "signup";
export type Outcome = "ok" | "cancelled";

const captcha = async (): Promise<string | null> => {
  try {
    return await requestCaptchaToken();
  } catch (e) {
    if (e instanceof CaptchaCancelled) return null;
    throw e;
  }
};

export const normalizeEmail = (v: string) => v.trim().toLowerCase();
export const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(v));

/** Email a sign-in code (creates the account if new). */
export const sendSignInCode = async (email: string): Promise<Outcome> => {
  const captchaToken = await captcha();
  if (!captchaToken) return "cancelled";
  const { error } = await supabase.auth.signInWithOtp({ email: normalizeEmail(email), options: { shouldCreateUser: true, captchaToken } });
  if (error) throw error;
  return "ok";
};

/** Create an account with a password. `signedIn` when confirmations are off; otherwise a code was emailed. */
export const createAccount = async (email: string, password: string): Promise<Outcome | "signedIn"> => {
  const captchaToken = await captcha();
  if (!captchaToken) return "cancelled";
  const { data, error } = await supabase.auth.signUp({ email: normalizeEmail(email), password, options: { captchaToken } });
  if (error) throw error;
  return data.session ? "signedIn" : "ok";
};

export const signInWithPassword = async (email: string, password: string): Promise<Outcome> => {
  const captchaToken = await captcha();
  if (!captchaToken) return "cancelled";
  const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password, options: { captchaToken } });
  if (error) throw error;
  return "ok";
};

export const sendPasswordReset = async (email: string): Promise<Outcome> => {
  const captchaToken = await captcha();
  if (!captchaToken) return "cancelled";
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo: RESET_PASSWORD_URL, captchaToken });
  if (error) throw error;
  return "ok";
};

/** Verify the 6-digit code. A sign-up code is 'signup' per the docs; some projects accept it as 'email' — try both. */
export const verifyCode = async (email: string, code: string, kind: CodeKind): Promise<void> => {
  const em = normalizeEmail(email);
  let { data, error } = await supabase.auth.verifyOtp({ email: em, token: code, type: kind });
  if (error && kind === "signup") ({ data, error } = await supabase.auth.verifyOtp({ email: em, token: code, type: "email" }));
  if (error) throw error;
  if (!data.session) throw new Error("We couldn’t verify your session. Request a new code.");
};

/** What to say when Supabase rejects a sign-in — its messages are terse. */
export const friendlyAuthError = (e: unknown, fallback: string): string => {
  const m = e instanceof Error ? e.message : "";
  if (/invalid login credentials/i.test(m)) return "That email and password don’t match.";
  if (/email not confirmed/i.test(m)) return "Confirm your email first — we’ll send you a new code.";
  if (/user already registered/i.test(m)) return "There’s already an account for this email. Sign in instead.";
  if (/rate limit|too many/i.test(m)) return "Too many attempts — wait a minute and try again.";
  if (/token has expired|invalid|otp/i.test(m)) return "That code is wrong or has expired. Request a new one.";
  return m || fallback;
};

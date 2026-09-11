// The one place the app talks to the Normal backend (the Next.js API routes).
// Rules here come from docs/web-agent-answers.md Q1, Q7, Q8, Q13:
//   - auth is the Bearer header only; there is no cookie session
//   - always send `Cookie: normal-network=mainnet` (testnet is discontinued,
//     and anything but the exact string "mainnet" falls back to testnet server-side)
//   - never send `x-mobile-app` (unconditional middleware bypass)
//   - 401 → refresh the Supabase session once, retry once, then give up and
//     announce `session-expired`; 403 is "not your resource", never retried
//   - `error` is the only reliable key in an error body; `success` may be absent

import { supabase } from "@/lib/supabase";
import { getCachedSession } from "@/providers/supabase-auth-provider";

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!BASE_URL) {
  throw new Error("Missing EXPO_PUBLIC_API_BASE_URL environment variable");
}

export const API_BASE_URL = BASE_URL.replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly path: string;

  constructor(status: number, message: string, path: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

type SessionListener = () => void;
const sessionExpiredListeners = new Set<SessionListener>();

/** Mirrors the web's `nf:session-expired` window event (authed-fetch.ts). */
export const onSessionExpired = (listener: SessionListener) => {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
};

let lastSessionExpiredAt = 0;
const announceSessionExpired = () => {
  const now = Date.now();
  if (now - lastSessionExpiredAt < 5_000) return; // debounced like web
  lastSessionExpiredAt = now;
  sessionExpiredListeners.forEach((listener) => listener());
};

const getAccessToken = async (): Promise<string | null> => {
  const cached = getCachedSession()?.access_token;
  if (cached) return cached;
  const {
    data: { session }
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
};

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Query string values; `undefined` entries are dropped. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Extra headers; they override the defaults. */
  headers?: Record<string, string>;
  /** Routes that are public (no Bearer). Defaults to false. */
  anonymous?: boolean;
}

const buildUrl = (path: string, query?: ApiRequestOptions["query"]) => {
  const url = new URL(
    path.startsWith("/") ? `${API_BASE_URL}${path}` : `${API_BASE_URL}/${path}`
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
};

const readErrorMessage = (body: unknown, fallback: string): string => {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error?: unknown }).error;
    if (typeof err === "string" && err.trim()) return err;
  }
  return fallback;
};

const performRequest = async (
  path: string,
  options: ApiRequestOptions,
  token: string | null
): Promise<Response> => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Cookie: "normal-network=mainnet",
    ...(options.body !== undefined
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {})
  };

  return fetch(buildUrl(path, options.query), {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
};

/**
 * Call a backend route and return its parsed JSON body.
 * Throws `ApiError` for any non-2xx response, with `status` and the server's
 * `error` string as the message.
 */
export const apiFetch = async <T = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> => {
  let token = options.anonymous ? null : await getAccessToken();
  let response = await performRequest(path, options, token);

  if (response.status === 401 && !options.anonymous) {
    // Refresh once and retry once — exactly what web's authedFetch does.
    const { data } = await supabase.auth.refreshSession();
    token = data.session?.access_token ?? null;
    if (token) {
      response = await performRequest(path, options, token);
    }
    if (response.status === 401) {
      announceSessionExpired();
    }
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      readErrorMessage(body, `${response.status} ${response.statusText}`),
      path,
      body
    );
  }

  return body as T;
};

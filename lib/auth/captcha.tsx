// Supabase captcha protection is ON for the Normal project (confirmed live
// 2026-09-14: signInWithOtp → "captcha protection: request disallowed (no
// captcha_token found)"). OAuth is exempt; email flows are not. Web renders a
// Cloudflare Turnstile widget and passes its token as `captchaToken`
// (web src/services/auth.ts:80). Turnstile only runs on an allow-listed
// domain, so the app loads a tiny page hosted by the web app in a WebView and
// receives the token by postMessage.
//
// Usage: mount <CaptchaProvider> once (root layout); anywhere in the tree,
// `await requestCaptchaToken()` shows the sheet and resolves with a token, or
// rejects with CaptchaCancelled / CaptchaFailed.

import React from "react";
import { ActivityIndicator, Modal } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { XStack, YStack } from "tamagui";
import { X } from "lucide-react-native";

import { IconButton, UiText } from "@/components/home/primitives";
import { API_BASE_URL } from "@/lib/api";
import { useAppearance, useColors } from "@/lib/theme/appearance";
import { radius, space } from "@/lib/theme/tokens";

/** Hosted by the web app; path agreed with the web repo 2026-09-14. */
export const TURNSTILE_PATH = "/turnstile";

export class CaptchaCancelled extends Error {
  constructor() {
    super("Verification was cancelled.");
    this.name = "CaptchaCancelled";
  }
}
/** Cloudflare's own codes, as the hosted page forwards them (`error:<code>`). */
const CAPTCHA_REASONS: Record<string, string> = {
  "error:110200": "this app's domain is not on the Turnstile allow-list (Cloudflare 110200)",
  expired: "the check expired — try again",
  timeout: "the check timed out — try again",
  "missing-site-key": "the server has no Turnstile site key configured",
  "error:110100": "the Turnstile site key is invalid (Cloudflare 110100)",
  "not-loaded": "the check did not load in time — check your connection and try again"
};

export class CaptchaFailed extends Error {
  constructor(reason?: string) {
    const human = reason ? CAPTCHA_REASONS[reason] ?? reason : null;
    super(human ? `Verification failed: ${human}.` : "Verification failed. Please try again.");
    this.name = "CaptchaFailed";
  }
}

type Pending = { resolve: (token: string) => void; reject: (e: Error) => void };

let opener: ((p: Pending) => void) | null = null;

/** Show the captcha sheet and resolve with a Turnstile token. */
export const requestCaptchaToken = (): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!opener) {
      reject(new CaptchaFailed("captcha provider not mounted"));
      return;
    }
    opener({ resolve, reject });
  });

type TurnstileMessage =
  | { type: "turnstile"; token: string }
  | { type: "turnstile-error"; reason?: string };

export const CaptchaProvider = ({ children }: { children: React.ReactNode }) => {
  const c = useColors();
  const { scheme } = useAppearance();
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    opener = (p) => {
      setLoaded(false);
      setPending(p);
    };
    return () => {
      opener = null;
    };
  }, []);

  const close = React.useCallback(() => {
    setPending(null);
    setLoaded(false);
  }, []);

  // Watchdog: a page that never renders the widget (bad site key, blocked
  // script, offline) must reject, never hang the sheet (live 2026-09-21).
  React.useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => {
      pending.reject(new CaptchaFailed("not-loaded"));
      close();
    }, 25_000);
    return () => clearTimeout(t);
  }, [pending, close]);

  const onMessage = (event: WebViewMessageEvent) => {
    if (!pending) return;
    let msg: TurnstileMessage | null = null;
    try {
      msg = JSON.parse(event.nativeEvent.data) as TurnstileMessage;
    } catch {
      return; // not ours
    }
    if (msg?.type === "turnstile" && typeof msg.token === "string" && msg.token) {
      pending.resolve(msg.token);
      close();
    } else if (msg?.type === "turnstile-error") {
      pending.reject(new CaptchaFailed(msg.reason));
      close();
    }
  };

  const cancel = () => {
    pending?.reject(new CaptchaCancelled());
    close();
  };

  const uri = `${API_BASE_URL}${TURNSTILE_PATH}?theme=${scheme}`;

  return (
    <>
      {children}
      <Modal visible={!!pending} transparent animationType='fade' onRequestClose={cancel}>
        <YStack flex={1} justifyContent='flex-end' backgroundColor='rgba(10,10,15,0.45)'>
          <YStack
            backgroundColor={c.surface}
            borderTopLeftRadius={radius.dialog}
            borderTopRightRadius={radius.dialog}
            padding={space.gutter}
            paddingBottom={32}
            gap={12}
          >
            <XStack justifyContent='space-between' alignItems='center'>
              <UiText fontSize={16} fontWeight='600'>
                Quick check
              </UiText>
              <IconButton onPress={cancel} label='Cancel'>
                <X size={20} color={c.muted} strokeWidth={2} />
              </IconButton>
            </XStack>
            <UiText fontSize={13} color={c.muted}>
              Confirming you’re not a robot. This usually takes a second.
            </UiText>
            <YStack
              height={140}
              borderRadius={radius.input}
              overflow='hidden'
              backgroundColor={c.inputBg}
              justifyContent='center'
            >
              {pending ? (
                <WebView
                  source={{ uri }}
                  onMessage={onMessage}
                  onLoadEnd={() => setLoaded(true)}
                  onError={(e) => {
                    pending.reject(new CaptchaFailed(e.nativeEvent.description));
                    close();
                  }}
                  javaScriptEnabled
                  // Page-side exceptions (e.g. turnstile.render throwing on a bad key) become a reason we can show.
                  injectedJavaScriptBeforeContentLoaded={`window.onerror = function (m) { try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'turnstile-error', reason: 'page: ' + m })); } catch (e) {} }; true;`}
                  originWhitelist={["https://*"]}
                  style={{ backgroundColor: "transparent", opacity: loaded ? 1 : 0 }}
                  containerStyle={{ backgroundColor: "transparent" }}
                  scrollEnabled={false}
                  bounces={false}
                />
              ) : null}
              {!loaded ? (
                <YStack position='absolute' left={0} right={0} top={0} bottom={0} justifyContent='center'>
                  <ActivityIndicator color={c.muted} />
                </YStack>
              ) : null}
            </YStack>
          </YStack>
        </YStack>
      </Modal>
    </>
  );
};

// Notifications — two layers.
//   LOCAL (this file, no provider): the app fires its own notification when
//   something it is tracking settles — a swap delivered, a refund, a send
//   confirmed — but ONLY while the app is not in the foreground (the screen
//   already shows it there). iOS suspends JS shortly after backgrounding, so
//   this covers "I switched away for a moment", not "the bridge finished 20
//   minutes later"; that case is REMOTE push, sent by the backend.
//   REMOTE: the device token (APNs on iOS, FCM on Android) is registered with
//   POST /api/push/register so the server can push for CCTP / LI.FI outcomes
//   (contract agreed with the web side 2026-09-16). Android real push needs a
//   Firebase project (google-services.json) — until then FCM tokens are
//   unavailable there and only local notifications fire.
//
// Android: a channel is mandatory on 8+; without it nothing shows.

import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import { ApiError, apiFetch } from "@/lib/api";
import { onSendsSettled } from "@/lib/send/pending-sends";
import { onRunSettled, type RunState } from "@/lib/swap/run-store";

const CHANNEL_ID = "money";
const DECLINED_KEY = "notifications_declined_v1";
const TOKEN_KEY = "push_token_registered_v1";

let configured = false;
/** Once per process: how a notification behaves when it arrives. */
export const configureNotifications = () => {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false
    })
  });
  if (Platform.OS === "android") {
    void Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Money movements",
      description: "Swaps, refunds and sends as they settle",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 120],
      lightColor: "#0A0A0F"
    }).catch(() => undefined);
  }
  wireSettledEvents();
};

export type NotificationPermission = "granted" | "denied" | "undetermined";

export const getNotificationPermission = async (): Promise<NotificationPermission> => {
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
  } catch {
    return "undetermined";
  }
};

/** Ask once, from a user action (Settings, or the first money action). */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  try {
    const p = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
    const state: NotificationPermission = p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
    if (!p.granted) await AsyncStorage.setItem(DECLINED_KEY, String(Date.now())).catch(() => undefined);
    else void registerPushToken();
    return state;
  } catch {
    return "undetermined";
  }
};

/** Offer the OS prompt before a money action, once (web-style "asked once"). */
export const maybeAskForNotifications = async (): Promise<void> => {
  if ((await getNotificationPermission()) !== "undetermined") return;
  if ((await AsyncStorage.getItem(DECLINED_KEY).catch(() => null)) != null) return;
  await requestNotificationPermission();
};

// --- local -----------------------------------------------------------------
const inForeground = () => AppState.currentState === "active";

/** Fire a local notification unless the app is on screen. */
export const notifyIfBackground = async (n: { title: string; body: string; data?: Record<string, string> }) => {
  if (inForeground()) return;
  if ((await getNotificationPermission()) !== "granted") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: n.title, body: n.body, data: n.data ?? {}, sound: false, ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}) },
      trigger: null
    });
  } catch {
    /* never let a notification break a money flow */
  }
};

const settledCopy = (run: RunState): { title: string; body: string } | null => {
  const { spec } = run;
  const pair = `${spec.from} → ${spec.to}`;
  if (run.status === "done") {
    if (spec.kind === "cctp-out" && run.result?.verdict !== "DONE") return { title: `${spec.to} is on its way`, body: `Your ${pair} swap left Base — ${spec.to} arrives at your wallet shortly.` };
    return { title: "Swap complete", body: `${pair}: ${spec.to} is in your wallet.` };
  }
  if (run.status === "calm") {
    if (run.refundedStage) return { title: "Swap refunded", body: `${pair} could not complete — your ${spec.kind === "cctp-out" ? "USDC" : spec.from} is being returned. No funds were lost.` };
    return null; // "still on its way" — not worth a buzz
  }
  if (run.status === "error" && run.broadcastStarted) return { title: "Swap needs attention", body: `${pair} did not finish — open Swap → In flight to continue.` };
  return null;
};

let wired = false;
const wireSettledEvents = () => {
  if (wired) return;
  wired = true;
  onRunSettled((run) => {
    const copy = settledCopy(run);
    if (copy) void notifyIfBackground({ ...copy, data: run.transferId ? { type: "cctp", transferId: run.transferId } : { type: "run", runId: run.id } });
  });
  onSendsSettled((sends) => {
    for (const s of sends) void notifyIfBackground({ title: "Send confirmed", body: `${s.amount} ${s.symbol} reached ${s.destination.slice(0, 6)}…${s.destination.slice(-4)}.`, data: { type: "send", txHash: s.txHash } });
  });
};

// --- remote token -------------------------------------------------------------
/** Register this device's APNs / FCM token with the backend — once per app
 *  process, every cold start (a re-register also clears a provider-side
 *  disable, server contract 2026-09-16); tolerant of the route not existing. */
let registeredThisProcess = false;
export const registerPushToken = async (): Promise<void> => {
  try {
    if (registeredThisProcess) return;
    if ((await getNotificationPermission()) !== "granted") return;
    const { data: token, type } = await Notifications.getDevicePushTokenAsync();
    if (typeof token !== "string" || !token) return;
    const key = `${type}:${token}`;
    // appVariant = which APNs HOST the token belongs to, decided by how the
    // build was SIGNED: Xcode debug builds (__DEV__) use the sandbox host;
    // TestFlight and App Store builds use production even when they feel like
    // test builds. Reporting "dev" for a TestFlight build = BadDeviceToken
    // forever (web agent, 2026-09-16). Android/FCM has no such split.
    const appVariant = Platform.OS === "ios" && __DEV__ ? "dev" : "prod";
    await apiFetch("/api/push/register", {
      body: { token, platform: Platform.OS, deviceName: `${Platform.OS === "ios" ? "iPhone" : "Android"}`, appVariant }
    });
    registeredThisProcess = true;
    await AsyncStorage.setItem(TOKEN_KEY, key).catch(() => undefined);
  } catch (e) {
    // 404/405 = the backend route isn't deployed yet; anything else is non-fatal too.
    if (!(e instanceof ApiError)) return;
  }
};

export const unregisterPushToken = async (): Promise<void> => {
  try {
    const key = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
    if (!key) return;
    const token = key.slice(key.indexOf(":") + 1);
    await apiFetch("/api/push/unregister", { body: { token } }).catch(() => undefined);
    await AsyncStorage.removeItem(TOKEN_KEY).catch(() => undefined);
  } catch {
    /* best effort */
  }
};

// --- taps ----------------------------------------------------------------------
/** Route a tapped notification to the thing it is about. Call once at startup. */
export const listenForNotificationTaps = (): (() => void) => {
  const open = (data: Record<string, unknown> | undefined) => {
    if (!data) return;
    if (data.type === "cctp" && typeof data.transferId === "string") router.push({ pathname: "/swap-run", params: { transferId: data.transferId } });
    else if (data.type === "run" && typeof data.runId === "string") router.push({ pathname: "/swap-run", params: { runId: data.runId } });
    else router.push("/(tabs)/assets"); // lifi / send → the Activity feed
  };
  const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data as Record<string, unknown>));
  void Notifications.getLastNotificationResponseAsync().then((r) => r && open(r.notification.request.content.data as Record<string, unknown>)).catch(() => undefined);
  return () => sub.remove();
};

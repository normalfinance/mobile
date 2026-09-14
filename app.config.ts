// Dynamic Expo config on top of app.json.
//
// Identity is decided here (docs/web-agent-answers.md D-bundle-ids, live in
// https://normalfinance.io/.well-known/apple-app-site-association):
//   APP_VARIANT=production → io.normalfinance.app      (App Store)
//   anything else          → io.normalfinance.app.dev  (dev + staging builds)
// Both are registered under Apple Team FA938A596N (Normal Finance, Inc.).
//
// The associated domain is what lets iOS offer normalfinance.io passkeys to
// this app. No `?mode=developer` suffix: Apple's CDN already serves our
// apple-app-site-association (verified 2026-09-14), and developer mode only
// bypasses the CDN for servers the public internet cannot reach — at the
// price that "users must opt-in on any device they use" (Settings →
// Developer → Associated Domains Development). Live failure without that
// opt-in: "Application with identifier … is not associated with domain".

import type { ConfigContext, ExpoConfig } from "expo/config";

const IS_PRODUCTION = process.env.APP_VARIANT === "production";

export const BUNDLE_ID = IS_PRODUCTION ? "io.normalfinance.app" : "io.normalfinance.app.dev";
export const APPLE_TEAM_ID = "FA938A596N";
export const PASSKEY_RP_ID = "normalfinance.io";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_PRODUCTION ? "Normal" : "Normal (dev)",
  slug: config.slug ?? "normal",
  // Settings → Appearance → System needs the OS to report its scheme.
  userInterfaceStyle: "automatic",
  ios: {
    ...config.ios,
    bundleIdentifier: BUNDLE_ID,
    appleTeamId: APPLE_TEAM_ID,
    associatedDomains: [`webcredentials:${PASSKEY_RP_ID}`]
  },
  android: {
    ...config.android,
    package: "io.normalfinance.app"
  }
});

// App entry. The polyfills MUST be evaluated before any route module:
// expo-router requires every file under app/ at startup, and libraries such
// as @noble/hashes (via @turnkey/crypto and stellar-sdk) capture
// globalThis.crypto at module-load time. Importing the shim from
// app/_layout.tsx is too late for routes that happen to load first (live
// failure 2026-09-14: "crypto.getRandomValues must be defined").
import "./shim";
import "expo-router/entry";

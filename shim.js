// Modern React Native polyfill setup for Node.js modules
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { getRandomValues } from "expo-crypto";

// Global polyfills
if (typeof __dirname === "undefined") global.__dirname = "/";
if (typeof __filename === "undefined") global.__filename = "";

// Process polyfill
if (typeof process === "undefined") {
  global.process = require("process");
} else {
  const bProcess = require("process");
  for (var p in bProcess) {
    if (!(p in process)) {
      process[p] = bProcess[p];
    }
  }
}

process.browser = false;
if (typeof global.process !== "undefined" && !global.process.version) {
  global.process.version = "v16.0.0";
}

// Buffer polyfill
if (typeof Buffer === "undefined") {
  global.Buffer = require("buffer").Buffer;
}

// Location polyfill for web compatibility
if (typeof global.location === "undefined") {
  global.location = { protocol: "file:" };
}

// Environment setup
const isDev = typeof __DEV__ === "boolean" && __DEV__;
process.env["NODE_ENV"] = isDev ? "development" : "production";
process.env["TAMAGUI_USE_NATIVE_PORTAL"] = "false";

if (typeof localStorage !== "undefined") {
  localStorage.debug = isDev ? "*" : "";
}

// Crypto polyfill using expo-crypto
if (typeof global.crypto === "undefined") {
  global.crypto = {
    getRandomValues: getRandomValues,
    // Add other crypto methods as needed
    randomUUID: () => {
      // Simple UUID v4 implementation using getRandomValues
      const bytes = getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

      const hex = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0")
      ).join("");
      return `${hex.substr(0, 8)}-${hex.substr(8, 4)}-${hex.substr(
        12,
        4
      )}-${hex.substr(16, 4)}-${hex.substr(20, 12)}`;
    }
  };
}

// Ensure crypto.getRandomValues is available on the global object for BIP39
if (typeof global.crypto?.getRandomValues === "undefined") {
  if (typeof global.crypto === "undefined") {
    global.crypto = {};
  }
  global.crypto.getRandomValues = getRandomValues;
}

// Also ensure it's available on the crypto module
if (typeof require !== "undefined") {
  try {
    const crypto = require("crypto-browserify");
    if (typeof crypto.getRandomValues === "undefined") {
      crypto.getRandomValues = getRandomValues;
    }
  } catch (e) {
    // crypto-browserify not available, create a minimal crypto module
    const mockCrypto = {
      getRandomValues: getRandomValues,
      randomBytes: (size) => {
        const bytes = getRandomValues(new Uint8Array(size));
        return Buffer.from(bytes);
      }
    };
    require.cache["crypto"] = { exports: mockCrypto };
  }
}

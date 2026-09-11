// Light / dark / system appearance, chosen in Settings and remembered on the
// device. Exposes the active palette so components never hardcode a scheme.

import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { useColorScheme } from "react-native";

import { ink, inkDark, type Palette } from "./tokens";

export type AppearanceMode = "light" | "dark" | "system";
export type ColorScheme = "light" | "dark";

const STORAGE_KEY = "appearance_mode";

interface AppearanceContextValue {
  mode: AppearanceMode;
  scheme: ColorScheme;
  colors: Palette;
  setMode: (mode: AppearanceMode) => void;
  isReady: boolean;
}

const AppearanceContext = React.createContext<AppearanceContextValue | null>(null);

const isMode = (v: unknown): v is AppearanceMode =>
  v === "light" || v === "dark" || v === "system";

export const AppearanceProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = React.useState<AppearanceMode>("light");
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && isMode(stored)) setModeState(stored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = React.useCallback((next: AppearanceMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const scheme: ColorScheme =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  const value = React.useMemo<AppearanceContextValue>(
    () => ({
      mode,
      scheme,
      colors: scheme === "dark" ? inkDark : ink,
      setMode,
      isReady
    }),
    [mode, scheme, setMode, isReady]
  );

  return (
    <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
  );
};

export const useAppearance = (): AppearanceContextValue => {
  const ctx = React.useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearance must be used inside <AppearanceProvider>");
  }
  return ctx;
};

/** The active palette. Components use this instead of importing `ink`. */
export const useColors = (): Palette => useAppearance().colors;

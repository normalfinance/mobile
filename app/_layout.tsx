// Initialize Node.js polyfills - MUST be first import
import "../shim";

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { PortalProvider, TamaguiProvider, Theme } from "tamagui";
import tamaguiConfig from "../tamagui.config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/hooks/useToast";
import { SupabaseAuthProvider } from "@/providers/supabase-auth-provider";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { loadFonts } from "@/lib/fonts";
import { AppearanceProvider, useAppearance } from "@/lib/theme/appearance";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

export const unstable_settings = {
  anchor: "(tabs)"
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000 // 5 minutes
    },
    mutations: {
      retry: 1
    }
  }
});

SplashScreen.preventAutoHideAsync();

// Everything below the appearance provider re-renders with the chosen scheme:
// Tamagui theme, React Navigation colours (screen backgrounds during
// transitions) and the status bar.
function ThemedApp() {
  const { scheme, colors } = useAppearance();

  const navTheme = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...navTheme,
    colors: {
      ...navTheme.colors,
      background: colors.surface,
      card: colors.surface,
      text: colors.ink,
      border: colors.border,
      primary: colors.ink
    }
  };

  return (
    <Theme name={scheme}>
      <NavigationThemeProvider value={navigationTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surface }
          }}
        >
          <Stack.Screen name='(tabs)' options={{ animation: "none" }} />
          <Stack.Screen name='(auth)' />
          <Stack.Screen name='auth/callback' />
          <Stack.Screen name='create-wallet' />
          <Stack.Screen name='wallet-setup' />
          <Stack.Screen name='verify-magic-link' options={{ presentation: "modal" }} />
        </Stack>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      </NavigationThemeProvider>
    </Theme>
  );
}

export default function RootLayout() {
  useEffect(() => {
    loadFonts().then(() => {
      SplashScreen.hideAsync();
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AppearanceProvider>
          <TamaguiProvider config={tamaguiConfig} defaultTheme='light'>
            <PortalProvider>
              <BottomSheetModalProvider>
                <ToastProvider>
                  <SupabaseAuthProvider>
                    <ThemedApp />
                  </SupabaseAuthProvider>
                </ToastProvider>
              </BottomSheetModalProvider>
            </PortalProvider>
          </TamaguiProvider>
        </AppearanceProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

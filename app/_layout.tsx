// Initialize Node.js polyfills - MUST be first import
import "../shim";

import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { TamaguiProvider, PortalProvider } from "tamagui";
import tamaguiConfig from "../tamagui.config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/hooks/useToast";
import { SupabaseAuthProvider } from "@/providers/supabase-auth-provider";

import { loadFonts } from "@/lib/fonts";
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

export default function RootLayout() {
  useEffect(() => {
    loadFonts().then(() => {
      SplashScreen.hideAsync();
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme='light'>
        <PortalProvider>
          <ToastProvider>
            <SupabaseAuthProvider>
              <ThemeProvider value={DefaultTheme}>
                <Stack>
                  <Stack.Screen
                    name='(tabs)'
                    options={{ headerShown: false, animation: "none" }}
                  />
                  <Stack.Screen
                    name='onboarding'
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name='(auth)'
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name='auth/callback'
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name='wallet-setup'
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name='verify-magic-link'
                    options={{ headerShown: false, presentation: "modal" }}
                  />
                  <Stack.Screen
                    name='modal'
                    options={{ presentation: "modal", title: "Modal" }}
                  />
                </Stack>
                <StatusBar style='auto' />
              </ThemeProvider>
            </SupabaseAuthProvider>
          </ToastProvider>
        </PortalProvider>
      </TamaguiProvider>
    </QueryClientProvider>
  );
}

// Initialize Node.js polyfills - MUST be first import
import '../shim';

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider
} from "@react-navigation/native";
import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { TamaguiProvider, createTamagui } from "@tamagui/core";
import { PortalProvider } from "tamagui";
import { defaultConfig } from "@tamagui/config/v4";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from "@/hooks/useToast";

import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "(tabs)"
};

const config = createTamagui(defaultConfig);

type Conf = typeof config;

declare module "@tamagui/core" {
  interface TamaguiCustomConfig extends Conf {}
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <TamaguiProvider config={config}>
        <PortalProvider>
          <ToastProvider>
            <ClerkProvider
              tokenCache={tokenCache}
              publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
            >
              <ThemeProvider
                value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
              >
              <Stack>
                <Stack.Screen name='(tabs)' options={{ headerShown: false }} />
                <Stack.Screen name='(auth)' options={{ headerShown: false }} />
                <Stack.Screen
                  name='wallet-setup'
                  options={{ headerShown: false, presentation: "modal" }}
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
            </ClerkProvider>
          </ToastProvider>
        </PortalProvider>
      </TamaguiProvider>
    </QueryClientProvider>
  );
}

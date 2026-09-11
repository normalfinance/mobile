import * as Font from "expo-font";

// Satoshi (Fontshare, ITF Free Font License) for UI — the same family the web
// app loads from api.fontshare.com. Web uses weights 400/500/600/700; Satoshi
// has no static 600, so tamagui.config.ts maps 600 → Bold.
// Geist Mono (Vercel, SIL OFL — see assets/fonts/geist-mono/LICENSE.txt) for
// every number, amount and address, matching the drawer's MONO style.
export const loadFonts = async () => {
  await Font.loadAsync({
    "Satoshi-Regular": require("../assets/fonts/satoshi/Satoshi-Regular.otf"),
    "Satoshi-Medium": require("../assets/fonts/satoshi/Satoshi-Medium.otf"),
    "Satoshi-Bold": require("../assets/fonts/satoshi/Satoshi-Bold.otf"),

    "GeistMono-Regular": require("../assets/fonts/geist-mono/GeistMono-Regular.ttf"),
    "GeistMono-Medium": require("../assets/fonts/geist-mono/GeistMono-Medium.ttf"),
    "GeistMono-Bold": require("../assets/fonts/geist-mono/GeistMono-Bold.ttf")
  });
};

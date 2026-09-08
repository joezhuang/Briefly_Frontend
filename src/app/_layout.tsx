import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { BrieflyAuthProvider } from "@/context/auth";
import { LanguageProvider } from "@/context/language";
import { SavedArticlesProvider } from "@/context/saved-articles";
import {
  BrieflyThemeProvider,
  useBrieflyTheme,
} from "@/context/theme";

SplashScreen.preventAutoHideAsync();

function AppStack() {
  const { resolvedMode } = useBrieflyTheme();

  return (
    <>
      <StatusBar style={resolvedMode === "dark" ? "light" : "dark"} />
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="saved/index" />
        <Stack.Screen name="saved/[snapshotId]" />
        <Stack.Screen name="search" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="story/[slug]" />
        <Stack.Screen name="share/[versionId]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <BrieflyThemeProvider>
        <BrieflyAuthProvider>
          <SavedArticlesProvider>
            <AppStack />
          </SavedArticlesProvider>
        </BrieflyAuthProvider>
      </BrieflyThemeProvider>
    </LanguageProvider>
  );
}

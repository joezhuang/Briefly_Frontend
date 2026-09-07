import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { LanguageProvider } from "@/context/language";
import { SavedArticlesProvider } from "@/context/saved-articles";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <LanguageProvider>
      <SavedArticlesProvider>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="saved/index" />
          <Stack.Screen name="saved/[snapshotId]" />
          <Stack.Screen name="search" />
          <Stack.Screen name="story/[slug]" />
          <Stack.Screen name="share/[versionId]" />
        </Stack>
      </SavedArticlesProvider>
    </LanguageProvider>
  );
}

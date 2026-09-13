import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { PropsWithChildren, useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { GlobalPodcastPlayer } from "@/components/global-podcast-player";
import { AnalysisReadinessProvider } from "@/context/analysis-readiness";
import { BrieflyAuthProvider } from "@/context/auth";
import { LanguageProvider } from "@/context/language";
import { PodcastPlayerProvider } from "@/context/podcast-player";
import { ReadingHistoryProvider } from "@/context/reading-history";
import { SavedArticlesProvider } from "@/context/saved-articles";
import {
  BrieflyThemeProvider,
  useBrieflyTheme,
} from "@/context/theme";

SplashScreen.preventAutoHideAsync();

const LANGUAGE_STORAGE_KEY = "briefly.language.v1";

function systemBrieflyLanguage() {
  const locale = getLocales()[0];
  const languageCode = locale?.languageCode?.toLowerCase();
  const languageTag = locale?.languageTag?.toLowerCase() ?? "";

  if (languageCode === "es") return "es";
  if (languageCode === "ja") return "ja";
  if (languageCode === "zh") {
    const traditional =
      languageTag.includes("hant") ||
      languageTag.includes("-tw") ||
      languageTag.includes("-hk") ||
      languageTag.includes("-mo");
    return traditional ? "zh-TW" : "zh-CN";
  }

  return "en";
}

function SystemLocaleGate({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const initializeLanguage = async () => {
      try {
        const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (!stored) {
          await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, systemBrieflyLanguage());
        }
      } finally {
        if (active) setReady(true);
      }
    };

    void initializeLanguage();
    return () => {
      active = false;
    };
  }, []);

  return ready ? children : null;
}

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
        <Stack.Screen name="history" />
        <Stack.Screen name="search" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="upgrade" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="story/[slug]" />
        <Stack.Screen name="share/[versionId]" />
      </Stack>
      <GlobalPodcastPlayer />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SystemLocaleGate>
        <LanguageProvider>
          <BrieflyThemeProvider>
            <BrieflyAuthProvider>
              <PodcastPlayerProvider>
                <AnalysisReadinessProvider>
                  <ReadingHistoryProvider>
                    <SavedArticlesProvider>
                      <AppStack />
                    </SavedArticlesProvider>
                  </ReadingHistoryProvider>
                </AnalysisReadinessProvider>
              </PodcastPlayerProvider>
            </BrieflyAuthProvider>
          </BrieflyThemeProvider>
        </LanguageProvider>
      </SystemLocaleGate>
    </SafeAreaProvider>
  );
}

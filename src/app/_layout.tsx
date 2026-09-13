import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocales } from "expo-localization";
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
const AUTO_LANGUAGE_STORAGE_KEY = "briefly.language.auto.v1";

type SupportedLanguage = "en" | "es" | "ja" | "zh-CN" | "zh-TW";

type SystemLocale = {
  languageCode?: string | null;
  languageTag?: string | null;
};

function systemBrieflyLanguage(locale?: SystemLocale): SupportedLanguage {
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
  const locales = useLocales();
  const detectedLanguage = systemBrieflyLanguage(locales[0]);
  const [ready, setReady] = useState(false);
  const [languageRevision, setLanguageRevision] = useState(0);

  useEffect(() => {
    let active = true;

    const syncSystemLanguage = async () => {
      try {
        const [storedLanguage, lastAutomaticLanguage] = await Promise.all([
          AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
          AsyncStorage.getItem(AUTO_LANGUAGE_STORAGE_KEY),
        ]);

        // Migration from the first locale implementation: if there is no
        // auto marker yet, treat the existing stored language as the previous
        // automatic value. A later explicit language selection will make the
        // two values differ and therefore becomes a manual override.
        const previousAutomaticLanguage =
          lastAutomaticLanguage ?? storedLanguage ?? detectedLanguage;

        const followsSystem =
          !storedLanguage || storedLanguage === previousAutomaticLanguage;

        if (followsSystem) {
          const changed = storedLanguage !== detectedLanguage;
          await AsyncStorage.multiSet([
            [LANGUAGE_STORAGE_KEY, detectedLanguage],
            [AUTO_LANGUAGE_STORAGE_KEY, detectedLanguage],
          ]);

          if (active && changed && ready) {
            // LanguageProvider reads AsyncStorage when it mounts. Remount the
            // subtree after a live system-language change so the UI updates.
            setLanguageRevision((value) => value + 1);
          }
        }
      } finally {
        if (active) setReady(true);
      }
    };

    void syncSystemLanguage();
    return () => {
      active = false;
    };
  }, [detectedLanguage, ready]);

  if (!ready) return null;

  return <React.Fragment key={languageRevision}>{children}</React.Fragment>;
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

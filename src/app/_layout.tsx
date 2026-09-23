import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocales } from "expo-localization";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { Fragment, PropsWithChildren, useEffect, useRef, useState } from "react";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";

import { trackProductEvent } from "@/analytics/product-analytics";
import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { GlobalPodcastPlayer } from "@/components/global-podcast-player";
import { ScreenState } from "@/components/screen-state";
import { AnalysisReadinessProvider } from "@/context/analysis-readiness";
import { BrieflyAuthProvider, useBrieflyAuth } from "@/context/auth";
import {
  BrieflyAppConfigProvider,
  useBrieflyAppConfig,
} from "@/context/app-config";
import { LanguageProvider } from "@/context/language";
import { PodcastPlayerProvider } from "@/context/podcast-player";
import { ReadingHistoryProvider } from "@/context/reading-history";
import { SavedArticlesProvider } from "@/context/saved-articles";
import { installGlobalErrorMonitoring } from "@/monitoring/error-monitoring";
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

  return <Fragment key={languageRevision}>{children}</Fragment>;
}

function ProductAnalyticsSession() {
  const { ready } = useBrieflyAuth();
  const tracked = useRef(false);

  useEffect(() => {
    if (!ready || tracked.current) return;
    tracked.current = true;
    trackProductEvent("session_start", {
      properties: { entry: "app" },
    });
  }, [ready]);

  return null;
}

function AppStack() {
  const pathname = usePathname();
  const { resolvedMode, colors } = useBrieflyTheme();
  const { config: appConfig } = useBrieflyAppConfig();
  const maintenanceAllowed =
    pathname.startsWith("/beta-dashboard") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/upgrade") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/legal");

  if (appConfig?.maintenance_mode && !maintenanceAllowed) {
    return (
      <>
        <StatusBar style={resolvedMode === "dark" ? "light" : "dark"} />
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <ScreenState
            title="Briefly is temporarily unavailable"
            message={
              appConfig.maintenance_message ??
              "We are carrying out a short maintenance update. Please try again soon."
            }
          />
        </SafeAreaView>
      </>
    );
  }

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
        <Stack.Screen name="beta-dashboard" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="upgrade" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="story/[slug]" />
        <Stack.Screen name="share/[versionId]" />
      </Stack>
      {appConfig?.podcast_enabled !== false && <GlobalPodcastPlayer />}
    </>
  );
}

export default function RootLayout() {
  useEffect(() => installGlobalErrorMonitoring(), []);

  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
      <SystemLocaleGate>
        <LanguageProvider>
          <BrieflyThemeProvider>
            <BrieflyAuthProvider>
              <BrieflyAppConfigProvider>
                <ProductAnalyticsSession />
                <PodcastPlayerProvider>
                  <AnalysisReadinessProvider>
                    <ReadingHistoryProvider>
                      <SavedArticlesProvider>
                        <AppStack />
                      </SavedArticlesProvider>
                    </ReadingHistoryProvider>
                  </AnalysisReadinessProvider>
                </PodcastPlayerProvider>
              </BrieflyAppConfigProvider>
            </BrieflyAuthProvider>
          </BrieflyThemeProvider>
        </LanguageProvider>
      </SystemLocaleGate>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

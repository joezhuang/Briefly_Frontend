import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

type SharedAppChoiceProps = {
  appPath: string;
  uiLanguage?: string | null;
  contentLanguage?: string | null;
  readingLanguage?: string | null;
};

type MobilePlatform = "ios" | "android" | "desktop";
const ANDROID_PACKAGE = "com.hybridgalaxy.briefly";
// The package is verified in app.json and Google Play; the store page may
// require a tester account while Briefly is in closed testing.
const ANDROID_DEFAULT_STORE_URL =
  `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

function trustedStoreUrl(value: string | undefined, store: "ios" | "android") {
  if (!value?.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (store === "ios" && url.hostname !== "apps.apple.com") ||
      (store === "android" && url.hostname !== "play.google.com")
    ) return "";
    return url.toString();
  } catch {
    return "";
  }
}

const IOS_APP_URL = trustedStoreUrl(
  process.env.EXPO_PUBLIC_BRIEFLY_IOS_APP_URL,
  "ios",
);
const ANDROID_APP_URL = trustedStoreUrl(
  process.env.EXPO_PUBLIC_BRIEFLY_ANDROID_APP_URL,
  "android",
) || ANDROID_DEFAULT_STORE_URL;

/** Chrome handles missing Android apps via S.browser_fallback_url. */
function androidAppIntent(appUrl: string, storeUrl: string) {
  return (
    `intent://${appUrl.slice("briefly://".length)}` +
    `#Intent;scheme=briefly;package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(storeUrl)};end`
  );
}

const copy = {
  en: {
    title: "Read this story your way",
    body: "Keep reading on the web, or open it in the Briefly app. Installation is optional.",
    open: "Open Briefly app",
    installIos: "Get the iPhone app",
    installAndroid: "Get the Android app",
    continue: "Continue on web",
    unavailable: "The App Store link is not configured yet. You can continue reading on the web.",
  },
  es: {
    title: "Lee esta noticia como prefieras",
    body: "Sigue leyendo en la web o ábrela en la app Briefly. Instalarla es opcional.",
    open: "Abrir la app Briefly",
    installIos: "Obtener la app para iPhone",
    installAndroid: "Obtener la app para Android",
    continue: "Continuar en la web",
    unavailable: "El enlace de App Store aún no está configurado. Puedes seguir leyendo en la web.",
  },
  ja: {
    title: "お好きな方法でニュースを読む",
    body: "Webでそのまま読むか、Brieflyアプリで開けます。インストールは任意です。",
    open: "Brieflyアプリで開く",
    installIos: "iPhoneアプリを入手",
    installAndroid: "Androidアプリを入手",
    continue: "Webで続きを読む",
    unavailable: "App Store のリンクはまだ設定されていません。Web でそのまま読めます。",
  },
  "zh-CN": {
    title: "选择阅读方式",
    body: "可以继续在网页阅读，也可以用 Briefly 应用打开。无需强制安装。",
    open: "在 Briefly 应用中打开",
    installIos: "下载 iPhone 版",
    installAndroid: "下载 Android 版",
    continue: "继续网页版",
    unavailable: "尚未配置 App Store 链接，你可以继续在网页版阅读。",
  },
  "zh-TW": {
    title: "選擇閱讀方式",
    body: "可以繼續在網頁閱讀，也可以用 Briefly 應用程式開啟。不必強制安裝。",
    open: "在 Briefly 應用程式中開啟",
    installIos: "下載 iPhone 版",
    installAndroid: "下載 Android 版",
    continue: "繼續網頁版",
    unavailable: "尚未設定 App Store 連結，你可以繼續在網頁版閱讀。",
  },
} as const;

function mobilePlatform(): MobilePlatform {
  if (typeof navigator === "undefined") return "desktop";
  const agent = navigator.userAgent ?? "";
  if (/android/i.test(agent)) return "android";
  if (/iPhone|iPad|iPod/i.test(agent)) return "ios";
  if (
    /Macintosh/i.test(agent) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  ) {
    return "ios";
  }
  return "desktop";
}

function safeNativeHref({ appPath, uiLanguage, contentLanguage, readingLanguage }: SharedAppChoiceProps) {
  // Only the known story and immutable-version routes may launch the app.
  if (!/^\/(?:s\/[0-9a-f-]{36}|share\/[0-9]+)$/i.test(appPath)) return null;
  const params = new URLSearchParams();
  const languages = ["en", "es", "ja", "zh-CN", "zh-TW"];
  if (uiLanguage && languages.includes(uiLanguage)) params.set("ui", uiLanguage);
  if (contentLanguage && languages.includes(contentLanguage)) {
    params.set("content", contentLanguage);
  }
  if (readingLanguage && /^[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(readingLanguage)) {
    params.set("read", readingLanguage);
  }
  const suffix = params.toString();
  return `briefly:///${appPath.slice(1)}${suffix ? `?${suffix}` : ""}`;
}

export function SharedAppChoice(props: SharedAppChoiceProps) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const [dismissed, setDismissed] = useState(false);
  const [storeUnavailable, setStoreUnavailable] = useState(false);
  const pendingLaunchCleanup = useRef<(() => void) | null>(null);
  const platform = mobilePlatform();
  const text = copy[language] ?? copy.en;
  const appUrl = safeNativeHref(props);
  const storeUrl = platform === "ios" ? IOS_APP_URL : ANDROID_APP_URL;
  const storeText = platform === "ios" ? text.installIos : text.installAndroid;

  // Cancel a pending fallback when this component unmounts or is dismissed.
  useEffect(() => () => pendingLaunchCleanup.current?.(), []);

  const openInAppOrStore = () => {
    if (!appUrl || typeof window === "undefined") return;

    pendingLaunchCleanup.current?.();

    // Chrome's Intent URI opens the installed app or redirects to Google Play
    // if the app isn't available. This must be triggered by a real tap.
    if (
      platform === "android" &&
      /(?:Chrome|Chromium|EdgA)\//i.test(navigator.userAgent)
    ) {
      window.location.assign(androidAppIntent(appUrl, storeUrl));
      return;
    }

    // Safari has no dependable "is this app installed?" browser API.
    // Try the existing Briefly URL scheme; if this tab never becomes hidden,
    // offer the App Store (or the Play Store on non-Chrome Android browsers).
    // A store link must be exact; never guess an Apple App Store item ID.
    let leftPage = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      if (pendingLaunchCleanup.current === cleanup) {
        pendingLaunchCleanup.current = null;
      }
    };
    const onPageHide = () => {
      leftPage = true;
      cleanup();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        leftPage = true;
        cleanup();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    pendingLaunchCleanup.current = cleanup;
    timer = window.setTimeout(() => {
      cleanup();
      if (leftPage || document.visibilityState !== "visible") return;
      if (storeUrl) window.location.assign(storeUrl);
      else setStoreUnavailable(true);
    }, 1600);

    try {
      window.location.assign(appUrl);
    } catch {
      cleanup();
      if (storeUrl) window.location.assign(storeUrl);
      else setStoreUnavailable(true);
    }
  };

  if (dismissed || platform === "desktop" || !appUrl) return null;

  return (
    <View
      accessibilityLabel={text.title}
      style={[styles.container, { backgroundColor: colors.surfaceMuted, borderBottomColor: colors.border }]}
    >
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>{text.title}</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{text.body}</Text>
      </View>
      {storeUnavailable && (
        <Text style={[styles.body, { color: colors.textMuted }]}>
          {text.unavailable}
        </Text>
      )}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={openInAppOrStore}
          style={[styles.primaryButton, { backgroundColor: colors.text }]}
        >
          <Text style={[styles.primaryText, { color: colors.background }]}>{text.open}</Text>
        </Pressable>
        {!!storeUrl && (
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(storeUrl).catch(() => undefined)}
            style={[styles.secondaryButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.secondaryText, { color: colors.text }]}>{storeText}</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => setDismissed(true)}
          style={styles.continueButton}
        >
          <Text style={[styles.secondaryText, { color: colors.textMuted }]}>{text.continue}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  copy: { flex: 1, minWidth: 210, gap: 3 },
  title: { fontSize: 13, fontWeight: "800" },
  body: { fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  primaryButton: { minHeight: 36, paddingHorizontal: 13, borderRadius: 18, justifyContent: "center" },
  primaryText: { fontSize: 12, fontWeight: "800" },
  secondaryButton: {
    minHeight: 36,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    borderRadius: 18,
    justifyContent: "center",
  },
  secondaryText: { fontSize: 12, fontWeight: "700" },
  continueButton: { minHeight: 36, paddingHorizontal: 9, justifyContent: "center" },
});

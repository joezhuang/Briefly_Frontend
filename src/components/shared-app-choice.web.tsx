import { useState } from "react";
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
const IOS_APP_URL = process.env.EXPO_PUBLIC_BRIEFLY_IOS_APP_URL?.trim() ?? "";
const ANDROID_APP_URL =
  process.env.EXPO_PUBLIC_BRIEFLY_ANDROID_APP_URL?.trim() ?? "";

const copy = {
  en: {
    title: "Read this story your way",
    body: "Keep reading on the web, or open it in the Briefly app. Installation is optional.",
    open: "Open Briefly app",
    installIos: "Get the iPhone app",
    installAndroid: "Get the Android app",
    continue: "Continue on web",
  },
  es: {
    title: "Lee esta noticia como prefieras",
    body: "Sigue leyendo en la web o ábrela en la app Briefly. Instalarla es opcional.",
    open: "Abrir la app Briefly",
    installIos: "Obtener la app para iPhone",
    installAndroid: "Obtener la app para Android",
    continue: "Continuar en la web",
  },
  ja: {
    title: "お好きな方法でニュースを読む",
    body: "Webでそのまま読むか、Brieflyアプリで開けます。インストールは任意です。",
    open: "Brieflyアプリで開く",
    installIos: "iPhoneアプリを入手",
    installAndroid: "Androidアプリを入手",
    continue: "Webで続きを読む",
  },
  "zh-CN": {
    title: "选择阅读方式",
    body: "可以继续在网页阅读，也可以用 Briefly 应用打开。无需强制安装。",
    open: "在 Briefly 应用中打开",
    installIos: "下载 iPhone 版",
    installAndroid: "下载 Android 版",
    continue: "继续网页版",
  },
  "zh-TW": {
    title: "選擇閱讀方式",
    body: "可以繼續在網頁閱讀，也可以用 Briefly 應用程式開啟。不必強制安裝。",
    open: "在 Briefly 應用程式中開啟",
    installIos: "下載 iPhone 版",
    installAndroid: "下載 Android 版",
    continue: "繼續網頁版",
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
  const platform = mobilePlatform();
  const text = copy[language] ?? copy.en;
  const appUrl = safeNativeHref(props);
  const storeUrl = platform === "ios" ? IOS_APP_URL : ANDROID_APP_URL;
  const storeText = platform === "ios" ? text.installIos : text.installAndroid;

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
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openURL(appUrl).catch(() => undefined)}
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

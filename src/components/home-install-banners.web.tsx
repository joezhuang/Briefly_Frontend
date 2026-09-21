import { useEffect, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

type MobilePlatform = "ios" | "android" | "desktop";

const IOS_APP_URL = process.env.EXPO_PUBLIC_BRIEFLY_IOS_APP_URL?.trim() ?? "";
const ANDROID_APP_URL =
  process.env.EXPO_PUBLIC_BRIEFLY_ANDROID_APP_URL?.trim() ?? "";
const WEB_DISMISS_KEY = "briefly.web-install-banner.dismissed.v1";
const MOBILE_DISMISS_KEY = "briefly.mobile-install-banner.dismissed.v1";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

const copy = {
  en: {
    webTitle: "Install Briefly",
    webBody: "Keep Briefly one tap away with the installable web app.",
    install: "Install web app",
    instructions: "How to install",
    iosInstructions: "In Safari, tap Share, then Add to Home Screen.",
    otherInstructions:
      "Open your browser menu and choose Install app or Add to Home screen.",
    mobileTitle: "Get Briefly on mobile",
    mobileBody: "Use the native app when a version is available for your device.",
    ios: "Download for iPhone",
    android: "Download for Android",
    dismiss: "Dismiss",
  },
  es: {
    webTitle: "Instala Briefly",
    webBody: "Ten Briefly a un toque con la aplicación web instalable.",
    install: "Instalar aplicación web",
    instructions: "Cómo instalar",
    iosInstructions: "En Safari, pulsa Compartir y luego Añadir a pantalla de inicio.",
    otherInstructions:
      "Abre el menú del navegador y elige Instalar aplicación o Añadir a pantalla de inicio.",
    mobileTitle: "Obtén Briefly en el móvil",
    mobileBody: "Usa la aplicación nativa cuando haya una versión para tu dispositivo.",
    ios: "Descargar para iPhone",
    android: "Descargar para Android",
    dismiss: "Cerrar",
  },
  ja: {
    webTitle: "Brieflyをインストール",
    webBody: "インストール可能なWebアプリでBrieflyをすぐ開けます。",
    install: "Webアプリをインストール",
    instructions: "インストール方法",
    iosInstructions: "Safariで共有をタップし、「ホーム画面に追加」を選びます。",
    otherInstructions:
      "ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選びます。",
    mobileTitle: "Brieflyモバイル版",
    mobileBody: "お使いの端末向けネイティブ版が利用可能な場合にダウンロードできます。",
    ios: "iPhone版をダウンロード",
    android: "Android版をダウンロード",
    dismiss: "閉じる",
  },
  "zh-CN": {
    webTitle: "安装 Briefly",
    webBody: "把 Briefly 安装为网页应用，一键即可打开。",
    install: "安装网页应用",
    instructions: "如何安装",
    iosInstructions: "在 Safari 中点击“分享”，然后选择“添加到主屏幕”。",
    otherInstructions: "打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。",
    mobileTitle: "下载 Briefly 手机版",
    mobileBody: "如果你的设备已有原生版本，可直接下载安装。",
    ios: "下载 iPhone 版",
    android: "下载 Android 版",
    dismiss: "关闭",
  },
  "zh-TW": {
    webTitle: "安裝 Briefly",
    webBody: "把 Briefly 安裝成網頁應用程式，一鍵即可開啟。",
    install: "安裝網頁應用程式",
    instructions: "如何安裝",
    iosInstructions: "在 Safari 點選「分享」，再選擇「加入主畫面」。",
    otherInstructions: "開啟瀏覽器選單，選擇「安裝應用程式」或「加入主畫面」。",
    mobileTitle: "下載 Briefly 手機版",
    mobileBody: "如果你的裝置已有原生版本，可直接下載安裝。",
    ios: "下載 iPhone 版",
    android: "下載 Android 版",
    dismiss: "關閉",
  },
} as const;

function detectMobilePlatform(): MobilePlatform {
  if (typeof navigator === "undefined") return "desktop";
  const userAgent = navigator.userAgent ?? "";
  if (/android/i.test(userAgent)) return "android";
  if (/iPad|iPhone|iPod/i.test(userAgent)) return "ios";
  if (
    /Macintosh/i.test(userAgent) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  ) {
    return "ios";
  }
  return "desktop";
}

function wasRecentlyDismissed(key: string) {
  if (typeof window === "undefined") return false;
  const value = Number(window.localStorage.getItem(key) ?? 0);
  return Number.isFinite(value) && value > 0 && Date.now() - value < DISMISS_MS;
}

function rememberDismissal(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, String(Date.now()));
}

function isStandalone() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    standaloneNavigator.standalone === true
  );
}

export function HomeInstallBanners() {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const text = copy[language] ?? copy.en;
  const platform = useMemo(detectMobilePlatform, []);
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const [webHidden, setWebHidden] = useState(true);
  const [mobileHidden, setMobileHidden] = useState(true);

  const mobileLinks = useMemo(() => {
    if (platform === "ios") {
      return IOS_APP_URL ? [{ label: text.ios, url: IOS_APP_URL }] : [];
    }
    if (platform === "android") {
      return ANDROID_APP_URL
        ? [{ label: text.android, url: ANDROID_APP_URL }]
        : [];
    }

    return [
      ...(IOS_APP_URL ? [{ label: text.ios, url: IOS_APP_URL }] : []),
      ...(ANDROID_APP_URL
        ? [{ label: text.android, url: ANDROID_APP_URL }]
        : []),
    ];
  }, [platform, text.android, text.ios]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement("link");
      manifest.rel = "manifest";
      manifest.href = "/manifest.webmanifest";
      document.head.appendChild(manifest);
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    setWebHidden(isStandalone() || wasRecentlyDismissed(WEB_DISMISS_KEY));
    setMobileHidden(
      mobileLinks.length === 0 || wasRecentlyDismissed(MOBILE_DISMISS_KEY),
    );

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setShowInstallInstructions(false);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setWebHidden(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [mobileLinks.length]);

  const dismissWeb = () => {
    rememberDismissal(WEB_DISMISS_KEY);
    setWebHidden(true);
  };

  const dismissMobile = () => {
    rememberDismissal(MOBILE_DISMISS_KEY);
    setMobileHidden(true);
  };

  const handleInstall = async () => {
    if (!installPrompt) {
      setShowInstallInstructions(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setWebHidden(true);
    }
    setInstallPrompt(null);
  };

  if (webHidden && mobileHidden) return null;

  return (
    <View style={styles.container}>
      {!webHidden && (
        <View
          style={[
            styles.banner,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }]}>
              {text.webTitle}
            </Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              {text.webBody}
            </Text>
            {showInstallInstructions && (
              <Text style={[styles.instructions, { color: colors.text }]}>
                {platform === "ios"
                  ? text.iosInstructions
                  : text.otherInstructions}
              </Text>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleInstall()}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.text },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.primaryText, { color: colors.background }]}>
                {installPrompt ? text.install : text.instructions}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text.dismiss}
              onPress={dismissWeb}
              style={({ pressed }) => [
                styles.dismissButton,
                { borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.dismissText, { color: colors.textMuted }]}>
                ×
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {!mobileHidden && mobileLinks.length > 0 && (
        <View
          style={[
            styles.banner,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
          ]}
        >
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }]}>
              {text.mobileTitle}
            </Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              {text.mobileBody}
            </Text>
          </View>

          <View style={styles.actions}>
            {mobileLinks.map((link) => (
              <Pressable
                key={link.url}
                accessibilityRole="link"
                onPress={() => void Linking.openURL(link.url)}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: colors.text },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.secondaryText, { color: colors.text }]}>
                  {link.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text.dismiss}
              onPress={dismissMobile}
              style={({ pressed }) => [
                styles.dismissButton,
                { borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.dismissText, { color: colors.textMuted }]}>
                ×
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingTop: 12,
  },
  banner: {
    minHeight: 82,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  copy: {
    flex: 1,
    minWidth: 220,
    gap: 4,
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  instructions: {
    paddingTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryButton: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontSize: 13,
    fontWeight: "800",
  },
  dismissButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissText: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
});

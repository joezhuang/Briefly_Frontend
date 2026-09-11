import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

const copy = {
  en: {
    label: "Translate this page",
    localHint: "For local development, use your browser's Translate page option.",
  },
  es: {
    label: "Traducir esta página",
    localHint: "En desarrollo local, usa la opción Traducir página de tu navegador.",
  },
  ja: {
    label: "このページを翻訳",
    localHint: "ローカル開発では、ブラウザの「ページを翻訳」機能を使用してください。",
  },
  "zh-CN": {
    label: "翻译此页面",
    localHint: "本地开发环境请使用浏览器自带的“翻译此页面”功能。",
  },
  "zh-TW": {
    label: "翻譯此頁面",
    localHint: "本機開發環境請使用瀏覽器內建的「翻譯此頁面」功能。",
  },
} as const;

function googleTranslateUrl(sourceUrl: string, targetLanguage: string) {
  return (
    "https://translate.google.com/translate" +
    `?sl=auto&tl=${encodeURIComponent(targetLanguage)}` +
    `&u=${encodeURIComponent(sourceUrl)}`
  );
}

function isPrivateWebUrl(sourceUrl: string) {
  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase();

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return true;
    }

    if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) {
      return true;
    }

    const match = hostname.match(/^172\.(\d{1,3})\./);
    if (match) {
      const secondOctet = Number(match[1]);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }

    return hostname.endsWith(".local");
  } catch {
    return true;
  }
}

export function WebTranslateButton({ sourceUrl }: { sourceUrl: string }) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const labels = copy[language] ?? copy.en;
  const [showLocalHint, setShowLocalHint] = useState(false);
  const privateUrl = isPrivateWebUrl(sourceUrl);

  const handlePress = () => {
    if (privateUrl) {
      setShowLocalHint(true);
      return;
    }

    setShowLocalHint(false);
    void Linking.openURL(googleTranslateUrl(sourceUrl, language));
  };

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface }]}>
      <Pressable
        accessibilityRole={privateUrl ? "button" : "link"}
        accessibilityLabel={labels.label}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.button,
          {
            borderColor: colors.border,
            backgroundColor: colors.surface,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={[styles.label, { color: colors.text }]}>
          {labels.label}{privateUrl ? "" : " ↗"}
        </Text>
      </Pressable>
      {showLocalHint && (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {labels.localHint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 2,
    paddingHorizontal: 16,
  },
  button: {
    minHeight: 36,
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
  },
  hint: {
    maxWidth: 520,
    marginTop: 8,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 17,
  },
});

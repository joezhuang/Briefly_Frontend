import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { trackProductEvent } from "@/analytics/product-analytics";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { ArticleCoverage } from "@/models/article";

const copy = {
  en: {
    title: "Opening the original local report",
    body: "This Local event has one source, so Briefly shows the publisher article directly instead of extracting and rewriting it.",
    open: "Open original article",
    back: "Back to Briefly",
  },
  es: {
    title: "Abriendo la noticia local original",
    body: "Este evento local tiene una sola fuente, por lo que Briefly muestra directamente el artículo del medio en vez de extraerlo y reescribirlo.",
    open: "Abrir artículo original",
    back: "Volver a Briefly",
  },
  ja: {
    title: "地域ニュースの元記事を開いています",
    body: "このローカルイベントは情報源が1件のため、Brieflyで抽出・書き換えを行わず、配信元の記事を直接表示します。",
    open: "元記事を開く",
    back: "Brieflyに戻る",
  },
  "zh-CN": {
    title: "正在打开本地新闻原文",
    body: "这个本地事件只有一个来源，因此 Briefly 会直接显示发布方的原文，而不是抓取并改写。",
    open: "打开原文",
    back: "返回 Briefly",
  },
  "zh-TW": {
    title: "正在開啟本地新聞原文",
    body: "這個本地事件只有一個來源，因此 Briefly 會直接顯示發布方的原文，而不是擷取並改寫。",
    open: "開啟原文",
    back: "返回 Briefly",
  },
} as const;

function validHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function SingleSourceLocalArticle({
  eventId,
  headline,
  coverage,
}: {
  eventId: string;
  headline: string;
  coverage: ArticleCoverage;
}) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const text = copy[language] ?? copy.en;
  const openedRef = useRef(false);
  const [launchFailed, setLaunchFailed] = useState(false);
  const url = coverage.url;

  const openOriginal = async () => {
    if (!validHttpUrl(url)) {
      setLaunchFailed(true);
      return;
    }

    trackProductEvent("source_open", {
      eventId,
      properties: {
        surface: "local_single_source",
        source: coverage.source,
        language: coverage.language ?? null,
      },
    });

    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.assign(url);
        return;
      }

      const result = await WebBrowser.openBrowserAsync(url);
      if (result.type === "cancel" || result.type === "dismiss") {
        return;
      }
    } catch {
      try {
        await Linking.openURL(url);
      } catch {
        setLaunchFailed(true);
      }
    }
  };

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    void openOriginal();
  }, [url]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/" as never);
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.eyebrow, { color: colors.accent }]}>LOCAL</Text>
        <Text style={[styles.headline, { color: colors.text }]}>{headline}</Text>
        <Text style={[styles.publisher, { color: colors.textMuted }]}>
          {coverage.source}
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          {launchFailed ? text.body : text.body}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => void openOriginal()}
          style={[
            styles.primaryButton,
            { backgroundColor: colors.text },
          ]}
        >
          <Text style={[styles.primaryText, { color: colors.background }]}>
            {text.open}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          style={[styles.secondaryButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.secondaryText, { color: colors.text }]}>
            {text.back}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 24,
    gap: 14,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  headline: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },
  publisher: {
    fontSize: 14,
    fontWeight: "700",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginTop: 8,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: "800",
  },
});

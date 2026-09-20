import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCanonicalArticleByVersionId } from "@/api/briefly";
import { trackProductEvent } from "@/analytics/product-analytics";
import { ArticleView } from "@/components/article-view";
import { ScreenState } from "@/components/screen-state";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";

const latestCopy = {
  en: { title: "This is the shared version", body: "Briefly is a living event. Open the latest version for current updates, Timeline, Evidence and Community.", action: "View latest event" },
  es: { title: "Esta es la versión compartida", body: "Briefly sigue el evento en evolución. Abre la versión más reciente para ver actualizaciones, cronología, evidencia y comunidad.", action: "Ver evento actualizado" },
  ja: { title: "これは共有された版です", body: "Briefly は出来事を継続的に更新します。最新の更新、タイムライン、根拠、コミュニティを見るには現在のイベントを開いてください。", action: "最新のイベントを見る" },
  "zh-CN": { title: "这是分享时的版本", body: "Briefly 会持续更新事件。打开最新事件可查看当前更新、时间线、证据和社区。", action: "查看最新事件" },
  "zh-TW": { title: "這是分享時的版本", body: "Briefly 會持續更新事件。開啟最新事件可查看目前更新、時間線、證據和社群。", action: "查看最新事件" },
} as const;

export default function SharedArticleScreen() {
  const { versionId } = useLocalSearchParams<{
    versionId?: string | string[];
  }>();

  const resolved = useMemo(
    () => (Array.isArray(versionId) ? versionId[0] : versionId),
    [versionId],
  );

  const id = Number(resolved);
  const invalidId = !Number.isInteger(id) || id <= 0;

  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  const [article, setArticle] = useState<CanonicalArticle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const trackedOpen = useRef("");

  useEffect(() => {
    if (invalidId) return;

    let active = true;

    Promise.resolve().then(() => {
      if (!active) return;

      setArticle(null);
      setError(null);

      getCanonicalArticleByVersionId(id, {
      includeDraft: PREVIEW_DRAFTS,
    })
      .then((result) => {
        if (active) setArticle(result);
      })
        .catch((err: unknown) => {
          if (active) {
            setError(
              err instanceof Error ? err.message : t.sharedUnavailable,
            );
          }
        });
    });

    return () => {
      active = false;
    };
  }, [id, invalidId, reloadKey, t.sharedUnavailable]);

  useEffect(() => {
    if (!article || article.article_version_id == null) return;
    const key = `${article.event_id}:${article.article_version_id}`;
    if (trackedOpen.current === key) return;
    trackedOpen.current = key;
    trackProductEvent("story_open", {
      eventId: article.event_id,
      articleVersionId: article.article_version_id,
      properties: {
        source: "share",
        language,
        content_language: article.content_language ?? article.language,
        canonical_stale: article.canonical_stale === true,
      },
    });
  }, [article, language]);

  if (invalidId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState
          title={t.sharedUnavailable}
          message={t.invalidSharedLink}
        />
      </SafeAreaView>
    );
  }

  if (!article && !error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState loading message={t.loadingSharedStory} />
      </SafeAreaView>
    );
  }

  if (!article || error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState
          title={t.sharedUnavailable}
          message={error ?? t.articleNotFound}
          onRetry={() => setReloadKey((value) => value + 1)}
        />
      </SafeAreaView>
    );
  }

  const latestText = latestCopy[language] ?? latestCopy.en;
  const latestHref = `/story/${encodeURIComponent(article.slug)}?eventId=${encodeURIComponent(article.event_id)}&source=share_latest`;

  return (
    <ArticleView
      article={article}
      immutable
      footer={
        <View style={[styles.latestCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.latestTitle, { color: colors.text }]}>{latestText.title}</Text>
          <Text style={[styles.latestBody, { color: colors.textMuted }]}>{latestText.body}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(latestHref as never)}
            style={({ pressed }) => [
              styles.latestButton,
              { backgroundColor: colors.text },
              pressed && styles.latestButtonPressed,
            ]}
          >
            <Text style={[styles.latestButtonText, { color: colors.background }]}>
              {latestText.action} →
            </Text>
          </Pressable>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  latestCard: {
    marginTop: 32,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    gap: 8,
  },
  latestTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  latestBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  latestButton: {
    alignSelf: "flex-start",
    marginTop: 6,
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  latestButtonPressed: {
    opacity: 0.72,
  },
  latestButtonText: {
    fontSize: 13,
    fontWeight: "900",
  },
});

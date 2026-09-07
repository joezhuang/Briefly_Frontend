import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getCanonicalArticleByEventId,
  getCanonicalArticleBySlug,
} from "@/api/briefly";
import { ArticleView } from "@/components/article-view";
import { ScreenState } from "@/components/screen-state";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";

export default function StoryDetailScreen() {
  const { slug, eventId } = useLocalSearchParams<{
    slug?: string | string[];
    eventId?: string | string[];
  }>();

  const resolvedSlug = useMemo(
    () => (Array.isArray(slug) ? slug[0] : slug),
    [slug],
  );

  const resolvedEventId = useMemo(
    () => (Array.isArray(eventId) ? eventId[0] : eventId),
    [eventId],
  );

  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  const [article, setArticle] = useState<CanonicalArticle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const requestKey = `${resolvedSlug ?? ""}:${resolvedEventId ?? ""}:${language}:${reloadKey}`;
  const loading = loadingKey !== requestKey && !error;

  useEffect(() => {
    if (!resolvedSlug) return;

    let active = true;

    Promise.resolve().then(() => {
      if (!active) return;

      setError(null);
      setLoadingKey("");

      const request = resolvedEventId
        ? getCanonicalArticleByEventId(resolvedEventId, {
            includeDraft: PREVIEW_DRAFTS,
            language,
          })
        : getCanonicalArticleBySlug(resolvedSlug, {
            includeDraft: PREVIEW_DRAFTS,
            language,
          });

      request
        .then((result) => {
          if (active) {
            setArticle(result);
            setLoadingKey(requestKey);
          }
        })
        .catch((err: unknown) => {
          if (active) {
            setArticle(null);
            setLoadingKey(requestKey);
            setError(
              err instanceof Error ? err.message : t.storyUnavailable,
            );
          }
        });
    });

    return () => {
      active = false;
    };
  }, [
    resolvedSlug,
    resolvedEventId,
    language,
    reloadKey,
    requestKey,
    t.storyUnavailable,
  ]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState loading message={t.loadingStory} />
      </SafeAreaView>
    );
  }

  if (!article || error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState
          title={t.storyUnavailable}
          message={error ?? t.articleNotFound}
          onRetry={() => setReloadKey((value) => value + 1)}
        />
      </SafeAreaView>
    );
  }

  return <ArticleView article={article} />;
}

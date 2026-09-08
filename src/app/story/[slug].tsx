import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getCanonicalArticleByEventId,
  getCanonicalArticleBySlug,
  getExperimentalArticleByEventId,
} from "@/api/briefly";
import { ArticleView } from "@/components/article-view";
import { ScreenState } from "@/components/screen-state";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";
const EXPERIMENTAL_POLL_MS = 5000;

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
  const loading = loadingKey !== requestKey && !error && !article;

  useEffect(() => {
    if (!resolvedSlug) return;

    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const load = async (polling = false) => {
      if (!active) return;

      if (!polling) {
        setError(null);
        setLoadingKey("");
        setArticle(null);
      }

      try {
        let result: CanonicalArticle;

        if (language !== "en" && resolvedEventId) {
          result = await getExperimentalArticleByEventId(resolvedEventId, {
            includeDraft: PREVIEW_DRAFTS,
            language,
          });
        } else {
          result = resolvedEventId
            ? await getCanonicalArticleByEventId(resolvedEventId, {
                includeDraft: PREVIEW_DRAFTS,
                language,
              })
            : await getCanonicalArticleBySlug(resolvedSlug, {
                includeDraft: PREVIEW_DRAFTS,
                language,
              });
        }

        if (!active) return;

        setArticle(result);
        setLoadingKey(requestKey);
        setError(null);

        if (
          language !== "en" &&
          resolvedEventId &&
          result.translation_status === "pending"
        ) {
          pollTimer = setTimeout(() => {
            void load(true);
          }, EXPERIMENTAL_POLL_MS);
        }
      } catch (err: unknown) {
        if (!active) return;

        if (!polling) {
          setArticle(null);
        }
        setLoadingKey(requestKey);
        setError(err instanceof Error ? err.message : t.storyUnavailable);
      }
    };

    void load(false);

    return () => {
      active = false;
      if (pollTimer) clearTimeout(pollTimer);
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

import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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

  return <ArticleView article={article} immutable />;
}

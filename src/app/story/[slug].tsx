import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCanonicalArticleByEventId, getCanonicalArticleBySlug } from "@/api/briefly";
import { ArticleView } from "@/components/article-view";
import { ScreenState } from "@/components/screen-state";
import { useBrieflyLanguage } from "@/context/language";
import type { CanonicalArticle } from "@/models/article";

const PREVIEW_DRAFTS = process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";

export default function StoryDetailScreen() {
  const { slug, eventId } = useLocalSearchParams<{ slug?: string | string[]; eventId?: string | string[] }>();
  const resolvedSlug = useMemo(() => Array.isArray(slug) ? slug[0] : slug, [slug]);
  const resolvedEventId = useMemo(() => Array.isArray(eventId) ? eventId[0] : eventId, [eventId]);
  const { language } = useBrieflyLanguage();
  const [article, setArticle] = useState<CanonicalArticle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!resolvedSlug) return;
    let active = true;
    setArticle(null); setError(null);
    const request = resolvedEventId
      ? getCanonicalArticleByEventId(resolvedEventId, { includeDraft: PREVIEW_DRAFTS, language })
      : getCanonicalArticleBySlug(resolvedSlug, { includeDraft: PREVIEW_DRAFTS, language });
    request
      .then((result) => { if (active) setArticle(result); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Unable to load this story."); });
    return () => { active = false; };
  }, [resolvedSlug, resolvedEventId, language, reloadKey]);

  if (!article && !error) return <SafeAreaView style={{ flex: 1 }}><ScreenState loading message="Loading story…" /></SafeAreaView>;
  if (!article || error) return <SafeAreaView style={{ flex: 1 }}><ScreenState title="Story unavailable" message={error ?? "Article not found."} onRetry={() => setReloadKey((value) => value + 1)} /></SafeAreaView>;
  return <ArticleView article={article} />;
}

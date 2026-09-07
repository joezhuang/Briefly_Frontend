import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCanonicalArticleByVersionId } from "@/api/briefly";
import { ArticleView } from "@/components/article-view";
import { ScreenState } from "@/components/screen-state";
import type { CanonicalArticle } from "@/models/article";

export default function SharedArticleScreen() {
  const { versionId } = useLocalSearchParams<{ versionId?: string | string[] }>();
  const resolved = useMemo(() => Array.isArray(versionId) ? versionId[0] : versionId, [versionId]);
  const id = Number(resolved);
  const [article, setArticle] = useState<CanonicalArticle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) { setError("Invalid shared article link."); return; }
    let active = true;
    getCanonicalArticleByVersionId(id).then((result) => { if (active) setArticle(result); }).catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Unable to load this shared story."); });
    return () => { active = false; };
  }, [id]);

  if (!article && !error) return <SafeAreaView style={{ flex: 1 }}><ScreenState loading message="Loading shared story…" /></SafeAreaView>;
  if (!article || error) return <SafeAreaView style={{ flex: 1 }}><ScreenState title="Shared story unavailable" message={error ?? "Article not found."} /></SafeAreaView>;
  return <ArticleView article={article} immutable />;
}

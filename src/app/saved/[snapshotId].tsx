import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArticleView } from "@/components/article-view";
import { ScreenState } from "@/components/screen-state";
import { useSavedArticles } from "@/context/saved-articles";

export default function SavedArticleScreen() {
  const { snapshotId } = useLocalSearchParams<{ snapshotId?: string | string[] }>();
  const resolved = useMemo(() => Array.isArray(snapshotId) ? snapshotId[0] : snapshotId, [snapshotId]);
  const { snapshots, ready } = useSavedArticles();
  if (!ready) return <SafeAreaView style={{ flex: 1 }}><ScreenState loading message="Loading saved story…" /></SafeAreaView>;
  const article = snapshots.find((item) => item.snapshot_id === resolved);
  if (!article) return <SafeAreaView style={{ flex: 1 }}><ScreenState title="Saved story unavailable" message="This snapshot is no longer stored on this device." /></SafeAreaView>;
  return <ArticleView article={article} immutable />;
}

import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArticleView } from "@/components/article-view";
import { ScreenState } from "@/components/screen-state";
import { useBrieflyLanguage } from "@/context/language";
import { useSavedArticles } from "@/context/saved-articles";
import { useBrieflyTheme } from "@/context/theme";

export default function SavedArticleScreen() {
  const { snapshotId } = useLocalSearchParams<{
    snapshotId?: string | string[];
  }>();

  const resolved = useMemo(
    () => (Array.isArray(snapshotId) ? snapshotId[0] : snapshotId),
    [snapshotId],
  );

  const { snapshots, ready } = useSavedArticles();
  const { t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState loading message={t.loadingSavedStory} />
      </SafeAreaView>
    );
  }

  const article = snapshots.find((item) => item.snapshot_id === resolved);

  if (!article) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState
          title={t.savedUnavailable}
          message={t.savedUnavailableMessage}
        />
      </SafeAreaView>
    );
  }

  return <ArticleView article={article} immutable />;
}

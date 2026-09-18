import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCanonicalArticleByEventId } from "@/api/briefly";
import { ArticleView } from "@/components/article-view";
import { EventTimeline } from "@/components/event-timeline";
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
  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const hadArticle = useRef(false);
  const [checkedSnapshotId, setCheckedSnapshotId] = useState<string | null>(null);

  const article = useMemo(
    () => snapshots.find((item) => item.snapshot_id === resolved),
    [resolved, snapshots],
  );

  useEffect(() => {
    if (!ready || !resolved) return;

    if (article) {
      hadArticle.current = true;
      return;
    }

    if (hadArticle.current) {
      router.replace("/saved");
    }
  }, [article, ready, resolved]);

  useEffect(() => {
    if (!ready || !resolved || !article?.event_id || checkedSnapshotId === resolved) {
      return;
    }

    let cancelled = false;

    getCanonicalArticleByEventId(article.event_id, { language })
      .then((latest) => {
        if (cancelled) return;

        const params = new URLSearchParams({
          eventId: latest.event_id,
          savedSnapshotId: resolved,
          source: "saved",
        });
        if (latest.image_url) params.set("imageUrl", latest.image_url);
        if (latest.headline) params.set("previewHeadline", latest.headline);

        router.replace(
          `/story/${encodeURIComponent(latest.slug)}?${params.toString()}` as never,
        );
      })
      .catch(() => {
        if (!cancelled) setCheckedSnapshotId(resolved);
      });

    return () => {
      cancelled = true;
    };
  }, [article, checkedSnapshotId, language, ready, resolved]);

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState loading message={t.loadingSavedStory} />
      </SafeAreaView>
    );
  }

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

  const checkingLatest = !!article.event_id && checkedSnapshotId !== resolved;
  if (checkingLatest) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState loading message={t.loadingSavedStory} />
      </SafeAreaView>
    );
  }

  const liveStoryHref = (() => {
    const params = new URLSearchParams({
      eventId: article.event_id,
      source: "saved_snapshot",
    });
    if (article.image_url) params.set("imageUrl", article.image_url);
    if (article.headline) params.set("previewHeadline", article.headline);
    return `/story/${article.slug}?${params.toString()}`;
  })();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {!!article.event_id && (
        <EventTimeline
          eventId={article.event_id}
          liveContext
          liveStoryHref={liveStoryHref}
        />
      )}
      <ArticleView article={article} immutable />
    </View>
  );
}

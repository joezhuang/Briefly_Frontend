import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getCanonicalArticleByEventId,
  getCanonicalArticleBySlug,
  getExperimentalArticleByEventId,
  getPodcastAnalysisStatus,
  requestPodcastAnalysis,
  type PodcastAnalysisStatus,
} from "@/api/briefly";
import { ArticleView } from "@/components/article-view";
import { ScreenState } from "@/components/screen-state";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";
const EXPERIMENTAL_POLL_MS = 5000;
const PODCAST_POLL_MS = 5000;

type PodcastState = {
  key: string;
  value: PodcastAnalysisStatus | null;
};

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
  const { user, account } = useBrieflyAuth();

  const [article, setArticle] = useState<CanonicalArticle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [podcastState, setPodcastState] = useState<PodcastState>({
    key: "",
    value: null,
  });
  const [podcastBusy, setPodcastBusy] = useState(false);

  const requestKey = `${resolvedSlug ?? ""}:${resolvedEventId ?? ""}:${language}:${reloadKey}`;
  const loading = loadingKey !== requestKey && !error && !article;
  const isPro = account?.translation_entitled === true;
  const podcastSourceVersionId = article
    ? article.authoritative_article_version_id ?? article.article_version_id
    : null;
  const podcastRequestKey =
    isPro && podcastSourceVersionId
      ? `${podcastSourceVersionId}:${language}`
      : "";
  const podcast =
    podcastState.key === podcastRequestKey ? podcastState.value : null;

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

  useEffect(() => {
    if (!podcastRequestKey || !podcastSourceVersionId) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loadStatus = async () => {
      try {
        const next = await getPodcastAnalysisStatus(
          podcastSourceVersionId,
          language,
        );
        if (!active) return;
        setPodcastState({ key: podcastRequestKey, value: next });
        if (next.status === "processing") {
          timer = setTimeout(() => void loadStatus(), PODCAST_POLL_MS);
        }
      } catch {
        if (active) {
          setPodcastState({ key: podcastRequestKey, value: null });
        }
      }
    };

    void loadStatus();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [language, podcastRequestKey, podcastSourceVersionId]);

  const handlePodcastAction = async () => {
    if (podcast?.status === "ready" && podcast.audio_url) {
      if (Platform.OS !== "web") {
        await Linking.openURL(podcast.audio_url);
      }
      return;
    }

    if (!user) {
      router.push("/sign-in");
      return;
    }

    if (!isPro) {
      router.push("/upgrade");
      return;
    }

    if (!podcastSourceVersionId || !podcastRequestKey || podcastBusy) return;

    setPodcastBusy(true);
    try {
      const next = await requestPodcastAnalysis(
        podcastSourceVersionId,
        language,
      );
      setPodcastState({ key: podcastRequestKey, value: next });
    } finally {
      setPodcastBusy(false);
    }
  };

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

  return (
    <ArticleView
      article={article}
      podcast={podcast}
      podcastBusy={podcastBusy}
      podcastPro={isPro}
      podcastSignedIn={!!user}
      onPodcastAction={() => void handlePodcastAction()}
    />
  );
}

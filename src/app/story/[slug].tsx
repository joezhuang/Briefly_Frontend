import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getCanonicalArticleBySlug,
  getExperimentalArticleByEventId,
  getLazyCanonicalArticleByEventId,
  getPodcastAnalysisStatus,
  requestPodcastAnalysis,
  type PodcastAnalysisStatus,
} from "@/api/briefly";
import {
  ArticleLanguageToggle,
  type ArticleLanguageMode,
} from "@/components/article-language-toggle";
import { ArticleView } from "@/components/article-view";
import { EventPreviewView } from "@/components/event-preview-view";
import { ScreenState } from "@/components/screen-state";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";
const LAZY_ARTICLE_POLL_MS = 5000;
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
  const [authoritativeArticle, setAuthoritativeArticle] =
    useState<CanonicalArticle | null>(null);
  const [languageMode, setLanguageMode] =
    useState<ArticleLanguageMode>("localized");
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

    const schedulePoll = (delay: number) => {
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = setTimeout(() => void load(true), delay);
    };

    const load = async (polling = false) => {
      if (!active) return;

      if (!polling) {
        setError(null);
        setLoadingKey("");
        setArticle(null);
        setAuthoritativeArticle(null);
        setLanguageMode("localized");
      }

      try {
        let result: CanonicalArticle;

        if (resolvedEventId) {
          const canonical = await getLazyCanonicalArticleByEventId(resolvedEventId, {
            includeDraft: PREVIEW_DRAFTS,
            language,
          });

          if (!active) return;

          if (canonical.article_version_id == null) {
            setArticle(canonical);
            setLoadingKey(requestKey);
            setError(null);
            if (canonical.generation_status === "processing") {
              schedulePoll(LAZY_ARTICLE_POLL_MS);
            }
            return;
          }

          setAuthoritativeArticle(canonical);

          result =
            language !== "en"
              ? await getExperimentalArticleByEventId(resolvedEventId, {
                  includeDraft: PREVIEW_DRAFTS,
                  language,
                })
              : canonical;
        } else {
          result = await getCanonicalArticleBySlug(resolvedSlug, {
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
          schedulePoll(EXPERIMENTAL_POLL_MS);
        }
      } catch (err: unknown) {
        if (!active) return;
        if (!polling) setArticle(null);
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

  if (article.article_version_id == null) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <EventPreviewView
          article={article}
          onRetry={
            article.generation_status === "processing"
              ? undefined
              : () => setReloadKey((value) => value + 1)
          }
        />
      </SafeAreaView>
    );
  }

  const canToggleOriginal =
    language !== "en" &&
    article.experimental_localization === true &&
    authoritativeArticle?.article_version_id != null;
  const displayedArticle =
    canToggleOriginal && languageMode === "original" && authoritativeArticle
      ? authoritativeArticle
      : article;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {canToggleOriginal && (
        <ArticleLanguageToggle
          mode={languageMode}
          onChange={setLanguageMode}
        />
      )}
      <ArticleView
        article={displayedArticle}
        podcast={podcast}
        podcastBusy={podcastBusy}
        podcastPro={isPro}
        podcastSignedIn={!!user}
        onPodcastAction={() => void handlePodcastAction()}
      />
    </View>
  );
}

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
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
import { EventTimeline } from "@/components/event-timeline";
import { ScreenState } from "@/components/screen-state";
import { StaleStoryNotice } from "@/components/stale-story-notice";
import { WebTranslateButton } from "@/components/web-translate-button";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";
const LAZY_ARTICLE_POLL_MS = 5000;
const EXPERIMENTAL_POLL_MS = 5000;
const PODCAST_POLL_MS = 5000;

const storyToolsCopy = {
  en: { title: "Story tools", collapse: "Collapse", expand: "Show" },
  es: { title: "Herramientas", collapse: "Ocultar", expand: "Mostrar" },
  ja: { title: "記事ツール", collapse: "閉じる", expand: "表示" },
  "zh-CN": { title: "报道工具", collapse: "收起", expand: "展开" },
  "zh-TW": { title: "報導工具", collapse: "收起", expand: "展開" },
} as const;

type PodcastState = {
  key: string;
  value: PodcastAnalysisStatus | null;
};

function preferredImage(
  article: CanonicalArticle,
  imageUrl: string | undefined,
): CanonicalArticle {
  if (!imageUrl) return article;
  return { ...article, image_url: imageUrl };
}

function preferredPreviewHeadline(
  article: CanonicalArticle,
  previewHeadline: string | undefined,
): CanonicalArticle {
  if (!previewHeadline || article.article_version_id != null) return article;
  return { ...article, headline: previewHeadline };
}

function getWebStoryUrl(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;

  const configuredBase = process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL?.replace(/\/$/, "");
  if (configuredBase) {
    return `${configuredBase}${window.location.pathname}${window.location.search}`;
  }

  return window.location.href;
}

export default function StoryDetailScreen() {
  const { slug, eventId, imageUrl, previewHeadline } = useLocalSearchParams<{
    slug?: string | string[];
    eventId?: string | string[];
    imageUrl?: string | string[];
    previewHeadline?: string | string[];
  }>();

  const resolvedSlug = useMemo(
    () => (Array.isArray(slug) ? slug[0] : slug),
    [slug],
  );
  const resolvedEventId = useMemo(
    () => (Array.isArray(eventId) ? eventId[0] : eventId),
    [eventId],
  );
  const resolvedImageUrl = useMemo(
    () => (Array.isArray(imageUrl) ? imageUrl[0] : imageUrl),
    [imageUrl],
  );
  const resolvedPreviewHeadline = useMemo(
    () => (Array.isArray(previewHeadline) ? previewHeadline[0] : previewHeadline),
    [previewHeadline],
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
  const [storyToolsExpanded, setStoryToolsExpanded] = useState(true);

  const isWeb = Platform.OS === "web";
  const articleRequestLanguage = isWeb ? "en" : language;
  const webTranslateSourceUrl = isWeb && language !== "en" ? getWebStoryUrl() : null;
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
          const canonicalResponse = await getLazyCanonicalArticleByEventId(
            resolvedEventId,
            {
              includeDraft: PREVIEW_DRAFTS,
              language: articleRequestLanguage,
            },
          );
          const canonical = preferredImage(canonicalResponse, resolvedImageUrl);

          if (!active) return;

          if (canonical.article_version_id == null) {
            setArticle(preferredPreviewHeadline(canonical, resolvedPreviewHeadline));
            setLoadingKey(requestKey);
            setError(null);
            if (canonical.generation_status === "processing") {
              schedulePoll(LAZY_ARTICLE_POLL_MS);
            }
            return;
          }

          setAuthoritativeArticle(canonical);

          if (canonical.canonical_stale) {
            result = canonical;
            // Existing articles are read-only on normal GET. Poll only when an explicit
            // timeline refresh is already running.
            if (canonical.generation_status === "processing") {
              schedulePoll(LAZY_ARTICLE_POLL_MS);
            }
          } else if (!isWeb && language !== "en") {
            const localized = await getExperimentalArticleByEventId(resolvedEventId, {
              includeDraft: PREVIEW_DRAFTS,
              language,
            });
            result = preferredImage(
              localized,
              resolvedImageUrl ?? canonical.image_url ?? undefined,
            );
          } else {
            result = canonical;
          }
        } else {
          const canonicalBySlug = await getCanonicalArticleBySlug(resolvedSlug, {
            includeDraft: PREVIEW_DRAFTS,
            language: articleRequestLanguage,
          });
          result = preferredImage(canonicalBySlug, resolvedImageUrl);
        }

        if (!active) return;

        setArticle(result);
        setLoadingKey(requestKey);
        setError(null);

        if (
          !result.canonical_stale &&
          !isWeb &&
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
    resolvedImageUrl,
    resolvedPreviewHeadline,
    language,
    articleRequestLanguage,
    isWeb,
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
          article={preferredPreviewHeadline(
            preferredImage(article, resolvedImageUrl),
            resolvedPreviewHeadline,
          )}
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
    !article.canonical_stale &&
    !isWeb &&
    language !== "en" &&
    article.experimental_localization === true &&
    authoritativeArticle?.article_version_id != null;
  const displayedArticle = preferredImage(
    canToggleOriginal && languageMode === "original" && authoritativeArticle
      ? authoritativeArticle
      : article,
    resolvedImageUrl,
  );
  const storyToolsText = storyToolsCopy[language] ?? storyToolsCopy.en;

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.surface }}
    >
      <View
        key={resolvedSlug ?? "story-tools"}
        style={[
          styles.storyTools,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            storyToolsExpanded ? storyToolsText.collapse : storyToolsText.expand
          }
          onPress={() => setStoryToolsExpanded((value) => !value)}
          style={({ pressed }) => [
            styles.storyToolsHandle,
            { opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Text style={[styles.storyToolsTitle, { color: colors.textMuted }]}>
            {storyToolsText.title}
          </Text>
          <Text style={[styles.storyToolsAction, { color: colors.accent }]}>
            {storyToolsExpanded ? `${storyToolsText.collapse} ↑` : `${storyToolsText.expand} ↓`}
          </Text>
        </Pressable>

        {storyToolsExpanded && (
          <View style={styles.storyToolsContent}>
            {canToggleOriginal && (
              <ArticleLanguageToggle
                mode={languageMode}
                onChange={setLanguageMode}
              />
            )}
            {webTranslateSourceUrl && (
              <WebTranslateButton sourceUrl={webTranslateSourceUrl} />
            )}
            <StaleStoryNotice article={displayedArticle} />
            {!!resolvedEventId && (
              <EventTimeline
                eventId={resolvedEventId}
                canonicalStale={displayedArticle.canonical_stale === true}
                pro={isPro}
                onRefreshStarted={() => setReloadKey((value) => value + 1)}
              />
            )}
          </View>
        )}
      </View>

      <ArticleView
        article={displayedArticle}
        podcast={podcast}
        podcastBusy={podcastBusy}
        podcastPro={isPro}
        podcastSignedIn={!!user}
        onPodcastAction={() => void handlePodcastAction()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  storyTools: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  storyToolsHandle: {
    minHeight: 44,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  storyToolsTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  storyToolsAction: {
    fontSize: 13,
    fontWeight: "800",
  },
  storyToolsContent: {
    paddingBottom: 8,
  },
});

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getBrieflyAppConfig,
  getCanonicalArticleByEventId,
  getCanonicalArticleBySlug,
  getExperimentalArticleByEventId,
  getLazyCanonicalArticleByEventId,
  getPodcastAnalysisStatus,
  requestPodcastAnalysis,
  type BrieflyAppConfig,
  type PodcastAnalysisStatus,
} from "@/api/briefly";
import {
  ArticleLanguageToggle,
  type ArticleLanguageMode,
} from "@/components/article-language-toggle";
import { ArticleView } from "@/components/article-view";
import { EventPreviewView } from "@/components/event-preview-view";
import { EventTimeline } from "@/components/event-timeline";
import { RelatedStoriesCarousel } from "@/components/related-stories-carousel";
import { ScreenState } from "@/components/screen-state";
import { StaleStoryNotice } from "@/components/stale-story-notice";
// Metro resolves the platform-specific .native/.web implementation at runtime.
// eslint-disable-next-line import/no-unresolved
import { StoryAdSlot } from "@/components/story-ad-slot";
import { WebTranslateButton } from "@/components/web-translate-button";
import { useAnalysisReadiness } from "@/context/analysis-readiness";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useReadingHistory } from "@/context/reading-history";
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
  const { ready: authReady, user, account } = useBrieflyAuth();
  const { watchAnalysis, watchPodcast } = useAnalysisReadiness();
  const { recordArticle } = useReadingHistory();

  const [article, setArticle] = useState<CanonicalArticle | null>(null);
  const [authoritativeArticle, setAuthoritativeArticle] =
    useState<CanonicalArticle | null>(null);
  const [languageMode, setLanguageMode] =
    useState<ArticleLanguageMode>("localized");
  const [error, setError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [appConfig, setAppConfig] = useState<BrieflyAppConfig | null>(null);
  const [podcastState, setPodcastState] = useState<PodcastState>({
    key: "",
    value: null,
  });
  const [podcastWatchKey, setPodcastWatchKey] = useState("");
  const [podcastBusyKey, setPodcastBusyKey] = useState("");
  const [storyToolsExpanded, setStoryToolsExpanded] = useState(false);
  const historyRecordedKey = useRef("");

  const isWeb = Platform.OS === "web";
  const articleRequestLanguage = language;
  const currentStoryHref = useMemo(() => {
    if (!resolvedSlug) return "/";
    const params = new URLSearchParams();
    if (resolvedEventId) params.set("eventId", resolvedEventId);
    if (resolvedImageUrl) params.set("imageUrl", resolvedImageUrl);
    if (resolvedPreviewHeadline) {
      params.set("previewHeadline", resolvedPreviewHeadline);
    }
    const query = params.toString();
    return `/story/${encodeURIComponent(resolvedSlug)}${query ? `?${query}` : ""}`;
  }, [
    resolvedEventId,
    resolvedImageUrl,
    resolvedPreviewHeadline,
    resolvedSlug,
  ]);
  const webTranslateSourceUrl = isWeb && language !== "en" ? getWebStoryUrl() : null;
  const requestKey = `${resolvedSlug ?? ""}:${resolvedEventId ?? ""}:${language}:${reloadKey}`;
  const loading = loadingKey !== requestKey && !error && !article;
  const isPro = account?.translation_entitled === true;
  const showStoryAd =
    !isWeb &&
    appConfig?.ads_enabled === true &&
    appConfig.story_ad_enabled === true &&
    appConfig.ad_provider === "admob" &&
    !(appConfig.ads_free_for_pro && isPro);
  const podcastSourceVersionId = article
    ? article.authoritative_article_version_id ?? article.article_version_id
    : null;
  const podcastRequestKey =
    isPro && podcastSourceVersionId
      ? `${podcastSourceVersionId}:${language}`
      : "";
  const podcast =
    podcastState.key === podcastRequestKey ? podcastState.value : null;
  const podcastBusy =
    !!podcastRequestKey && podcastBusyKey === podcastRequestKey;

  useEffect(() => {
    if (!authReady) return;

    void getBrieflyAppConfig()
      .then(setAppConfig)
      .catch(() => setAppConfig(null));
  }, [authReady]);

  useEffect(() => {
    if (!resolvedSlug || !authReady) return;

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
            const preview = preferredPreviewHeadline(
              canonical,
              resolvedPreviewHeadline,
            );
            setArticle(preview);
            setLoadingKey(requestKey);
            setError(null);
            if (canonical.generation_status === "processing") {
              watchAnalysis({
                eventId: resolvedEventId,
                headline: preview.headline,
                href: currentStoryHref,
              });
              schedulePoll(LAZY_ARTICLE_POLL_MS);
            }
            return;
          }

          setAuthoritativeArticle(canonical);

          if (language !== "en") {
            if (isWeb) {
              // Web never creates translations. It may consume any approved cached
              // translation for the currently stored English canonical version.
              try {
                const localized = await getCanonicalArticleByEventId(
                  resolvedEventId,
                  {
                    includeDraft: PREVIEW_DRAFTS,
                    language,
                  },
                );
                result =
                  localized.content_language === language
                    ? {
                        ...preferredImage(
                          localized,
                          resolvedImageUrl ?? canonical.image_url ?? undefined,
                        ),
                        canonical_stale: canonical.canonical_stale,
                        latest_evidence_at: canonical.latest_evidence_at,
                        stale_refresh_entitled: canonical.stale_refresh_entitled,
                        generation_status: canonical.generation_status,
                      }
                    : canonical;
              } catch {
                result = canonical;
              }
            } else {
              const localized = await getExperimentalArticleByEventId(
                resolvedEventId,
                {
                  includeDraft: PREVIEW_DRAFTS,
                  language,
                },
              );
              result = {
                ...preferredImage(
                  localized,
                  resolvedImageUrl ?? canonical.image_url ?? undefined,
                ),
                canonical_stale: canonical.canonical_stale,
                latest_evidence_at: canonical.latest_evidence_at,
                stale_refresh_entitled: canonical.stale_refresh_entitled,
                generation_status: canonical.generation_status,
              };
            }
          } else {
            result = canonical;
          }

          if (
            canonical.canonical_stale &&
            canonical.generation_status === "processing"
          ) {
            schedulePoll(LAZY_ARTICLE_POLL_MS);
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
    authReady,
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
    currentStoryHref,
    watchAnalysis,
  ]);

  useEffect(() => {
    if (!article || !article.event_id) return;

    const historyKey = `${article.event_id}:${currentStoryHref}`;
    if (historyRecordedKey.current === historyKey) return;

    historyRecordedKey.current = historyKey;
    void recordArticle(article, currentStoryHref);
  }, [article, currentStoryHref, recordArticle]);

  useEffect(() => {
    if (!podcastRequestKey || !podcastSourceVersionId) return;

    let active = true;

    const loadInitialStatus = async () => {
      try {
        const next = await getPodcastAnalysisStatus(
          podcastSourceVersionId,
          language,
        );
        if (!active) return;
        setPodcastState({ key: podcastRequestKey, value: next });
        setPodcastWatchKey(next.status === "processing" ? podcastRequestKey : "");
      } catch {
        if (active) {
          setPodcastState({ key: podcastRequestKey, value: null });
          setPodcastWatchKey("");
        }
      }
    };

    void loadInitialStatus();
    return () => {
      active = false;
    };
  }, [language, podcastRequestKey, podcastSourceVersionId]);

  useEffect(() => {
    if (
      !podcastRequestKey ||
      !podcastSourceVersionId ||
      podcastWatchKey !== podcastRequestKey
    ) {
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const next = await getPodcastAnalysisStatus(
          podcastSourceVersionId,
          language,
        );
        if (!active) return;

        if (next.status === "not_generated") {
          setPodcastState({
            key: podcastRequestKey,
            value: { ...next, status: "processing" },
          });
          timer = setTimeout(() => void poll(), PODCAST_POLL_MS);
          return;
        }

        setPodcastState({ key: podcastRequestKey, value: next });
        if (next.status === "processing") {
          timer = setTimeout(() => void poll(), PODCAST_POLL_MS);
        } else {
          setPodcastWatchKey("");
        }
      } catch {
        if (active) {
          timer = setTimeout(() => void poll(), PODCAST_POLL_MS);
        }
      }
    };

    timer = setTimeout(() => void poll(), PODCAST_POLL_MS);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [language, podcastRequestKey, podcastSourceVersionId, podcastWatchKey]);

  const handlePodcastAction = async () => {
    if (!user) {
      router.push(
        `/sign-in?returnTo=${encodeURIComponent(currentStoryHref)}` as never,
      );
      return;
    }
    if (!isPro) {
      router.push(
        `/upgrade?returnTo=${encodeURIComponent(currentStoryHref)}` as never,
      );
      return;
    }
    if (!podcastSourceVersionId || !podcastRequestKey || podcastBusy) return;

    const busyKey = podcastRequestKey;
    setPodcastBusyKey(busyKey);
    try {
      const next = await requestPodcastAnalysis(
        podcastSourceVersionId,
        language,
      );
      setPodcastState({ key: podcastRequestKey, value: next });
      if (next.status === "processing") {
        watchPodcast({
          articleVersionId: podcastSourceVersionId,
          language,
          headline: article?.headline ?? resolvedPreviewHeadline ?? resolvedSlug ?? "Briefly",
          href: currentStoryHref,
        });
        setPodcastWatchKey(podcastRequestKey);
      }
    } finally {
      setPodcastBusyKey((current) => (current === busyKey ? "" : current));
    }
  };

  if (!authReady || loading) {
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
                returnTo={currentStoryHref}
                onRefreshStarted={() => {
                  const baseVersionId =
                    displayedArticle.authoritative_article_version_id ??
                    displayedArticle.article_version_id;
                  if (baseVersionId != null) {
                    watchAnalysis({
                      eventId: resolvedEventId,
                      headline: displayedArticle.headline,
                      href: currentStoryHref,
                      kind: "refresh",
                      baseVersionId,
                    });
                  }
                  setReloadKey((value) => value + 1);
                }}
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
        footer={
          <>
            {showStoryAd && <StoryAdSlot />}
            <RelatedStoriesCarousel article={displayedArticle} />
          </>
        }
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
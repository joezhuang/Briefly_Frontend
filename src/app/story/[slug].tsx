import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Text,
  View,
} from "react-native";
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

const staleCopy = {
  en: {
    updating: "Newer source coverage exists. Briefly is updating this story…",
    stale: "Newer source coverage exists, but Briefly has not synthesized it into a newer article yet.",
  },
  es: {
    updating: "Hay cobertura más reciente. Briefly está actualizando esta historia…",
    stale: "Hay cobertura más reciente, pero Briefly aún no la ha sintetizado en una nueva versión del artículo.",
  },
  ja: {
    updating: "より新しい報道があります。Briefly がこの記事を更新しています…",
    stale: "より新しい報道がありますが、Briefly はまだ新しい記事版に反映していません。",
  },
  "zh-CN": {
    updating: "已有更新的来源报道。Briefly 正在更新这篇报道…",
    stale: "已有更新的来源报道，但 Briefly 尚未将其整理成更新的文章版本。",
  },
  "zh-TW": {
    updating: "已有更新的來源報導。Briefly 正在更新這篇報導…",
    stale: "已有更新的來源報導，但 Briefly 尚未將其整理成更新的文章版本。",
  },
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
  const staleText = staleCopy[language] ?? staleCopy.en;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {canToggleOriginal && (
        <ArticleLanguageToggle
          mode={languageMode}
          onChange={setLanguageMode}
        />
      )}
      {webTranslateSourceUrl && (
        <WebTranslateButton sourceUrl={webTranslateSourceUrl} />
      )}
      {displayedArticle.canonical_stale && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 18,
            paddingVertical: 11,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          {displayedArticle.generation_status === "processing" && (
            <ActivityIndicator size="small" color={colors.accent} />
          )}
          <Text style={{ flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
            {displayedArticle.generation_status === "processing"
              ? staleText.updating
              : staleText.stale}
          </Text>
        </View>
      )}
      {!!resolvedEventId && <EventTimeline eventId={resolvedEventId} />}
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

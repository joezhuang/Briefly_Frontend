import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { trackProductEvent } from "@/analytics/product-analytics";
import {
  getBriefRepairStatus,
  getCanonicalArticleByEventId,
  getCanonicalArticleBySlug,
  getCanonicalArticleByVersionId,
  getExperimentalArticleByEventId,
  getExperimentalTranslationStatus,
  getLazyCanonicalArticleByEventId,
  getPodcastAnalysisStatus,
  requestBriefRepair,
  requestPodcastAnalysis,
  type BriefRepairStatus,
  type PodcastAnalysisStatus,
} from "@/api/briefly";
import {
  ArticleLanguageToggle,
  type ArticleLanguageMode,
} from "@/components/article-language-toggle";
import { ArticleView } from "@/components/article-view";
import { matchedBilingualOriginal } from "@/components/bilingual-reading";
import { EventPreviewView } from "@/components/event-preview-view";
import { EventCommunityPanel } from "@/components/event-community-panel";
import { EventTimeline } from "@/components/event-timeline";
import { RelatedStoriesCarousel } from "@/components/related-stories-carousel";
import { ScreenState } from "@/components/screen-state";
// Metro uses the native or web implementation, preserving the existing homepage install banner.
import { SharedAppChoice } from "@/components/shared-app-choice";
import { StaleStoryNotice } from "@/components/stale-story-notice";
// Metro resolves the platform-specific .native/.web implementation at runtime.
// eslint-disable-next-line import/no-unresolved
import { StoryAdSlot } from "@/components/story-ad-slot";
import { WebTranslateButton } from "@/components/web-translate-button";
import { useAnalysisReadiness } from "@/context/analysis-readiness";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyAppConfig } from "@/context/app-config";
import { useBrieflyLanguage } from "@/context/language";
import { useReadingHistory } from "@/context/reading-history";
import { useBrieflyTheme } from "@/context/theme";
import { useTranslationPreferences } from "@/context/translation-preferences";
import type { CanonicalArticle } from "@/models/article";
import { resolveFeatureAccess } from "@/subscriptions/feature-access";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";
const LAZY_ARTICLE_POLL_MS = 5000;
const PODCAST_POLL_MS = 5000;
const BILINGUAL_POLL_MS = 5000;
const BILINGUAL_MAX_POLLS = 24;

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

type BriefRepairState = {
  key: string;
  value: BriefRepairStatus | null;
};

type BilingualGenerationState = {
  key: string;
  status: "requesting" | "pending" | "failed" | "interrupted" | "unknown";
  attempts: number;
};

const bilingualGenerationCopy = {
  en: { translationTitle: "Translate story", translationExplanation: "The current English version has no translation yet. Generate it with Briefly Pro.", title: "Read in two languages", explanation: "A translation is not yet available for this English version. Generate it once with Briefly Pro, then read both languages together.", generate: "Generate translation", signIn: "Sign in to generate", upgrade: "Upgrade to generate", pending: "Preparing translation… English remains available.", failed: "Translation is not ready. Try again later.", retry: "Retry translation", check: "Check status", long: "This may take longer than two minutes. Check its status without generating again.", interrupted: "The translation was interrupted; you can explicitly retry." },
  es: { translationTitle: "Traducir noticia", translationExplanation: "La versión inglesa actual aún no tiene traducción. Genérala con Briefly Pro.", title: "Leer en dos idiomas", explanation: "Aún no hay una traducción para esta versión inglesa. Genérala con Briefly Pro para leer ambas.", generate: "Generar traducción", signIn: "Inicia sesión para generar", upgrade: "Mejora para generar", pending: "Preparando traducción… Puedes seguir leyendo en inglés.", failed: "La traducción aún no está lista. Inténtalo más tarde.", retry: "Reintentar traducción", check: "Comprobar estado", long: "Puede tardar más de dos minutos. Consulta el estado sin iniciar otra generación.", interrupted: "La traducción se interrumpió. Puedes reintentarlo." },
  ja: { translationTitle: "記事を翻訳", translationExplanation: "最新の英語版の翻訳はまだありません。Briefly Proで生成できます。", title: "二言語で読む", explanation: "この英語記事の翻訳はまだありません。Briefly Proで生成すると、両方の言語で読めます。", generate: "翻訳を生成", signIn: "ログインして生成", upgrade: "Proで生成", pending: "翻訳を準備中… 英語記事は引き続き読めます。", failed: "翻訳の準備ができませんでした。後でもう一度お試しください。", retry: "翻訳を再試行", check: "状態を確認", long: "2分以上かかる場合があります。新たな生成を開始せずに状態を確認できます。", interrupted: "翻訳が中断されました。再試行できます。" },
  "zh-CN": { translationTitle: "翻译报道", translationExplanation: "当前英文版本尚无译文。可使用 Briefly Pro 生成。", title: "双语阅读", explanation: "此英文版本尚无译文。使用 Briefly Pro 生成后即可双语阅读。", generate: "生成译文", signIn: "登录后生成", upgrade: "升级 Pro 后生成", pending: "正在准备译文… 可以继续阅读英文。", failed: "译文尚未就绪，请稍后重试。", retry: "重试翻译", check: "查看状态", long: "可能需要两分钟以上。查看状态不会再次触发生成。", interrupted: "译文生成中断，可手动重试。" },
  "zh-TW": { translationTitle: "翻譯報導", translationExplanation: "目前英文版本尚無譯文。可使用 Briefly Pro 產生。", title: "雙語閱讀", explanation: "此英文版本尚無譯文。使用 Briefly Pro 產生後即可雙語閱讀。", generate: "產生譯文", signIn: "登入後產生", upgrade: "升級 Pro 後產生", pending: "正在準備譯文… 可以繼續閱讀英文。", failed: "譯文尚未就緒，請稍後再試。", retry: "重試翻譯", check: "查看狀態", long: "可能需要兩分鐘以上。查看狀態不會再次觸發產生。", interrupted: "譯文產生中斷，可手動重試。" },
} as const;

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

function looksLikeDirectVideoUrl(value: string | null | undefined) {
  const url = String(value || "").toLowerCase();
  return /\.(mp4|m4v|mov|webm|m3u8)(?:$|[?#])/.test(url);
}

function applyStoryVideoSwitch(
  article: CanonicalArticle,
  enabled: boolean,
): CanonicalArticle {
  if (enabled) return article;
  const safeImage =
    article.video_thumbnail_url ||
    (!looksLikeDirectVideoUrl(article.image_url) ? article.image_url : null);
  return {
    ...article,
    video_url: null,
    videos: [],
    image_url: safeImage,
  };
}

function getStoryUrl(currentStoryHref: string): string | null {
  const configuredBase = process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL?.replace(/\/$/, "");
  if (configuredBase) return `${configuredBase}${currentStoryHref}`;

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.href;
  }

  return null;
}

function getGoogleTranslateStoryUrl(
  currentStoryHref: string,
  uiLanguage: string,
): string | null {
  const sourceUrl = getStoryUrl(currentStoryHref);
  if (!sourceUrl) return null;

  try {
    const url = new URL(sourceUrl);
    const supportedUiLanguage =
      uiLanguage === "en" ||
      uiLanguage === "es" ||
      uiLanguage === "ja" ||
      uiLanguage === "zh-CN" ||
      uiLanguage === "zh-TW"
        ? uiLanguage
        : "en";
    url.searchParams.set("ui", supportedUiLanguage);
    url.searchParams.set("content", "en");
    return url.toString();
  } catch {
    return sourceUrl;
  }
}

export default function StoryDetailScreen() {
  const {
    slug,
    eventId,
    imageUrl,
    previewHeadline,
    source,
    scope,
    community,
    autoplayVideo,
    videoTime,
    ui,
    content,
    read,
    mode,
    translationVersion,
    englishVersion,
  } = useLocalSearchParams<{
    slug?: string | string[];
    eventId?: string | string[];
    imageUrl?: string | string[];
    previewHeadline?: string | string[];
    source?: string | string[];
    scope?: string | string[];
    community?: string | string[];
    autoplayVideo?: string | string[];
    videoTime?: string | string[];
    ui?: string | string[];
    content?: string | string[];
    read?: string | string[];
    mode?: string | string[];
    translationVersion?: string | string[];
    englishVersion?: string | string[];
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
  const resolvedSource = useMemo(
    () => (Array.isArray(source) ? source[0] : source),
    [source],
  );
  const resolvedScope = useMemo(
    () => (Array.isArray(scope) ? scope[0] : scope),
    [scope],
  );
  const resolvedCommunity = useMemo(
    () => (Array.isArray(community) ? community[0] : community),
    [community],
  );
  const resolvedAutoplayVideo = useMemo(
    () => (Array.isArray(autoplayVideo) ? autoplayVideo[0] : autoplayVideo) === "1",
    [autoplayVideo],
  );
  const resolvedVideoTime = useMemo(() => {
    const raw = Array.isArray(videoTime) ? videoTime[0] : videoTime;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [videoTime]);
  const resolvedUi = useMemo(
    () => (Array.isArray(ui) ? ui[0] : ui),
    [ui],
  );
  const resolvedContentLanguage = useMemo(() => {
    const value = Array.isArray(content) ? content[0] : content;
    return value === "en" ||
      value === "es" ||
      value === "ja" ||
      value === "zh-CN" ||
      value === "zh-TW"
      ? value
      : null;
  }, [content]);
  const resolvedReadLanguage = useMemo(() => {
    const value = Array.isArray(read) ? read[0] : read;
    return typeof value === "string" &&
      /^[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(value)
      ? value
      : null;
  }, [read]);

  const requestedMode = (Array.isArray(mode) ? mode[0] : mode) === "bilingual" ? "bilingual" : null;
  const parsedTranslationVersion = Number(Array.isArray(translationVersion) ? translationVersion[0] : translationVersion);
  const parsedEnglishVersion = Number(Array.isArray(englishVersion) ? englishVersion[0] : englishVersion);
  const pinnedTranslationVersion =
    requestedMode === "bilingual" &&
    Number.isSafeInteger(parsedTranslationVersion) && parsedTranslationVersion > 0 &&
    Number.isSafeInteger(parsedEnglishVersion) && parsedEnglishVersion > 0
      ? parsedTranslationVersion
      : null;
  const pinnedEnglishVersion = pinnedTranslationVersion ? parsedEnglishVersion : null;

  const { language, t, setTransientLanguage } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const { autoTranslateStories, preferencesReady } = useTranslationPreferences();

  useEffect(() => {
    const supported =
      resolvedUi === "en" ||
      resolvedUi === "es" ||
      resolvedUi === "ja" ||
      resolvedUi === "zh-CN" ||
      resolvedUi === "zh-TW"
        ? resolvedUi
        : null;
    if (!supported) return;
    setTransientLanguage(supported);
    return () => setTransientLanguage(null);
  }, [resolvedUi, setTransientLanguage]);
  const { ready: authReady, user, account } = useBrieflyAuth();
  const { config: appConfig } = useBrieflyAppConfig();
  const { watchAnalysis, watchPodcast } = useAnalysisReadiness();
  const { recordArticle } = useReadingHistory();

  const [article, setArticle] = useState<CanonicalArticle | null>(null);
  const [authoritativeArticle, setAuthoritativeArticle] =
    useState<CanonicalArticle | null>(null);
  const [languageMode, setLanguageMode] =
    useState<ArticleLanguageMode>("localized");
  const [historicalOriginalState, setHistoricalOriginalState] = useState<{key: string; value: CanonicalArticle} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [podcastState, setPodcastState] = useState<PodcastState>({
    key: "",
    value: null,
  });
  const [podcastWatchKey, setPodcastWatchKey] = useState("");
  const [podcastBusyKey, setPodcastBusyKey] = useState("");
  const [briefRepairState, setBriefRepairState] = useState<BriefRepairState>({
    key: "",
    value: null,
  });
  const [briefRepairBusyKey, setBriefRepairBusyKey] = useState("");
  const [storyToolsExpanded, setStoryToolsExpanded] = useState(false);
  const [bilingualGeneration, setBilingualGeneration] = useState<BilingualGenerationState | null>(null);
  // One automatic request at most per user / immutable English version / language.
  const autoTranslationRequested = useRef(new Set<string>());
  const historyRecordedKey = useRef("");
  const storyOpenTrackedKey = useRef("");

  const isWeb = Platform.OS === "web";
  // Shared-link recipients should only read pre-existing translations. In
  // particular, a Pro recipient must not start local inference by opening X.
  const isSharedStory =
    resolvedSource === "share" || resolvedSource?.startsWith("share_") === true;
  const articleRequestLanguage = resolvedContentLanguage ?? language;
  const currentStoryHref = useMemo(() => {
    if (!resolvedSlug) return "/";
    const params = new URLSearchParams();
    if (resolvedEventId) params.set("eventId", resolvedEventId);
    if (resolvedImageUrl) params.set("imageUrl", resolvedImageUrl);
    if (resolvedPreviewHeadline) {
      params.set("previewHeadline", resolvedPreviewHeadline);
    }
    if (resolvedSource) params.set("source", resolvedSource);
    if (resolvedScope) params.set("scope", resolvedScope);
    if (resolvedUi) params.set("ui", resolvedUi);
    if (resolvedContentLanguage) {
      params.set("content", resolvedContentLanguage);
    }
    if (resolvedReadLanguage) params.set("read", resolvedReadLanguage);
    if (pinnedTranslationVersion != null && pinnedEnglishVersion != null) {
      params.set("mode", "bilingual");
      params.set("translationVersion", String(pinnedTranslationVersion));
      params.set("englishVersion", String(pinnedEnglishVersion));
    }
    const query = params.toString();
    return `/story/${encodeURIComponent(resolvedSlug)}${query ? `?${query}` : ""}`;
  }, [
    resolvedEventId,
    resolvedImageUrl,
    resolvedPreviewHeadline,
    resolvedScope,
    resolvedSource,
    resolvedSlug,
    resolvedUi,
    resolvedContentLanguage,
    resolvedReadLanguage,
    pinnedTranslationVersion,
    pinnedEnglishVersion,
  ]);
  const translateSourceUrl = getGoogleTranslateStoryUrl(
    currentStoryHref,
    language,
  );
  const requestKey = `${resolvedSlug ?? ""}:${resolvedEventId ?? ""}:${resolvedScope ?? ""}:${articleRequestLanguage}:${language}:${pinnedTranslationVersion ?? ""}:${reloadKey}`;
  const loading = loadingKey !== requestKey && !error && !article;
  const isPro = account?.translation_entitled === true;
  const videoAccess = resolveFeatureAccess(appConfig, "video", {
    signedIn: !!user,
    isPro,
  });
  const podcastAccess = resolveFeatureAccess(appConfig, "podcast", {
    signedIn: !!user,
    isPro,
  });
  const storyRefreshAccess = resolveFeatureAccess(appConfig, "story_refresh", {
    signedIn: !!user,
    isPro,
  });
  const storyVideoEnabled =
    appConfig?.story_video_enabled !== false && videoAccess.mode !== "disabled";
  const floatingVideoEnabled = appConfig?.floating_video_enabled !== false;
  const communityEnabled = appConfig?.community_enabled !== false;
  const evidenceEnabled = appConfig?.evidence_enabled !== false;
  const timelineEnabled = appConfig?.timeline_enabled !== false;
  const coverageEnabled = appConfig?.coverage_enabled !== false;
  const podcastEnabled =
    appConfig?.podcast_enabled !== false && podcastAccess.mode !== "disabled";
  const translationEnabled = appConfig?.translation_enabled !== false;
  const bilingualReaderFeatureEnabled =
    appConfig?.bilingual_reader_enabled === true && translationEnabled;
  const followingEnabled = appConfig?.following_enabled !== false;
  const bilingualGenerationKey =
    authoritativeArticle?.article_version_id != null && resolvedEventId && articleRequestLanguage !== "en"
      ? `${resolvedEventId}:${authoritativeArticle.article_version_id}:${articleRequestLanguage}`
      : null;
  const activeBilingualGeneration = bilingualGeneration?.key === bilingualGenerationKey
    ? bilingualGeneration
    : null;
  const showStoryAd =
    !isWeb &&
    appConfig?.ads_enabled === true &&
    appConfig.story_ad_enabled === true &&
    appConfig.ad_provider === "admob" &&
    !(appConfig.ads_free_for_pro && isPro);
  const podcastSourceVersionId =
    authoritativeArticle?.article_version_id ??
    article?.authoritative_article_version_id ??
    article?.article_version_id ??
    null;
  const podcastRequestKey =
    podcastSourceVersionId
      ? `${podcastSourceVersionId}:${language}`
      : "";
  const podcast =
    podcastState.key === podcastRequestKey ? podcastState.value : null;
  const podcastBusy =
    !!podcastRequestKey && podcastBusyKey === podcastRequestKey;
  const briefRepairArticleVersionId =
    authoritativeArticle?.article_version_id ??
    ((article?.content_language ?? article?.language) === "en"
      ? article?.article_version_id
      : null) ??
    null;
  const briefRepairKey = briefRepairArticleVersionId
    ? String(briefRepairArticleVersionId)
    : "";
  const briefRepair =
    briefRepairState.key === briefRepairKey ? briefRepairState.value : null;
  const briefRepairBusy =
    !!briefRepairKey && briefRepairBusyKey === briefRepairKey;

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
        // A non-English shared story should open its existing, version-matched
        // Bilingual pair by default. A missing/publicly unavailable pair still
        // falls back to Localized via bilingualEnabled; shares never generate.
        // The "read" language alone is not proof of a cached translation.
        setLanguageMode(
          requestedMode === "bilingual" ||
          (isSharedStory && articleRequestLanguage !== "en" && bilingualReaderFeatureEnabled)
            ? "bilingual"
            : "localized",
        );
      }

      try {
        let result: CanonicalArticle;

        if (resolvedEventId) {
          const canonicalResponse = await getLazyCanonicalArticleByEventId(
            resolvedEventId,
            {
              includeDraft: PREVIEW_DRAFTS,
              language: articleRequestLanguage,
              includeVideos: true,
              prepare: !isSharedStory,
              sourceScope:
                resolvedScope === "top" ||
                resolvedScope === "national" ||
                resolvedScope === "local"
                  ? resolvedScope
                  : undefined,
            },
          );

          const canonical = preferredImage(canonicalResponse, resolvedImageUrl);

          if (!active) return;

          // Published shared translations can outlive the publication
          // state of the English article that originally produced them.
          const canLoadPublishedSharedTranslation =
            isSharedStory && articleRequestLanguage !== "en";
          if (
            canonical.article_version_id == null &&
            !canLoadPublishedSharedTranslation
          ) {
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

          setAuthoritativeArticle(
            canonical.article_version_id == null ? null : canonical,
          );

          if (articleRequestLanguage !== "en") {
            if (isWeb && !resolvedContentLanguage && !bilingualReaderFeatureEnabled) {
              try {
                const localized = await getCanonicalArticleByEventId(
                  resolvedEventId,
                  {
                    includeDraft: PREVIEW_DRAFTS,
                    language: articleRequestLanguage,
                    includeVideos: true,
                  },
                );
                result =
                  localized.content_language === articleRequestLanguage
                    ? {
                        ...preferredImage(
                          localized,
                          resolvedImageUrl ?? canonical.image_url ?? undefined,
                        ),
                        video_url: localized.video_url ?? canonical.video_url,
                        video_thumbnail_url:
                          localized.video_thumbnail_url ?? canonical.video_thumbnail_url,
                        videos:
                          localized.videos?.length
                            ? localized.videos
                            : canonical.videos,
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
                  language: articleRequestLanguage,
                  prepare: false,
                  translationVersionId: pinnedTranslationVersion,
                  englishVersionId: pinnedEnglishVersion,
                },
              );
              result = {
                ...preferredImage(
                  localized,
                  resolvedImageUrl ?? canonical.image_url ?? undefined,
                ),
                video_url: localized.video_url ?? canonical.video_url,
                video_thumbnail_url:
                  localized.video_thumbnail_url ?? canonical.video_thumbnail_url,
                videos:
                  localized.videos?.length ? localized.videos : canonical.videos,
                canonical_stale: canonical.canonical_stale,
                latest_evidence_at: canonical.latest_evidence_at,
                stale_refresh_entitled: canonical.stale_refresh_entitled,
                generation_status:
                  canonical.article_version_id == null
                    ? localized.generation_status
                    : canonical.generation_status,
              };
              // An older translation belongs to its earlier English version.
              // Never display it as if it translated the latest edition.
              // Historical / pinned shared pairs remain independently readable.
              if (!isSharedStory && !pinnedTranslationVersion &&
                  localized.translation_historical === true) {
                result = canonical;
              }
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
            includeVideos: true,
          });
          result = preferredImage(canonicalBySlug, resolvedImageUrl);
        }

        if (!active) return;

        setArticle(result);
        setLoadingKey(requestKey);
        setError(null);

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
    resolvedScope,
    resolvedContentLanguage,
    pinnedTranslationVersion,
    pinnedEnglishVersion,
    requestedMode,
    language,
    articleRequestLanguage,
    isWeb,
    isSharedStory,
    bilingualReaderFeatureEnabled,
    reloadKey,
    requestKey,
    t.storyUnavailable,
    currentStoryHref,
    watchAnalysis,
  ]);


  // A cached older translation can be paired only with its immutable, publicly
  // published English source. This fetch never requests generation or drafts.
  const oldEnglishSourceId =
    bilingualReaderFeatureEnabled &&
    article?.translation_historical === true &&
    article.translation_source_article_version_id != null &&
    article.translation_source_article_version_id !== authoritativeArticle?.article_version_id
      ? article.translation_source_article_version_id
      : null;
  const historicalEnglishKey = oldEnglishSourceId && article?.event_id
    ? `${article.event_id}:${oldEnglishSourceId}`
    : null;
  const historicalOriginal = historicalEnglishKey === historicalOriginalState?.key
    ? historicalOriginalState.value
    : null;

  useEffect(() => {
    if (!historicalEnglishKey || !oldEnglishSourceId) return;
    let active = true;
    void getCanonicalArticleByVersionId(oldEnglishSourceId, { includeDraft: false })
      .then((value) => {
        if (active && value.status === "published" && value.article_version_id === oldEnglishSourceId) {
          setHistoricalOriginalState({key: historicalEnglishKey, value});
        }
      })
      .catch(() => {
        // Source may be unpublished or unavailable; never display a false pair.
      });
    return () => { active = false; };
  }, [historicalEnglishKey, oldEnglishSourceId]);

  // A Pro story open may start a missing translation, but only after a
  // read-only status lookup proves no matching version/job exists.
  // Shared links, pinned historical pairs and user-selected English are never
  // automatic generation triggers.
  useEffect(() => {
    if (!preferencesReady || !autoTranslateStories || !user || !isPro ||
        !translationEnabled || !resolvedEventId || !bilingualGenerationKey ||
        !authoritativeArticle?.article_version_id || authoritativeArticle.status !== "published" ||
        !article || article.event_id !== resolvedEventId ||
        authoritativeArticle.event_id !== resolvedEventId ||
        article.canonical_stale || isSharedStory || pinnedTranslationVersion ||
        articleRequestLanguage === "en" || resolvedContentLanguage === "en" ||
        languageMode === "original" ||
        (article.content_language ?? article.language) !== "en") return;

    const requestId = `${user.id}:${bilingualGenerationKey}`;
    if (autoTranslationRequested.current.has(requestId)) return;
    let active = true;
    const english = authoritativeArticle;

    void getExperimentalTranslationStatus(
      resolvedEventId, english.article_version_id!, articleRequestLanguage,
    ).then(async (job) => {
      if (!active || job.status !== "not_requested" ||
          autoTranslationRequested.current.has(requestId)) return;
      autoTranslationRequested.current.add(requestId);
      setBilingualGeneration({ key: bilingualGenerationKey, status: "requesting", attempts: 0 });
      try {
        const localized = await getExperimentalArticleByEventId(resolvedEventId, {
          includeDraft: false, language: articleRequestLanguage, prepare: true,
        });
        if (!active) return;
        if (matchedBilingualOriginal(localized, english)) {
          setArticle((current) => current ? {
            ...localized,
            image_url: current.image_url,
            video_url: current.video_url,
            video_thumbnail_url: current.video_thumbnail_url,
            videos: current.videos,
            canonical_stale: current.canonical_stale,
            latest_evidence_at: current.latest_evidence_at,
            stale_refresh_entitled: current.stale_refresh_entitled,
          } : localized);
          setBilingualGeneration(null);
        } else {
          setBilingualGeneration({
            key: bilingualGenerationKey,
            status: localized.translation_status === "pending" &&
              localized.translation_entitled === true ? "pending" : "unknown",
            attempts: 0,
          });
        }
      } catch {
        // Uncertain network outcome: check status manually; never auto-retry.
        if (active) setBilingualGeneration({
          key: bilingualGenerationKey, status: "unknown", attempts: 0,
        });
      }
    }).catch(() => {
      // A failed read-only status check must not schedule inference.
      if (active) setBilingualGeneration({
        key: bilingualGenerationKey, status: "unknown", attempts: 0,
      });
    });
    return () => { active = false; };
  }, [
    preferencesReady, autoTranslateStories, user, isPro, translationEnabled,
    resolvedEventId, bilingualGenerationKey, authoritativeArticle, article,
    isSharedStory, pinnedTranslationVersion, articleRequestLanguage,
    resolvedContentLanguage, languageMode,
  ]);

  // Durable read-only status allows a reader to leave and return later.
  // A status check never asks the backend to generate another translation.
  useEffect(() => {
    if (!translationEnabled || (!bilingualReaderFeatureEnabled && !isPro) ||
        !bilingualGenerationKey || !resolvedEventId ||
        !authoritativeArticle?.article_version_id ||
        isSharedStory || pinnedTranslationVersion ||
        !article || article.event_id !== resolvedEventId ||
        (article.content_language ?? article.language) !== "en") return;
    let active = true;
    void getExperimentalTranslationStatus(
      resolvedEventId, authoritativeArticle.article_version_id, articleRequestLanguage,
    ).then(async (job) => {
      if (!active) return;
      if (job.status === "ready") {
        const localized = await getExperimentalArticleByEventId(resolvedEventId, {
          includeDraft: PREVIEW_DRAFTS, language: articleRequestLanguage, prepare: false,
        });
        if (!active) return;
        if (matchedBilingualOriginal(localized, authoritativeArticle)) {
          setArticle((current) => current ? {
            ...localized,
            image_url: current.image_url,
            video_url: current.video_url,
            video_thumbnail_url: current.video_thumbnail_url,
            videos: current.videos,
            canonical_stale: current.canonical_stale,
            latest_evidence_at: current.latest_evidence_at,
            stale_refresh_entitled: current.stale_refresh_entitled,
          } : localized);
          // A normal story open defaults to Localized; preserve chosen modes.
          setBilingualGeneration(null);
        }
      } else if (job.status !== "not_requested") {
        setBilingualGeneration({
          key: bilingualGenerationKey,
          status: job.status === "queued" || job.status === "processing"
            ? "pending" : job.status === "failed" || job.status === "interrupted"
              ? job.status : "unknown",
          attempts: 0,
        });
      }
    }).catch(() => {
      // A pre-migration backend may not expose job status. English remains readable.
    });
    return () => { active = false; };
  }, [
    bilingualReaderFeatureEnabled, translationEnabled, isPro, bilingualGenerationKey,
    resolvedEventId, authoritativeArticle,
    articleRequestLanguage, isSharedStory, pinnedTranslationVersion,
    article,
  ]);

  // Polling only retrieves durable status; it never starts a translation.
  useEffect(() => {
    if (!translationEnabled || !bilingualGenerationKey ||
        activeBilingualGeneration?.status !== "pending" ||
        !authoritativeArticle || !resolvedEventId || isSharedStory ||
        pinnedTranslationVersion) return;

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const job = await getExperimentalTranslationStatus(
          resolvedEventId, authoritativeArticle.article_version_id!,
          articleRequestLanguage,
        );
        if (!active) return;
        if (job.status === "failed" || job.status === "interrupted") {
          setBilingualGeneration((current) => current?.key === bilingualGenerationKey
            ? { ...current, status: job.status === "failed" ? "failed" : "interrupted" }
            : current);
          return;
        }
        if (job.status === "ready") {
          const localized = await getExperimentalArticleByEventId(resolvedEventId, {
            includeDraft: PREVIEW_DRAFTS,
            language: articleRequestLanguage,
            prepare: false,
          });
          if (!active) return;
          if (matchedBilingualOriginal(localized, authoritativeArticle)) {
            setArticle((current) => current ? {
              ...localized,
              image_url: current.image_url,
              video_url: current.video_url,
              video_thumbnail_url: current.video_thumbnail_url,
              videos: current.videos,
              canonical_stale: current.canonical_stale,
              latest_evidence_at: current.latest_evidence_at,
              stale_refresh_entitled: current.stale_refresh_entitled,
            } : localized);
            setBilingualGeneration(null);
            return;
          }
        }
      } catch {
        // Backend may be temporarily unavailable. Never report a model failure
        // from a network error or start another translation in a polling request.
      }
      if (active) {
        setBilingualGeneration((current) =>
          current?.key === bilingualGenerationKey && current.status === "pending"
            ? {
                ...current,
                attempts: current.attempts + 1,
                status: current.attempts + 1 >= BILINGUAL_MAX_POLLS
                  ? "unknown" : "pending",
              }
            : current,
        );
      }
    }, BILINGUAL_POLL_MS);

    return () => { active = false; clearTimeout(timer); };
  }, [
    activeBilingualGeneration?.status,
    activeBilingualGeneration?.attempts,
    bilingualGenerationKey,
    translationEnabled,
    authoritativeArticle,
    resolvedEventId,
    articleRequestLanguage,
    isSharedStory,
    pinnedTranslationVersion,
  ]);

  const requestBilingualTranslation = async () => {
    if (!bilingualGenerationKey || !resolvedEventId || !authoritativeArticle ||
        !translationEnabled || isSharedStory || pinnedTranslationVersion ||
        activeBilingualGeneration?.status === "pending" ||
        activeBilingualGeneration?.status === "requesting") return;

    if (!user) {
      router.push(`/sign-in?returnTo=${encodeURIComponent(currentStoryHref)}` as never);
      return;
    }
    if (!isPro) {
      router.push(`/upgrade?returnTo=${encodeURIComponent(currentStoryHref)}` as never);
      return;
    }

    // When the status is uncertain, the button is read-only, not a retry.
    if (activeBilingualGeneration?.status === "unknown") {
      try {
        const job = await getExperimentalTranslationStatus(
          resolvedEventId, authoritativeArticle.article_version_id!,
          articleRequestLanguage,
        );
        if (job.status === "ready") {
          const localized = await getExperimentalArticleByEventId(resolvedEventId, {
            includeDraft: PREVIEW_DRAFTS, language: articleRequestLanguage, prepare: false,
          });
          if (matchedBilingualOriginal(localized, authoritativeArticle)) {
            setArticle((current) => current ? {
              ...localized,
              image_url: current.image_url,
              video_url: current.video_url,
              video_thumbnail_url: current.video_thumbnail_url,
              videos: current.videos,
              canonical_stale: current.canonical_stale,
              latest_evidence_at: current.latest_evidence_at,
              stale_refresh_entitled: current.stale_refresh_entitled,
            } : localized);
            setLanguageMode("bilingual");
            setBilingualGeneration(null);
            return;
          }
        }
        setBilingualGeneration(job.status === "not_requested" ? null : {
          key: bilingualGenerationKey,
          status: job.status === "queued" || job.status === "processing"
            ? "pending" : job.status === "failed" || job.status === "interrupted"
              ? job.status : "unknown",
          attempts: 0,
        });
      } catch {
        // Keep the uncertainty visible; never silently regenerate on failure.
      }
      return;
    }

    setBilingualGeneration({ key: bilingualGenerationKey, status: "requesting", attempts: 0 });
    try {
      const localized = await getExperimentalArticleByEventId(resolvedEventId, {
        includeDraft: PREVIEW_DRAFTS,
        language: articleRequestLanguage,
        prepare: true,
      });
      if (matchedBilingualOriginal(localized, authoritativeArticle)) {
        setArticle((current) => current ? {
          ...localized,
          image_url: current.image_url,
          video_url: current.video_url,
          video_thumbnail_url: current.video_thumbnail_url,
          videos: current.videos,
          canonical_stale: current.canonical_stale,
          latest_evidence_at: current.latest_evidence_at,
          stale_refresh_entitled: current.stale_refresh_entitled,
        } : localized);
        setLanguageMode("bilingual");
        setBilingualGeneration(null);
      } else {
        setBilingualGeneration({
          key: bilingualGenerationKey,
          status: localized.translation_status === "pending" && localized.translation_entitled === true
            ? "pending" : "unknown",
          attempts: 0,
        });
      }
    } catch {
      // Network failures do not mean the job failed. Check the durable status.
      setBilingualGeneration({ key: bilingualGenerationKey, status: "unknown", attempts: 0 });
    }
  };

  useEffect(() => {
    if (!article || !article.event_id) return;

    const historyKey = `${article.event_id}:${currentStoryHref}`;
    if (historyRecordedKey.current === historyKey) return;

    historyRecordedKey.current = historyKey;
    void recordArticle(article, currentStoryHref);
  }, [article, currentStoryHref, recordArticle]);

  useEffect(() => {
    if (!article || article.article_version_id == null) return;

    const versionId =
      authoritativeArticle?.article_version_id ??
      article.authoritative_article_version_id ??
      article.article_version_id;
    const eventIdValue = article.event_id || resolvedEventId || null;
    const acquisitionSource = resolvedSource || "direct";
    const openKey = `${eventIdValue ?? "none"}:${versionId}:${acquisitionSource}`;

    if (storyOpenTrackedKey.current === openKey) return;
    storyOpenTrackedKey.current = openKey;

    trackProductEvent("story_open", {
      eventId: eventIdValue,
      articleVersionId: versionId,
      properties: {
        source: acquisitionSource,
        scope: resolvedScope ?? null,
        language,
        content_language: article.content_language ?? article.language,
        canonical_stale: article.canonical_stale === true,
      },
    });
  }, [
    article,
    authoritativeArticle?.article_version_id,
    language,
    resolvedEventId,
    resolvedScope,
    resolvedSource,
  ]);

  useEffect(() => {
    if (!briefRepairArticleVersionId || !authReady) return;

    let active = true;
    const key = String(briefRepairArticleVersionId);

    void getBriefRepairStatus(briefRepairArticleVersionId)
      .then((value) => {
        if (active) setBriefRepairState({ key, value });
      })
      .catch(() => {
        if (active) setBriefRepairState({ key, value: null });
      });

    return () => {
      active = false;
    };
  }, [authReady, briefRepairArticleVersionId, reloadKey]);

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
    const analyticsBase = {
      eventId: article?.event_id ?? resolvedEventId ?? null,
      articleVersionId: podcastSourceVersionId,
    };

    if (!user) {
      trackProductEvent("podcast_action", {
        ...analyticsBase,
        properties: { action: "sign_in", language, surface: "story" },
      });
      router.push(
        `/sign-in?returnTo=${encodeURIComponent(currentStoryHref)}` as never,
      );
      return;
    }
    if (!podcastAccess.allowed) {
      const action = podcastAccess.gate === "sign_in" ? "sign_in" : "upgrade";
      trackProductEvent("podcast_action", {
        ...analyticsBase,
        properties: { action, language, surface: "story" },
      });
      if (podcastAccess.gate === "sign_in") {
        router.push(
          `/sign-in?returnTo=${encodeURIComponent(currentStoryHref)}` as never,
        );
      } else {
        router.push(
          `/upgrade?returnTo=${encodeURIComponent(currentStoryHref)}` as never,
        );
      }
      return;
    }
    if (!podcastSourceVersionId || !podcastRequestKey || podcastBusy) return;

    trackProductEvent("podcast_action", {
      ...analyticsBase,
      properties: {
        action: podcast?.status === "failed" ? "retry" : "generate",
        language,
        surface: "story",
      },
    });

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

  const handleBriefRepair = async () => {
    if (!briefRepairArticleVersionId || briefRepairBusy) return;

    if (!user) {
      router.push(
        `/sign-in?returnTo=${encodeURIComponent(currentStoryHref)}` as never,
      );
      return;
    }

    const key = String(briefRepairArticleVersionId);
    setBriefRepairBusyKey(key);
    try {
      await requestBriefRepair(briefRepairArticleVersionId);
      setReloadKey((value) => value + 1);
    } catch (err: unknown) {
      Alert.alert(
        "Briefly",
        err instanceof Error
          ? err.message
          : "Briefly could not repair the missing summary sections.",
      );
      void getBriefRepairStatus(briefRepairArticleVersionId)
        .then((value) => setBriefRepairState({ key, value }))
        .catch(() => null);
    } finally {
      setBriefRepairBusyKey((current) => (current === key ? "" : current));
    }
  };

  if (!authReady || loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState loading message={t.loadingStory} />
      </SafeAreaView>
    );
  }

  if (appConfig?.maintenance_mode) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState
          title="Briefly is temporarily unavailable"
          message={appConfig.maintenance_message ?? "We are carrying out a short maintenance update. Please try again soon."}
        />
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
    const previewArticle = applyStoryVideoSwitch(
      preferredPreviewHeadline(
        preferredImage(article, resolvedImageUrl),
        resolvedPreviewHeadline,
      ),
      storyVideoEnabled,
    );
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {isSharedStory && !!resolvedEventId && (
        <SharedAppChoice
          appPath={`/s/${resolvedEventId}`}
          uiLanguage={resolvedUi ?? language}
          contentLanguage={resolvedContentLanguage}
          readingLanguage={resolvedReadLanguage}
          bilingualTranslationVersionId={pinnedTranslationVersion}
          bilingualEnglishVersionId={pinnedEnglishVersion}
        />
      )}
        <EventPreviewView
          article={previewArticle}
          videoAccess={videoAccess}
          signedIn={!!user}
          sourceScope={
            resolvedScope === "top" ||
            resolvedScope === "national" ||
            resolvedScope === "local"
              ? resolvedScope
              : undefined
          }
          onRetry={
            article.generation_status === "processing" ||
            article.generation_status === "source_only"
              ? undefined
              : () => setReloadKey((value) => value + 1)
          }
        />
      </SafeAreaView>
    );
  }

  const matchedEnglishArticle =
    matchedBilingualOriginal(article, authoritativeArticle) ??
    matchedBilingualOriginal(article, historicalOriginal);
  const showBilingualGeneration =
    translationEnabled &&
    (bilingualReaderFeatureEnabled || isPro) &&
    !isSharedStory &&
    !article.canonical_stale &&
    !!resolvedEventId &&
    !!bilingualGenerationKey &&
    articleRequestLanguage !== "en" &&
    (article.content_language ?? article.language) === "en" &&
    matchedEnglishArticle === null;
  const bilingualGenerationText = bilingualGenerationCopy[language] ?? bilingualGenerationCopy.en;
  const bilingualGenerationBusy = activeBilingualGeneration?.status === "requesting" ||
    activeBilingualGeneration?.status === "pending";
  const bilingualEnabled =
    appConfig?.bilingual_reader_enabled === true &&
    translationEnabled &&
    matchedEnglishArticle !== null;
  const canToggleOriginal =
    bilingualEnabled || (
    translationEnabled &&
    !article.canonical_stale &&
    !isWeb &&
    language !== "en" &&
    article.experimental_localization === true &&
    authoritativeArticle?.article_version_id != null);
  const effectiveLanguageMode = languageMode === "bilingual" && !bilingualEnabled
    ? "localized"
    : languageMode;
  const displayedArticle = applyStoryVideoSwitch(
    preferredImage(
      canToggleOriginal && effectiveLanguageMode === "original" && authoritativeArticle
        ? authoritativeArticle
        : article,
      resolvedImageUrl,
    ),
    storyVideoEnabled,
  );
  const showGoogleTranslate =
    translationEnabled && !!translateSourceUrl;
  const storyToolsText = storyToolsCopy[language] ?? storyToolsCopy.en;
  const earlierVersion =
    effectiveLanguageMode === "bilingual" && bilingualEnabled &&
    matchedEnglishArticle?.article_version_id != null &&
    authoritativeArticle?.article_version_id != null &&
    matchedEnglishArticle.article_version_id !== authoritativeArticle.article_version_id;
  const earlierNoticeText = {
    en: { title: "Earlier translation and English source", body: "Both languages refer to the same earlier published version. Newer developments may be missing.", latest: "Read latest English" },
    es: { title: "Traducción y original de una versión anterior", body: "Ambos idiomas corresponden a la misma versión publicada anteriormente. Puede haber novedades.", latest: "Leer el inglés más reciente" },
    ja: { title: "翻訳と原文は以前の版です", body: "両方とも同じ公開済みの旧版です。最新の進展は含まれていない場合があります。", latest: "最新の英語版を読む" },
    "zh-CN": { title: "译文和英文原文均为较早版本", body: "两种语言均对应同一已发布的旧版，可能未包含最新进展。", latest: "阅读最新英文版" },
    "zh-TW": { title: "譯文和英文原文均為較早版本", body: "兩種語言均對應同一已發布的舊版，可能未包含最新進展。", latest: "閱讀最新英文版" },
  }[language] ?? {
    title: "Earlier translation and English source",
    body: "Both languages refer to the same earlier published version. Newer developments may be missing.",
    latest: "Read latest English",
  };
  const latestEnglishHref = `/story/${encodeURIComponent(authoritativeArticle?.slug ?? displayedArticle.slug)}?eventId=${encodeURIComponent(displayedArticle.event_id)}&source=story&ui=${encodeURIComponent(language)}&content=en&read=en`;


  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.surface }}
    >
      {isSharedStory && !!resolvedEventId && (
        <SharedAppChoice
          appPath={`/s/${resolvedEventId}`}
          uiLanguage={resolvedUi ?? language}
          contentLanguage={resolvedContentLanguage}
          readingLanguage={resolvedReadLanguage}
          bilingualTranslationVersionId={pinnedTranslationVersion}
          bilingualEnglishVersionId={pinnedEnglishVersion}
        />
      )}
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
            <StaleStoryNotice article={displayedArticle} />
            {timelineEnabled && !!resolvedEventId && (
              <EventTimeline
                eventId={resolvedEventId}
                refreshKey={
                  displayedArticle.authoritative_article_version_id ??
                  displayedArticle.article_version_id ??
                  reloadKey
                }
                canonicalStale={displayedArticle.canonical_stale === true}
                access={storyRefreshAccess}
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
        refreshKey={
          displayedArticle.authoritative_article_version_id ??
          displayedArticle.article_version_id ??
          reloadKey
        }
        focusCommunity={resolvedCommunity === "1"}
        autoStartVideo={videoAccess.allowed && resolvedAutoplayVideo}
        initialVideoTime={resolvedVideoTime}
        shareHref={currentStoryHref}
        podcast={podcastEnabled ? podcast : null}
        podcastBusy={podcastEnabled && podcastBusy}
        podcastAccess={podcastAccess}
        podcastSignedIn={!!user}
        onPodcastAction={podcastEnabled ? () => void handlePodcastAction() : undefined}
        podcastEnabled={podcastEnabled}
        translationEnabled={translationEnabled}
        bilingualOriginal={effectiveLanguageMode === "bilingual" && bilingualEnabled ? matchedEnglishArticle : null}
        bilingualLatestEnglishVersionId={authoritativeArticle?.article_version_id ?? null}
        shareBilingualPair={
          effectiveLanguageMode === "bilingual" && matchedEnglishArticle &&
          article.status === "published" && matchedEnglishArticle.status === "published" &&
          article.article_version_id != null && matchedEnglishArticle.article_version_id != null
            ? {
                translationVersionId: article.article_version_id,
                englishVersionId: matchedEnglishArticle.article_version_id,
              }
            : null
        }
        readingModeAction={canToggleOriginal ? (
          <ArticleLanguageToggle
            mode={effectiveLanguageMode}
            onChange={setLanguageMode}
            includeBilingual={bilingualEnabled}
          />
        ) : undefined}
        bilingualVersionNotice={earlierVersion ? (
          <View style={[styles.earlierVersionNotice, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.earlierVersionTitle, { color: colors.text }]}>
              {earlierNoticeText.title} · v{matchedEnglishArticle?.version_number ?? matchedEnglishArticle?.article_version_id}
            </Text>
            <Text style={[styles.earlierVersionBody, { color: colors.textMuted }]}>
              {earlierNoticeText.body}
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(latestEnglishHref as never)}
              style={styles.earlierVersionLink}
            >
              <Text style={[styles.earlierVersionLinkText, { color: colors.accent }]}>
                {earlierNoticeText.latest} →
              </Text>
            </Pressable>
          </View>
        ) : undefined}
        bilingualGenerationAction={showBilingualGeneration ? (
          <View style={[styles.bilingualPrompt, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.bilingualPromptTitle, { color: colors.text }]}>
              {bilingualReaderFeatureEnabled ? bilingualGenerationText.title : bilingualGenerationText.translationTitle}
            </Text>
            <Text style={[styles.bilingualPromptDescription, { color: colors.textMuted }]}>
              {activeBilingualGeneration?.status === "pending" ||
                activeBilingualGeneration?.status === "requesting"
                ? bilingualGenerationText.pending
                : bilingualReaderFeatureEnabled ? bilingualGenerationText.explanation : bilingualGenerationText.translationExplanation}
            </Text>
            {(activeBilingualGeneration?.status === "failed" ||
              activeBilingualGeneration?.status === "interrupted" ||
              activeBilingualGeneration?.status === "unknown") && (
              <Text style={[styles.bilingualPromptDescription, { color: colors.accent }]}>
                {activeBilingualGeneration.status === "failed"
                  ? bilingualGenerationText.failed
                  : activeBilingualGeneration.status === "interrupted"
                    ? bilingualGenerationText.interrupted
                    : bilingualGenerationText.long}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: bilingualGenerationBusy }}
              disabled={bilingualGenerationBusy}
              onPress={() => void requestBilingualTranslation()}
              style={[styles.bilingualPromptButton, {
                backgroundColor: colors.text,
                opacity: bilingualGenerationBusy ? 0.6 : 1,
              }]}
            >
              <Text style={[styles.bilingualPromptButtonText, { color: colors.background }]}>
                {bilingualGenerationBusy
                  ? bilingualGenerationText.pending
                  : !user
                    ? bilingualGenerationText.signIn
                    : !isPro
                      ? bilingualGenerationText.upgrade
                      : activeBilingualGeneration?.status === "failed" ||
                        activeBilingualGeneration?.status === "interrupted"
                          ? bilingualGenerationText.retry
                          : activeBilingualGeneration?.status === "unknown"
                            ? bilingualGenerationText.check
                            : bilingualGenerationText.generate}
              </Text>
            </Pressable>
          </View>
        ) : undefined}
        evidenceEnabled={evidenceEnabled}
        timelineEnabled={timelineEnabled}
        coverageEnabled={coverageEnabled}
        followingEnabled={followingEnabled}
        videoAccess={videoAccess}
        floatingVideoEnabled={videoAccess.allowed && floatingVideoEnabled}
        briefRepair={
          (displayedArticle.content_language ?? displayedArticle.language) === "en"
            ? briefRepair
            : null
        }
        briefRepairBusy={briefRepairBusy}
        onBriefRepair={() => void handleBriefRepair()}
        translationAction={
          showGoogleTranslate && translateSourceUrl ? (
            <WebTranslateButton
              sourceUrl={translateSourceUrl}
              contentLanguage={
                displayedArticle.content_language ?? displayedArticle.language
              }
              initialReadingLanguage={resolvedReadLanguage}
            />
          ) : undefined
        }
        community={
          communityEnabled && !!displayedArticle.event_id ? (
            <EventCommunityPanel
              eventId={displayedArticle.event_id}
              returnTo={currentStoryHref}
            />
          ) : undefined
        }
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
  bilingualPrompt: { borderWidth: StyleSheet.hairlineWidth, padding: 16, borderRadius: 16, gap: 10 },
  earlierVersionNotice: { borderWidth: StyleSheet.hairlineWidth, padding: 14, borderRadius: 12, gap: 7 },
  earlierVersionTitle: { fontSize: 15, fontWeight: "800" },
  earlierVersionBody: { fontSize: 13, lineHeight: 19 },
  earlierVersionLink: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  earlierVersionLinkText: { fontSize: 13, fontWeight: "800" },
  bilingualPromptTitle: { fontSize: 17, fontWeight: "800" },
  bilingualPromptDescription: { fontSize: 13, lineHeight: 20 },
  bilingualPromptButton: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, alignSelf: "flex-start", justifyContent: "center" },
  bilingualPromptButtonText: { fontSize: 13, fontWeight: "800" },
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
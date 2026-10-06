import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";
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
import {
  matchedBilingualOriginal,
  translationMatchesEnglishVersion,
} from "@/components/bilingual-reading";
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
const SHARED_LOGIN_NUDGE_DELAY_MS = 15_000;
const NORMAL_WEB_LOGIN_NUDGE_DELAY_MS = 60_000;
const NORMAL_WEB_STORY_OPEN_THRESHOLD = 2;
const NORMAL_NATIVE_STORY_OPEN_THRESHOLD = 3;
const LOGIN_NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_NUDGE_REPEAT_COOLDOWN_MS = 30 * 60 * 1000;
const LOGIN_NUDGE_DISMISSED_AT_KEY = "briefly.storyLoginNudge.dismissedAt";
const LOGIN_NUDGE_LAST_SHOWN_AT_KEY = "briefly.storyLoginNudge.lastShownAt";

const anonymousOpenedStoriesThisSession = new Set<string>();
let normalWebLoginNudgeActiveMs = 0;

const storyToolsCopy = {
  en: { title: "Story tools", collapse: "Collapse", expand: "Show" },
  es: { title: "Herramientas", collapse: "Ocultar", expand: "Mostrar" },
  ja: { title: "記事ツール", collapse: "閉じる", expand: "表示" },
  "zh-CN": { title: "报道工具", collapse: "收起", expand: "展开" },
  "zh-TW": { title: "報導工具", collapse: "收起", expand: "展開" },
} as const;

const loginNudgeCopy = {
  en: { title: "Do more with Briefly", body: "Sign in free to follow stories, view related videos, join the discussion, and keep your experience across devices.", signIn: "Sign in", notNow: "Not now" },
  es: { title: "Haz más con Briefly", body: "Inicia sesión gratis para seguir noticias, ver vídeos relacionados, participar en la conversación y mantener tu experiencia entre dispositivos.", signIn: "Iniciar sesión", notNow: "Ahora no" },
  ja: { title: "Brieflyをもっと活用", body: "無料でログインすると、ニュースのフォロー、関連動画の視聴、ディスカッションへの参加、端末間での利用継続ができます。", signIn: "ログイン", notNow: "今はしない" },
  "zh-CN": { title: "充分使用 Briefly", body: "免费登录即可关注新闻、查看相关视频、参与讨论，并在不同设备间延续使用体验。", signIn: "登录", notNow: "暂不" },
  "zh-TW": { title: "充分使用 Briefly", body: "免費登入即可追蹤新聞、查看相關影片、參與討論，並在不同裝置間延續使用體驗。", signIn: "登入", notNow: "暫不" },
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
  status: "checking" | "requesting" | "pending" | "failed" | "interrupted" | "unknown" | "unavailable";
  attempts: number;
};

const bilingualGenerationCopy = {
  en: { translationTitle: "Translate story", translationExplanation: "The current English version has no translation yet. Generate it with Briefly Pro.", title: "Read in two languages", explanation: "A translation is not yet available for this English version. Generate it once with Briefly Pro, then read both languages together.", generate: "Generate translation", signIn: "Sign in to generate", upgrade: "Upgrade to generate", pending: "Preparing translation… English remains available.", failed: "Translation is not ready. Try again later.", retry: "Retry translation", check: "Check status", checking: "Checking translation status…", unavailable: "Cannot check translation status. The backend route or English article version may be unavailable. This does not confirm that translation is running.", long: "This may take longer than two minutes. Check its status without generating again.", interrupted: "The translation was interrupted; you can explicitly retry." },
  es: { translationTitle: "Traducir noticia", translationExplanation: "La versión inglesa actual aún no tiene traducción. Genérala con Briefly Pro.", title: "Leer en dos idiomas", explanation: "Aún no hay una traducción para esta versión inglesa. Genérala con Briefly Pro para leer ambas.", generate: "Generar traducción", signIn: "Inicia sesión para generar", upgrade: "Mejora para generar", pending: "Preparando traducción… Puedes seguir leyendo en inglés.", failed: "La traducción aún no está lista. Inténtalo más tarde.", retry: "Reintentar traducción", check: "Comprobar estado", checking: "Comprobando el estado de la traducción…", unavailable: "No se puede consultar el estado. Es posible que la ruta del servidor o la versión inglesa no estén disponibles. Esto no confirma que haya una traducción en curso.", long: "Puede tardar más de dos minutos. Consulta el estado sin iniciar otra generación.", interrupted: "La traducción se interrumpió. Puedes reintentarlo." },
  ja: { translationTitle: "記事を翻訳", translationExplanation: "最新の英語版の翻訳はまだありません。Briefly Proで生成できます。", title: "二言語で読む", explanation: "この英語記事の翻訳はまだありません。Briefly Proで生成すると、両方の言語で読めます。", generate: "翻訳を生成", signIn: "ログインして生成", upgrade: "Proで生成", pending: "翻訳を準備中… 英語記事は引き続き読めます。", failed: "翻訳の準備ができませんでした。後でもう一度お試しください。", retry: "翻訳を再試行", check: "状態を確認", checking: "翻訳状態を確認中…", unavailable: "翻訳状態を取得できません。サーバーのAPIまたは英語記事の版を確認してください。翻訳が実行中という意味ではありません。", long: "2分以上かかる場合があります。新たな生成を開始せずに状態を確認できます。", interrupted: "翻訳が中断されました。再試行できます。" },
  "zh-CN": { translationTitle: "翻译报道", translationExplanation: "当前英文版本尚无译文。可使用 Briefly Pro 生成。", title: "双语阅读", explanation: "此英文版本尚无译文。使用 Briefly Pro 生成后即可双语阅读。", generate: "生成译文", signIn: "登录后生成", upgrade: "升级 Pro 后生成", pending: "正在准备译文… 可以继续阅读英文。", failed: "译文尚未就绪，请稍后重试。", retry: "重试翻译", check: "查看状态", checking: "正在检查翻译状态…", unavailable: "无法查询翻译状态。后端接口或英文文章版本可能不可用；这不代表翻译正在进行。", long: "可能需要两分钟以上。查看状态不会再次触发生成。", interrupted: "译文生成中断，可手动重试。" },
  "zh-TW": { translationTitle: "翻譯報導", translationExplanation: "目前英文版本尚無譯文。可使用 Briefly Pro 產生。", title: "雙語閱讀", explanation: "此英文版本尚無譯文。使用 Briefly Pro 產生後即可雙語閱讀。", generate: "產生譯文", signIn: "登入後產生", upgrade: "升級 Pro 後產生", pending: "正在準備譯文… 可以繼續閱讀英文。", failed: "譯文尚未就緒，請稍後再試。", retry: "重試翻譯", check: "查看狀態", checking: "正在檢查翻譯狀態…", unavailable: "無法查詢翻譯狀態。後端介面或英文文章版本可能無法使用；這不代表翻譯正在進行。", long: "可能需要兩分鐘以上。查看狀態不會再次觸發產生。", interrupted: "譯文產生中斷，可手動重試。" },
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

function isMobileWebBrowser() {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  const agent = navigator.userAgent ?? "";
  return /android|iPhone|iPad|iPod/i.test(agent) ||
    (/Macintosh/i.test(agent) && navigator.maxTouchPoints > 1);
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
    followEvent,
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
    followEvent?: string | string[];
  }>();

  const resolvedSlug = useMemo(
    () => (Array.isArray(slug) ? slug[0] : slug),
    [slug],
  );
  const resolvedEventId = useMemo(
    () => (Array.isArray(eventId) ? eventId[0] : eventId),
    [eventId],
  );
  const resolvedFollowEvent = useMemo(
    () => (Array.isArray(followEvent) ? followEvent[0] : followEvent),
    [followEvent],
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
  const navigation = useNavigation();
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
  const { watchAnalysis, watchTranslation, watchPodcast } = useAnalysisReadiness();
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
  const [briefTranslationRecoveryKey, setBriefTranslationRecoveryKey] = useState("");
  const [storyToolsExpanded, setStoryToolsExpanded] = useState(false);
  const [storyFocused, setStoryFocused] = useState(true);
  const [loginNudgeEligibleKey, setLoginNudgeEligibleKey] = useState("");
  const [loginNudgeVisibleKey, setLoginNudgeVisibleKey] = useState("");
  const [readerEngagedKey, setReaderEngagedKey] = useState("");
  const [sessionStoryOpenCount, setSessionStoryOpenCount] = useState(
    anonymousOpenedStoriesThisSession.size,
  );
  const [sharedAppChoiceDismissedKey, setSharedAppChoiceDismissedKey] = useState("");
  const [bilingualGeneration, setBilingualGeneration] = useState<BilingualGenerationState | null>(null);
  // One automatic request at most per user / immutable English version / language.
  const autoTranslationRequested = useRef(new Set<string>());
  const repairedEnglishBriefVersion = useRef<number | null>(null);
  const repairedEnglishBriefFields = useRef<("what_happened" | "why_it_matters" | "what_next")[]>([]);
  const historyRecordedKey = useRef("");
  const storyOpenTrackedKey = useRef("");
  const loginNudgeTimingRef = useRef({ key: "", elapsed: 0 });

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener("focus", () => setStoryFocused(true));
    const unsubscribeBlur = navigation.addListener("blur", () => setStoryFocused(false));
    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation]);

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
    if (resolvedFollowEvent) params.set("followEvent", resolvedFollowEvent);
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
    resolvedFollowEvent,
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
  const storyIdentity = `${resolvedEventId ?? ""}:${resolvedSlug ?? ""}`;
  const storyArticleMatchesRoute =
    !!article &&
    (resolvedEventId
      ? article.event_id === resolvedEventId
      : article.slug === resolvedSlug);
  const storyMediaActive = storyFocused && storyArticleMatchesRoute;
  const readerEngaged = readerEngagedKey === storyIdentity;
  const showLoginNudge = loginNudgeVisibleKey === storyIdentity;
  const sharedAppChoiceDismissed = sharedAppChoiceDismissedKey === storyIdentity;
  const mobileWebInstallChoiceActive =
    isSharedStory &&
    appConfig?.mobile_app_promotion_enabled === true &&
    isMobileWebBrowser() &&
    !sharedAppChoiceDismissed;
  const loginNudgeText = loginNudgeCopy[language] ?? loginNudgeCopy.en;
  const normalStoryOpenThreshold =
    Platform.OS === "web"
      ? NORMAL_WEB_STORY_OPEN_THRESHOLD
      : NORMAL_NATIVE_STORY_OPEN_THRESHOLD;
  const loginNudgeEngagementReached =
    isSharedStory
      ? readerEngaged
      : sessionStoryOpenCount >= normalStoryOpenThreshold;
  const loginNudgeDelayMs =
    isSharedStory
      ? SHARED_LOGIN_NUDGE_DELAY_MS
      : Platform.OS === "web"
        ? NORMAL_WEB_LOGIN_NUDGE_DELAY_MS
        : null;

  useEffect(() => {
    if (
      !authReady ||
      !!user ||
      isSharedStory ||
      !resolvedEventId ||
      !storyArticleMatchesRoute ||
      article?.article_version_id == null
    ) return;
    if (anonymousOpenedStoriesThisSession.has(storyIdentity)) return;
    anonymousOpenedStoriesThisSession.add(storyIdentity);
    setSessionStoryOpenCount(anonymousOpenedStoriesThisSession.size);
  }, [
    article?.article_version_id,
    authReady,
    isSharedStory,
    resolvedEventId,
    storyArticleMatchesRoute,
    storyIdentity,
    user,
  ]);

  useEffect(() => {
    let active = true;
    if (
      !authReady ||
      !!user ||
      !resolvedEventId ||
      !storyArticleMatchesRoute ||
      article?.article_version_id == null ||
      appConfig == null ||
      mobileWebInstallChoiceActive
    ) return;

    void Promise.all([
      AsyncStorage.getItem(LOGIN_NUDGE_DISMISSED_AT_KEY),
      AsyncStorage.getItem(LOGIN_NUDGE_LAST_SHOWN_AT_KEY),
    ]).then(([dismissedAt, lastShownAt]) => {
      if (!active) return;
      const now = Date.now();
      if (now - Number(dismissedAt || 0) < LOGIN_NUDGE_COOLDOWN_MS) return;
      if (now - Number(lastShownAt || 0) < LOGIN_NUDGE_REPEAT_COOLDOWN_MS) return;
      setLoginNudgeEligibleKey(storyIdentity);
    }).catch(() => {
      if (active) setLoginNudgeEligibleKey(storyIdentity);
    });

    return () => { active = false; };
  }, [
    appConfig,
    article?.article_version_id,
    authReady,
    isSharedStory,
    mobileWebInstallChoiceActive,
    resolvedEventId,
    storyArticleMatchesRoute,
    storyIdentity,
    user,
  ]);

  useEffect(() => {
    if (
      loginNudgeEligibleKey !== storyIdentity ||
      showLoginNudge ||
      !storyFocused
    ) return;

    const timing = loginNudgeTimingRef.current;
    if (isSharedStory && timing.key !== storyIdentity) {
      timing.key = storyIdentity;
      timing.elapsed = 0;
    }

    let startedAt: number | null =
      AppState.currentState === "active" ? Date.now() : null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const currentElapsed = () =>
      isSharedStory ? timing.elapsed : normalWebLoginNudgeActiveMs;
    const saveElapsed = (elapsed: number) => {
      if (isSharedStory) timing.elapsed = elapsed;
      else normalWebLoginNudgeActiveMs = elapsed;
    };
    const show = () => {
      if (!active || !storyFocused || AppState.currentState !== "active") return;
      setLoginNudgeVisibleKey(storyIdentity);
      void AsyncStorage.setItem(LOGIN_NUDGE_LAST_SHOWN_AT_KEY, String(Date.now())).catch(() => null);
    };
    const schedule = () => {
      if (!active || startedAt == null || timer || loginNudgeDelayMs == null) return;
      timer = setTimeout(
        show,
        Math.max(0, loginNudgeDelayMs - currentElapsed()),
      );
    };
    const recordActiveTime = () => {
      if (startedAt == null || loginNudgeDelayMs == null) return;
      saveElapsed(
        Math.min(
          loginNudgeDelayMs,
          currentElapsed() + Date.now() - startedAt,
        ),
      );
    };

    if (loginNudgeEngagementReached) timer = setTimeout(show, 0);
    else schedule();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        startedAt = Date.now();
        if (loginNudgeEngagementReached) timer = setTimeout(show, 0);
        else schedule();
        return;
      }
      recordActiveTime();
      startedAt = null;
      if (timer) clearTimeout(timer);
      timer = null;
    });

    return () => {
      active = false;
      recordActiveTime();
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [
    isSharedStory,
    loginNudgeDelayMs,
    loginNudgeEligibleKey,
    loginNudgeEngagementReached,
    showLoginNudge,
    storyFocused,
    storyIdentity,
  ]);

  const dismissLoginNudge = () => {
    setLoginNudgeVisibleKey("");
    void AsyncStorage.setItem(LOGIN_NUDGE_DISMISSED_AT_KEY, String(Date.now())).catch(() => null);
  };

  const markReaderEngaged = () => {
    if (user) return;
    setReaderEngagedKey(storyIdentity);
  };

  const openLoginFromNudge = () => {
    trackProductEvent("story_login_nudge_sign_in", {
      eventId: article?.event_id ?? resolvedEventId ?? null,
      articleVersionId: article?.article_version_id ?? null,
      properties: { source: resolvedSource ?? "story" },
    });
    router.push(`/sign-in?returnTo=${encodeURIComponent(currentStoryHref)}` as never);
  };

  // Notification links must reopen in the translated reading language even
  // when the user's original link explicitly requested English content.
  const translationNotificationHref = useMemo(() => {
    const [pathname, query = ""] = currentStoryHref.split("?", 2);
    const params = new URLSearchParams(query);
    params.set("ui", resolvedUi ?? language);
    params.set("content", articleRequestLanguage);
    params.set("read", articleRequestLanguage);
    params.delete("mode");
    params.delete("translationVersion");
    params.delete("englishVersion");
    return `${pathname}?${params.toString()}`;
  }, [articleRequestLanguage, currentStoryHref, language, resolvedUi]);
  const translateSourceUrl = getGoogleTranslateStoryUrl(
    currentStoryHref,
    language,
  );
  const requestKey = `${resolvedSlug ?? ""}:${resolvedEventId ?? ""}:${resolvedScope ?? ""}:${articleRequestLanguage}:${language}:${pinnedTranslationVersion ?? ""}:${reloadKey}`;
  const loading = loadingKey !== requestKey && !error && !article;
  const isPro = account?.translation_entitled === true;
  // Pro may preview a draft English source and its matching draft translation.
  // Shared links never request draft sources or start inference.
  const canUseDraftTranslation = isPro && !isSharedStory && articleRequestLanguage !== "en";
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
    !!briefRepairKey &&
    (briefRepairBusyKey === briefRepairKey || briefTranslationRecoveryKey === briefRepairKey);

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
              includeDraft: PREVIEW_DRAFTS || canUseDraftTranslation,
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
                    includeDraft: PREVIEW_DRAFTS || canUseDraftTranslation,
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
                  includeDraft: canUseDraftTranslation,
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
              // Keep an approved historical translation while a newer English
              // version is being translated. The matching published English
              // source is loaded separately for bilingual reading below.
              // Shared/pinned readers keep their own existing reading mode.
              if (!isSharedStory && !pinnedTranslationVersion &&
                  localized.translation_historical === true &&
                  bilingualReaderFeatureEnabled) {
                setLanguageMode("bilingual");
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
            includeDraft: PREVIEW_DRAFTS || canUseDraftTranslation,
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
    canUseDraftTranslation,
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
    void getCanonicalArticleByVersionId(oldEnglishSourceId, { includeDraft: canUseDraftTranslation })
      .then((value) => {
        if (active && value.article_version_id === oldEnglishSourceId &&
            (value.content_language ?? value.language) === "en") {
          setHistoricalOriginalState({key: historicalEnglishKey, value});
        }
      })
      .catch(() => {
        // Source may be unpublished or unavailable; never display a false pair.
      });
    return () => { active = false; };
  }, [historicalEnglishKey, oldEnglishSourceId, canUseDraftTranslation]);

  // Reconcile translation on story open from one read-only status lookup.
  // Displaying an earlier translation does not satisfy the latest English
  // version. Shared/pinned links never request generation.
  const displayedEventId = article?.event_id ?? null;
  const latestEnglishVersionId = authoritativeArticle?.article_version_id ?? null;
  const latestEnglishEventId = authoritativeArticle?.event_id ?? null;
  const latestTranslationReady =
    !!article && matchedBilingualOriginal(article, authoritativeArticle) !== null;
  const autoTranslationUserId = user?.id ?? null;
  const translationNotificationHeadline =
    authoritativeArticle?.headline || resolvedPreviewHeadline || "Briefly story";

  useEffect(() => {
    if (!translationEnabled || (!bilingualReaderFeatureEnabled && !isPro) ||
        !resolvedEventId || !bilingualGenerationKey || !latestEnglishVersionId ||
        displayedEventId !== resolvedEventId ||
        latestEnglishEventId !== resolvedEventId || isSharedStory ||
        pinnedTranslationVersion || latestTranslationReady) return;

    let active = true;
    // The source identity, not the mutable displayed article object, owns this
    // lifecycle. An older pair or an unrelated article-state update must not
    // cancel the startup status check before it can request translation.
    const reconcile = async () => {
      setBilingualGeneration({ key: bilingualGenerationKey, status: "checking", attempts: 0 });
      try {
        const job = await getExperimentalTranslationStatus(
          resolvedEventId, latestEnglishVersionId, articleRequestLanguage,
          canUseDraftTranslation,
        );
        if (!active) return;

        if (job.status === "ready") {
          const localized = await getExperimentalArticleByEventId(resolvedEventId, {
            includeDraft: canUseDraftTranslation, language: articleRequestLanguage, prepare: false,
          });
          if (!active) return;
          if (translationMatchesEnglishVersion(localized, latestEnglishEventId, latestEnglishVersionId)) {
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
              key: bilingualGenerationKey, status: "unknown", attempts: 0,
            });
          }
          return;
        }

        if (job.status === "queued" || job.status === "processing" ||
            job.status === "failed" || job.status === "interrupted" ||
            job.status === "unknown") {
          if (job.status === "queued" || job.status === "processing") {
            watchTranslation({
              eventId: resolvedEventId, language: articleRequestLanguage,
              headline: translationNotificationHeadline,
              href: translationNotificationHref,
              articleVersionId: latestEnglishVersionId,
            });
          }
          setBilingualGeneration({
            key: bilingualGenerationKey,
            status: job.status === "queued" || job.status === "processing"
              ? "pending" : job.status,
            attempts: 0,
          });
          return;
        }

        // "not_requested" is the only status allowed to launch new work.
        // Legacy draft/published flags and canonical_stale are not eligibility
        // gates: we already have an immutable, event-matched English source.
        // A new English revision uses a distinct translation cache key. Respect
        // the user's opt-out, Pro entitlement, and read-only shared links.
        if (job.status !== "not_requested" ||
            !preferencesReady || !autoTranslateStories || !autoTranslationUserId ||
            !isPro ||
            articleRequestLanguage === "en" || resolvedContentLanguage === "en" ||
            languageMode === "original") {
          setBilingualGeneration(null);
          return;
        }

        const requestId = `${autoTranslationUserId}:${bilingualGenerationKey}`;
        if (autoTranslationRequested.current.has(requestId)) return;
        autoTranslationRequested.current.add(requestId);
        setBilingualGeneration({
          key: bilingualGenerationKey, status: "requesting", attempts: 0,
        });
        const localized = await getExperimentalArticleByEventId(resolvedEventId, {
          includeDraft: canUseDraftTranslation, language: articleRequestLanguage, prepare: true,
        });
        if (!active) return;
        if (translationMatchesEnglishVersion(localized, latestEnglishEventId, latestEnglishVersionId)) {
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
          const jobAccepted = localized.translation_status === "pending" &&
            localized.translation_entitled === true &&
            localized.authoritative_article_version_id === latestEnglishVersionId;
          if (jobAccepted) {
            watchTranslation({
              eventId: resolvedEventId, language: articleRequestLanguage,
              headline: translationNotificationHeadline,
              href: translationNotificationHref,
              articleVersionId: latestEnglishVersionId,
            });
          }
          setBilingualGeneration({
            key: bilingualGenerationKey,
            status: jobAccepted ? "pending" : "unknown",
            attempts: 0,
          });
        }
      } catch {
        // Network uncertainty is not evidence of model failure. Never fire a
        // second inference request as a fallback to a failed status lookup.
        if (active) setBilingualGeneration({
          key: bilingualGenerationKey, status: "unavailable", attempts: 0,
        });
      }
    };

    void reconcile();
    return () => { active = false; };
  }, [
    translationEnabled, bilingualReaderFeatureEnabled, isPro,
    resolvedEventId, bilingualGenerationKey, latestEnglishVersionId,
    latestEnglishEventId, displayedEventId,
    latestTranslationReady, isSharedStory,
    pinnedTranslationVersion, articleRequestLanguage, resolvedContentLanguage,
    languageMode, preferencesReady, autoTranslateStories, autoTranslationUserId,
    canUseDraftTranslation, watchTranslation,
    translationNotificationHeadline, translationNotificationHref,
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
          articleRequestLanguage, canUseDraftTranslation,
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
            includeDraft: canUseDraftTranslation,
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
    canUseDraftTranslation,
  ]);

  const requestBilingualTranslation = async () => {
    if (!bilingualGenerationKey || !resolvedEventId || !authoritativeArticle ||
        !translationEnabled || isSharedStory || pinnedTranslationVersion ||
        activeBilingualGeneration?.status === "pending" ||
        activeBilingualGeneration?.status === "requesting" ||
        activeBilingualGeneration?.status === "checking") return;

    if (!user) {
      router.push(`/sign-in?returnTo=${encodeURIComponent(currentStoryHref)}` as never);
      return;
    }
    if (!isPro) {
      router.push(`/upgrade?returnTo=${encodeURIComponent(currentStoryHref)}` as never);
      return;
    }

    // When the status is uncertain, the button is read-only, not a retry.
    if (activeBilingualGeneration?.status === "unknown" ||
        activeBilingualGeneration?.status === "unavailable") {
      setBilingualGeneration({ key: bilingualGenerationKey, status: "checking", attempts: 0 });
      try {
        const job = await getExperimentalTranslationStatus(
          resolvedEventId, authoritativeArticle.article_version_id!,
          articleRequestLanguage, canUseDraftTranslation,
        );
        if (job.status === "ready") {
          const localized = await getExperimentalArticleByEventId(resolvedEventId, {
            includeDraft: canUseDraftTranslation, language: articleRequestLanguage, prepare: false,
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
        if (job.status === "queued" || job.status === "processing") {
          watchTranslation({
            eventId: resolvedEventId, language: articleRequestLanguage,
            headline: translationNotificationHeadline,
            href: translationNotificationHref,
            articleVersionId: authoritativeArticle.article_version_id,
          });
        }
        setBilingualGeneration(job.status === "not_requested" ? null : {
          key: bilingualGenerationKey,
          status: job.status === "queued" || job.status === "processing"
            ? "pending" : job.status === "failed" || job.status === "interrupted"
              ? job.status : "unknown",
          attempts: 0,
        });
      } catch {
        // A 404 may mean this backend does not expose the status route, or
        // that the requested English source is not published for this event.
        // Neither case proves that an inference job is active.
        setBilingualGeneration({
          key: bilingualGenerationKey, status: "unavailable", attempts: 0,
        });
      }
      return;
    }

    setBilingualGeneration({ key: bilingualGenerationKey, status: "requesting", attempts: 0 });
    try {
      const localized = await getExperimentalArticleByEventId(resolvedEventId, {
        includeDraft: canUseDraftTranslation,
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
        const jobAccepted = localized.translation_status === "pending" &&
          localized.translation_entitled === true &&
          localized.authoritative_article_version_id === authoritativeArticle.article_version_id;
        if (jobAccepted) {
          watchTranslation({
            eventId: resolvedEventId, language: articleRequestLanguage,
            headline: translationNotificationHeadline,
            href: translationNotificationHref,
            articleVersionId: authoritativeArticle.article_version_id,
          });
        }
        setBilingualGeneration({
          key: bilingualGenerationKey,
          status: jobAccepted ? "pending" : "unknown",
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

  // When English Retry repairs an existing source version, its already cached
  // localization may take a moment to gain the same brief fields. Poll only
  // read-only localized content; do not submit another translation request.
  useEffect(() => {
    if (!authoritativeArticle || !article || !resolvedEventId ||
        repairedEnglishBriefVersion.current !== authoritativeArticle.article_version_id ||
        articleRequestLanguage === "en" || isSharedStory ||
        (article.content_language ?? article.language) === "en" ||
        !matchedBilingualOriginal(article, authoritativeArticle)) return;

    const sections = ["what_happened", "why_it_matters", "what_next"] as const;
    // The English Retry endpoint responds before the Story reload has fetched
    // the repaired source. Do not mistake the old empty English field for a
    // fully synchronized translation and cancel the localized repair watcher.
    if (repairedEnglishBriefFields.current.some(
      (section) => !String(authoritativeArticle[section] ?? "").trim(),
    )) return;
    const missingTranslation = sections.some(
      (section) => !!String(authoritativeArticle[section] ?? "").trim() &&
        !String(article[section] ?? "").trim(),
    );
    if (!missingTranslation) {
      repairedEnglishBriefVersion.current = null;
      repairedEnglishBriefFields.current = [];
      // Clear the busy indicator after this effect, not during render
      // synchronization. A completed repair may already be cached.
      const finishedTimer = setTimeout(() => setBriefTranslationRecoveryKey(""), 0);
      return () => clearTimeout(finishedTimer);
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const poll = async () => {
      try {
        const localized = await getExperimentalArticleByEventId(resolvedEventId, {
          language: articleRequestLanguage,
          includeDraft: canUseDraftTranslation,
          prepare: false,
        });
        if (!active) return;
        if (matchedBilingualOriginal(localized, authoritativeArticle) &&
            sections.every((section) =>
              !String(authoritativeArticle[section] ?? "").trim() ||
              !!String(localized[section] ?? "").trim(),
            )) {
          repairedEnglishBriefVersion.current = null;
          repairedEnglishBriefFields.current = [];
          setBriefTranslationRecoveryKey("");
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
          return;
        }
      } catch {
        // A transient status error does not authorize new Ollama work.
      }
      if (!active) return;
      if (++attempts < 40) {
        timer = setTimeout(() => void poll(), 3000);
      } else {
        repairedEnglishBriefVersion.current = null;
        repairedEnglishBriefFields.current = [];
        setBriefTranslationRecoveryKey("");
      }
    };
    timer = setTimeout(() => void poll(), 3000);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [
    authoritativeArticle, article, resolvedEventId, articleRequestLanguage,
    isSharedStory, canUseDraftTranslation,
  ]);

  const handleBriefRepair = async (targetLanguage?: string) => {
    if (!briefRepairArticleVersionId || briefRepairBusy) return;

    if (!user) {
      router.push(
        `/sign-in?returnTo=${encodeURIComponent(currentStoryHref)}` as never,
      );
      return;
    }

    // Starting an entirely new translation remains Pro-only. Repairing
    // English itself uses the existing signed-in Retry permission.
    const sourceMissing = ["what_happened", "why_it_matters", "what_next"].some(
      (field) => !String(authoritativeArticle?.[field as "what_happened" | "why_it_matters" | "what_next"] ?? "").trim(),
    );
    if (targetLanguage && !sourceMissing && !isPro) {
      router.push(`/upgrade?returnTo=${encodeURIComponent(currentStoryHref)}` as never);
      return;
    }

    const key = String(briefRepairArticleVersionId);
    setBriefRepairBusyKey(key);
    try {
      const result = await requestBriefRepair(briefRepairArticleVersionId, targetLanguage);
      if (result.status === "succeeded" || result.status === "translation_pending") {
        repairedEnglishBriefVersion.current = briefRepairArticleVersionId;
        repairedEnglishBriefFields.current = result.status === "succeeded"
          ? result.repaired_sections ?? []
          : [];
        if (targetLanguage) setBriefTranslationRecoveryKey(key);
      }
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
          dismissed={sharedAppChoiceDismissed}
          onDismissed={() => setSharedAppChoiceDismissedKey(storyIdentity)}
        />
      )}
        <EventPreviewView
          article={previewArticle}
          mediaActive={storyMediaActive}
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
    !!resolvedEventId &&
    !!bilingualGenerationKey &&
    articleRequestLanguage !== "en" &&
    // A historical pair is readable, but does not satisfy the latest version.
    matchedBilingualOriginal(article, authoritativeArticle) === null;
  const bilingualGenerationText = bilingualGenerationCopy[language] ?? bilingualGenerationCopy.en;
  const bilingualGenerationBusy = activeBilingualGeneration?.status === "checking" ||
    activeBilingualGeneration?.status === "requesting" ||
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
          dismissed={sharedAppChoiceDismissed}
          onDismissed={() => setSharedAppChoiceDismissedKey(storyIdentity)}
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
        mediaActive={storyMediaActive}
        onReaderEngaged={markReaderEngaged}
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
              {activeBilingualGeneration?.status === "checking"
                ? bilingualGenerationText.checking
                : activeBilingualGeneration?.status === "pending" ||
                  activeBilingualGeneration?.status === "requesting"
                  ? bilingualGenerationText.pending
                  : bilingualReaderFeatureEnabled ? bilingualGenerationText.explanation : bilingualGenerationText.translationExplanation}
            </Text>
            {(activeBilingualGeneration?.status === "failed" ||
              activeBilingualGeneration?.status === "interrupted" ||
              activeBilingualGeneration?.status === "unknown" ||
              activeBilingualGeneration?.status === "unavailable") && (
              <Text style={[styles.bilingualPromptDescription, { color: colors.accent }]}>
                {activeBilingualGeneration.status === "failed"
                  ? bilingualGenerationText.failed
                  : activeBilingualGeneration.status === "interrupted"
                    ? bilingualGenerationText.interrupted
                    : activeBilingualGeneration.status === "unavailable"
                      ? bilingualGenerationText.unavailable
                      : bilingualGenerationText.long}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: bilingualGenerationBusy, busy: bilingualGenerationBusy }}
              disabled={bilingualGenerationBusy}
              onPress={() => void requestBilingualTranslation()}
              style={[styles.bilingualPromptButton, {
                backgroundColor: colors.text,
                opacity: bilingualGenerationBusy ? 0.6 : 1,
              }]}
            >
              {bilingualGenerationBusy && <ActivityIndicator size="small" color={colors.background} />}
              <Text style={[styles.bilingualPromptButtonText, { color: colors.background }]}>
                {activeBilingualGeneration?.status === "checking"
                  ? bilingualGenerationText.checking
                  : bilingualGenerationBusy
                    ? bilingualGenerationText.pending
                  : !user
                    ? bilingualGenerationText.signIn
                    : !isPro
                      ? bilingualGenerationText.upgrade
                      : activeBilingualGeneration?.status === "failed" ||
                        activeBilingualGeneration?.status === "interrupted"
                          ? bilingualGenerationText.retry
                          : activeBilingualGeneration?.status === "unknown" ||
                            activeBilingualGeneration?.status === "unavailable"
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
        briefRepair={briefRepair}
        briefRepairBusy={briefRepairBusy}
        onBriefRepair={() => void handleBriefRepair()}
        onBriefTranslationRepair={
          !isSharedStory &&
          (displayedArticle.content_language ?? displayedArticle.language) !== "en" &&
          matchedBilingualOriginal(article, authoritativeArticle) !== null
            ? () => void handleBriefRepair(articleRequestLanguage)
            : undefined
        }
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

      {showLoginNudge && !user && (
        <View pointerEvents="box-none" style={styles.loginNudgeHost}>
          <View
            accessibilityLabel={loginNudgeText.title}
            style={[
              styles.loginNudge,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.loginNudgeCopy}>
              <Text style={[styles.loginNudgeTitle, { color: colors.text }]}>
                {loginNudgeText.title}
              </Text>
              <Text style={[styles.loginNudgeBody, { color: colors.textMuted }]}>
                {loginNudgeText.body}
              </Text>
            </View>
            <View style={styles.loginNudgeActions}>
              <Pressable
                accessibilityRole="button"
                onPress={openLoginFromNudge}
                style={[styles.loginNudgePrimary, { backgroundColor: colors.text }]}
              >
                <Text style={[styles.loginNudgePrimaryText, { color: colors.background }]}>
                  {loginNudgeText.signIn}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={dismissLoginNudge}
                style={styles.loginNudgeSecondary}
              >
                <Text style={[styles.loginNudgeSecondaryText, { color: colors.textMuted }]}>
                  {loginNudgeText.notNow}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loginNudgeHost: { position: "absolute", left: 12, right: 12, bottom: 18, zIndex: 70, elevation: 10, alignItems: "center" },
  loginNudge: { width: "100%", maxWidth: 640, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 10 },
  loginNudgeCopy: { flex: 1, minWidth: 220, gap: 3 },
  loginNudgeTitle: { fontSize: 14, fontWeight: "800" },
  loginNudgeBody: { fontSize: 12, lineHeight: 17 },
  loginNudgeActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  loginNudgePrimary: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19, justifyContent: "center" },
  loginNudgePrimaryText: { fontSize: 12, fontWeight: "800" },
  loginNudgeSecondary: { minHeight: 38, paddingHorizontal: 10, justifyContent: "center" },
  loginNudgeSecondaryText: { fontSize: 12, fontWeight: "700" },
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
  bilingualPromptButton: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
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
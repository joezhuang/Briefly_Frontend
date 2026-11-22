import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { trackProductEvent } from "@/analytics/product-analytics";
import {
  getHomepageArticleFeed,
  type BrieflyAppConfig,
  type HomepageFeedScope,
} from "@/api/briefly";
import { AppHeader } from "@/components/app-header";
import {
  FeedCategoryBar,
  PinnedFeedCategoryBar,
  usePinnedFeedCategories,
} from "@/components/feed-category-bar";
import { FloatingStoryVideo } from "@/components/floating-story-video";
// Metro resolves the platform-specific .native/.web implementation at runtime.
// eslint-disable-next-line import/no-unresolved
import { HomeAdSlot } from "@/components/home-ad-slot";
// Metro resolves the platform-specific .native/.web implementation at runtime.
import { HomeInstallBanners } from "@/components/home-install-banners";
import { NewsLocationGate } from "@/components/news-location-gate";
import { ScreenState } from "@/components/screen-state";
import {
  StoryTile,
  storyTileHref,
  stopActiveHomepageVideo,
  type StoryTileVideoStart,
} from "@/components/story-tile";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyAppConfig } from "@/context/app-config";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";
import {
  disableNewsLocation,
  enableAutoNewsLocation,
  getNewsLocationPreference,
  refreshAutoNewsLocation,
  saveManualFeedLocation,
  type NewsLocationPreference,
} from "@/services/feed-location";
import { selectHomepageDevelopments } from "@/services/home-editorial";
import { layout } from "@/theme/tokens";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";
const REFRESH_FRESHNESS_MS = 2 * 60 * 1000;
const PAGE_SIZE = 20;
const LOAD_MORE_THRESHOLD = 800;
const VIRTUAL_BATCH_SIZE = 6;
const SHOW_TOP_BUTTON_OFFSET = 700;
const SWIPE_TRIGGER_DISTANCE = 56;
const SWIPE_DIRECTION_RATIO = 1.35;

type RememberedHomeFeed = {
  articles: CanonicalArticle[];
  hasMore: boolean;
  scrollOffset: number;
  lastFetchedAt: number;
};

const rememberedHomeFeeds = new Map<string, RememberedHomeFeed>();

const feedCopy = {
  en: { top: "Top", national: "National", local: "Local", refresh: "Refresh" },
  es: {
    top: "Principal",
    national: "Nacional",
    local: "Local",
    refresh: "Actualizar",
  },
  ja: { top: "トップ", national: "国内", local: "地域", refresh: "更新" },
  "zh-CN": { top: "头条", national: "全国", local: "本地", refresh: "刷新" },
  "zh-TW": {
    top: "頭條",
    national: "全國",
    local: "本地",
    refresh: "重新整理",
  },
} as const;

// Home-only editorial hierarchy. Feed selection, navigation, media controls
// and article ranking still use the existing shared components.
const editionCopy = {
  en: {
    kicker: "THE BRIEFLY EDITION",
    headline: "A clearer view of the news.",
    inFocus: "IN FOCUS",
    more: "More to explore",
    moreDetail: "Continue through the latest reporting",
    top: "Leading stories",
    national: "Across the nation",
    local: "Closer to home",
    stories: "STORIES",
    lead: "LEAD STORY",
    next: "ALSO IN THE NEWS",
    evolving: "Stories in motion",
    evolvingDetail: "Confirmed links across related coverage",
    connected: "connected stories",
    context: "WHY IT MATTERS",
    readAnalysis: "Read the full analysis",
    brief: "MORE PERSPECTIVES",
  },
  es: {
    kicker: "LA EDICIÓN BRIEFLY",
    headline: "Las noticias, con perspectiva.",
    inFocus: "EN PRIMER PLANO",
    more: "Más noticias",
    moreDetail: "Sigue explorando las últimas noticias",
    top: "Noticias destacadas",
    national: "En todo el país",
    local: "Noticias cercanas",
    stories: "NOTICIAS",
    lead: "NOTICIA PRINCIPAL",
    next: "TAMBIÉN HOY",
    evolving: "Historias en desarrollo",
    evolvingDetail: "Coberturas relacionadas y confirmadas",
    connected: "historias relacionadas",
    context: "POR QUÉ IMPORTA",
    readAnalysis: "Leer el análisis completo",
    brief: "MÁS PERSPECTIVAS",
  },
  ja: {
    kicker: "BRIEFLY ニュース",
    headline: "ニュースの全体像を、もっと明確に。",
    inFocus: "注目のニュース",
    more: "ほかのニュース",
    moreDetail: "さまざまな視点からニュースをチェック",
    top: "主要ニュース",
    national: "国内のニュース",
    local: "地域のニュース",
    stories: "件",
    lead: "トップニュース",
    next: "注目記事",
    evolving: "続報のあるニュース",
    evolvingDetail: "確認済みの関連報道",
    connected: "件の関連ニュース",
    context: "なぜ重要なのか",
    readAnalysis: "詳しい分析を読む",
    brief: "さらに読む",
  },
  "zh-CN": {
    kicker: "BRIEFLY 今日视野",
    headline: "新闻不止标题，更有全貌。",
    inFocus: "焦点新闻",
    more: "更多新闻",
    moreDetail: "继续了解最新报道与不同视角",
    top: "重要新闻",
    national: "全国新闻",
    local: "本地新闻",
    stories: "条新闻",
    lead: "头条报道",
    next: "其他焦点",
    evolving: "持续发展的新闻",
    evolvingDetail: "已确认关联的后续报道",
    connected: "条相关新闻",
    context: "为何重要",
    readAnalysis: "阅读完整分析",
    brief: "更多视角",
  },
  "zh-TW": {
    kicker: "BRIEFLY 今日視野",
    headline: "新聞不只標題，更有全貌。",
    inFocus: "焦點新聞",
    more: "更多新聞",
    moreDetail: "繼續了解最新報導與不同視角",
    top: "重要新聞",
    national: "全國新聞",
    local: "本地新聞",
    stories: "則新聞",
    lead: "頭條報導",
    next: "其他焦點",
    evolving: "持續發展的新聞",
    evolvingDetail: "已確認關聯的後續報導",
    connected: "則相關新聞",
    context: "為何重要",
    readAnalysis: "閱讀完整分析",
    brief: "更多視角",
  },
} as const;

const scopes: HomepageFeedScope[] = ["top", "national", "local"];

function enabledHomeScopes(config: BrieflyAppConfig | null): HomepageFeedScope[] {
  if (!config) return scopes;
  const enabled = scopes.filter((item) => {
    if (item === "top") return config.top_feed_enabled !== false;
    if (item === "national") return config.national_feed_enabled !== false;
    return config.local_feed_enabled !== false;
  });
  return enabled.length > 0 ? enabled : ["top"];
}
const GEO_COVERAGE_RETRY_MS = 5000;
const GEO_COVERAGE_MAX_RETRIES = 24;
const storyKey = (article: CanonicalArticle) =>
  String(article.article_version_id ?? article.event_id);

type HomeVideoSession = StoryTileVideoStart & {
  anchorScrollOffset: number;
};

function mergeUnique(
  current: CanonicalArticle[],
  incoming: CanonicalArticle[],
): CanonicalArticle[] {
  const seen = new Set(current.map(storyKey));
  const output = [...current];
  for (const article of incoming) {
    const key = storyKey(article);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(article);
  }
  return output;
}

function chunkArticles(articles: CanonicalArticle[]): CanonicalArticle[][] {
  const batches: CanonicalArticle[][] = [];
  for (let index = 0; index < articles.length; index += VIRTUAL_BATCH_SIZE) {
    batches.push(articles.slice(index, index + VIRTUAL_BATCH_SIZE));
  }
  return batches;
}

function locationPreferenceKey(preference: NewsLocationPreference) {
  const location = preference.location;
  return [
    preference.mode,
    location?.country ?? "",
    location?.countryCode ?? "",
    location?.region ?? "",
    location?.regionCode ?? "",
    location?.city ?? "",
  ].join("|");
}

function homeFeedMemoryKey(
  scope: HomepageFeedScope,
  language: string,
  preference: NewsLocationPreference,
) {
  return scope === "top"
    ? `${scope}|${language}`
    : `${scope}|${language}|${locationPreferenceKey(preference)}`;
}

function findRememberedHomeFeed(
  scope: HomepageFeedScope,
  language: string,
  preference: NewsLocationPreference,
) {
  return rememberedHomeFeeds.get(
    homeFeedMemoryKey(scope, language, preference),
  );
}

function getRememberedHomeFeed(
  scope: HomepageFeedScope,
  language: string,
  preference: NewsLocationPreference,
): RememberedHomeFeed {
  const key = homeFeedMemoryKey(scope, language, preference);
  const existing = rememberedHomeFeeds.get(key);
  if (existing) return existing;

  const created: RememberedHomeFeed = {
    articles: [],
    hasMore: false,
    scrollOffset: 0,
    lastFetchedAt: 0,
  };
  rememberedHomeFeeds.set(key, created);
  return created;
}

export default function HomeScreen() {
  const { width, height: viewportHeight } = useWindowDimensions();
  const { feedScope: requestedFeedScope } = useLocalSearchParams<{
    feedScope?: string;
  }>();
  const { language, t } = useBrieflyLanguage();
  const { ready: authReady, account } = useBrieflyAuth();
  const { config: appConfig, refresh: refreshAppConfig } = useBrieflyAppConfig();
  const { colors } = useBrieflyTheme();
  const initialHomeFeed =
    findRememberedHomeFeed("top", language, {
      mode: "off",
      location: null,
    }) ?? {
      articles: [],
      hasMore: false,
      scrollOffset: 0,
      lastFetchedAt: 0,
    };

  const [scope, setScope] = useState<HomepageFeedScope>("top");
  const [articles, setArticles] = useState<CanonicalArticle[]>(
    initialHomeFeed.articles,
  );
  const [loading, setLoading] = useState(initialHomeFeed.articles.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialHomeFeed.hasMore);
  const [showTopButton, setShowTopButton] = useState(
    initialHomeFeed.scrollOffset > SHOW_TOP_BUTTON_OFFSET,
  );
  const [error, setError] = useState<string | null>(null);
  const [newsLocation, setNewsLocation] = useState<NewsLocationPreference>({
    mode: "off",
    location: null,
  });
  const [locationReady, setLocationReady] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const lastFetchedAt = useRef(initialHomeFeed.lastFetchedAt);
  const didApplyDefaultScopeRef = useRef(false);
  const lastAppliedRouteScopeRef = useRef<string | null>(null);
  const activeRequest = useRef(0);
  const articlesRef = useRef<CanonicalArticle[]>(initialHomeFeed.articles);
  const listRef = useRef<FlatList<CanonicalArticle[]>>(null);
  const restoredScrollRef = useRef(initialHomeFeed.scrollOffset <= 0);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(initialHomeFeed.hasMore);
  const coverageRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverageRetryCountRef = useRef(0);
  const [coverageRetryTick, setCoverageRetryTick] = useState(0);
  const homeScrollOffsetRef = useRef(initialHomeFeed.scrollOffset);
  const headerOffsetRef = useRef(0);
  const categoryOffsetRef = useRef<number | null>(null);
  const { pinned: categoriesPinned, setBarTop, onScrollOffset } =
    usePinnedFeedCategories();
  const videoSessionRef = useRef<HomeVideoSession | null>(null);
  const videoFloatingRef = useRef(false);
  const [pendingSwipeDirection, setPendingSwipeDirection] = useState<
    1 | -1 | null
  >(null);
  const [videoSession, setVideoSession] = useState<HomeVideoSession | null>(null);
  const [videoFloating, setVideoFloating] = useState(false);
  const [videoResumeTime, setVideoResumeTime] = useState(0);

  const copy = feedCopy[language] ?? feedCopy.en;
  const edition = editionCopy[language] ?? editionCopy.en;

  const replaceArticles = useCallback((next: CanonicalArticle[]) => {
    articlesRef.current = next;
    setArticles(next);
    return next;
  }, []);

  const appendArticles = useCallback((next: CanonicalArticle[]) => {
    const merged = mergeUnique(articlesRef.current, next);
    articlesRef.current = merged;
    setArticles(merged);
    return merged;
  }, []);

  const updateHasMore = useCallback((value: boolean) => {
    hasMoreRef.current = value;
    setHasMore(value);
  }, []);

  const handleHomeVideoStart = useCallback((started: StoryTileVideoStart) => {
    const session: HomeVideoSession = {
      ...started,
      anchorScrollOffset: homeScrollOffsetRef.current,
    };
    videoSessionRef.current = session;
    videoFloatingRef.current = false;
    setVideoSession(session);
    setVideoResumeTime(started.currentTime);
    setVideoFloating(false);
  }, []);

  const handleHomeVideoTimeUpdate = useCallback(
    (eventId: string, seconds: number) => {
      const session = videoSessionRef.current;
      if (!session || session.eventId !== eventId) return;
      session.currentTime = Math.max(0, seconds);
    },
    [],
  );

  const handleHomeVideoStop = useCallback((eventId: string) => {
    const session = videoSessionRef.current;
    if (session && session.eventId !== eventId) return;
    videoSessionRef.current = null;
    videoFloatingRef.current = false;
    setVideoSession(null);
    setVideoFloating(false);
    setVideoResumeTime(0);
  }, []);

  useEffect(() => {
    stopActiveHomepageVideo();
    const activeEventId = videoSessionRef.current?.eventId;
    if (activeEventId) handleHomeVideoStop(activeEventId);
  }, [handleHomeVideoStop, scope]);

  const switchScope = useCallback(
    (nextScope: HomepageFeedScope) => {
      if (nextScope === scope) return;

      const currentMemory = getRememberedHomeFeed(
        scope,
        language,
        newsLocation,
      );
      currentMemory.articles = articlesRef.current;
      currentMemory.hasMore = hasMoreRef.current;
      currentMemory.scrollOffset = homeScrollOffsetRef.current;
      currentMemory.lastFetchedAt = lastFetchedAt.current;

      const nextMemory = getRememberedHomeFeed(
        nextScope,
        language,
        newsLocation,
      );

      activeRequest.current += 1;
      restoredScrollRef.current = false;
      loadingMoreRef.current = false;
      articlesRef.current = nextMemory.articles;
      hasMoreRef.current = nextMemory.hasMore;
      lastFetchedAt.current = nextMemory.lastFetchedAt;
      homeScrollOffsetRef.current = nextMemory.scrollOffset;
      onScrollOffset(nextMemory.scrollOffset);

      setArticles(nextMemory.articles);
      setHasMore(nextMemory.hasMore);
      setError(null);
      setLoading(nextMemory.articles.length === 0);
      setRefreshing(false);
      setLoadingMore(false);
      setShowTopButton(
        nextMemory.scrollOffset > SHOW_TOP_BUTTON_OFFSET,
      );
      setScope(nextScope);
    },
    [language, newsLocation, onScrollOffset, scope],
  );

  const switchScopeByDirection = useCallback(
    (direction: 1 | -1) => {
      const available = enabledHomeScopes(appConfig);
      const currentIndex = Math.max(0, available.indexOf(scope));
      const nextIndex =
        (currentIndex + direction + available.length) % available.length;
      switchScope(available[nextIndex]);
    },
    [appConfig, scope, switchScope],
  );

  useEffect(() => {
    if (!appConfig) return;
    const available = enabledHomeScopes(appConfig);
    const routeScope =
      typeof requestedFeedScope === "string" &&
      available.includes(requestedFeedScope as HomepageFeedScope)
        ? (requestedFeedScope as HomepageFeedScope)
        : null;
    const isNewRouteRequest =
      routeScope !== null &&
      routeScope !== lastAppliedRouteScopeRef.current;
    if (isNewRouteRequest) {
      lastAppliedRouteScopeRef.current = routeScope;
    }
    const preferred = routeScope ??
      (available.includes(appConfig.default_feed_scope)
        ? appConfig.default_feed_scope
        : available[0]);

    if (!didApplyDefaultScopeRef.current) {
      didApplyDefaultScopeRef.current = true;
      if (scope === preferred) return;
    } else if (!isNewRouteRequest && available.includes(scope)) {
      return;
    }

    let active = true;
    Promise.resolve().then(() => {
      if (!active || scope === preferred) return;
      switchScope(preferred);
    });
    return () => {
      active = false;
    };
  }, [appConfig, requestedFeedScope, scope, switchScope]);

  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (Platform.OS === "web") return false;
          const horizontal = Math.abs(gestureState.dx);
          const vertical = Math.abs(gestureState.dy);
          return (
            horizontal > 18 &&
            horizontal > vertical * SWIPE_DIRECTION_RATIO
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          if (Platform.OS === "web") return;
          const horizontal = Math.abs(gestureState.dx);
          const vertical = Math.abs(gestureState.dy);
          if (
            horizontal < SWIPE_TRIGGER_DISTANCE ||
            horizontal <= vertical * SWIPE_DIRECTION_RATIO
          ) {
            return;
          }

          setPendingSwipeDirection(gestureState.dx < 0 ? 1 : -1);
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [],
  );

  useEffect(() => {
    if (pendingSwipeDirection === null) return;

    const direction = pendingSwipeDirection;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setPendingSwipeDirection(null);
      switchScopeByDirection(direction);
    });

    return () => {
      active = false;
    };
  }, [pendingSwipeDirection, switchScopeByDirection]);

  const location = newsLocation.location;
  const localArea = location?.region || location?.city || "";
  const locationUsable =
    scope === "top" ||
    (newsLocation.mode !== "off" &&
      !!location?.country &&
      (scope === "national" || !!localArea));

  const loadFeed = useCallback(
    async (mode: "initial" | "refresh" | "more" = "initial") => {
      if (!authReady) return;
      if (scope !== "top" && !locationReady) {
        setLoading(false);
        return;
      }

      const activeLocation = newsLocation.location;
      const activeLocalArea = activeLocation?.region || activeLocation?.city || "";
      const canLoad =
        scope === "top" ||
        (newsLocation.mode !== "off" &&
          !!activeLocation?.country &&
          (scope === "national" || !!activeLocalArea));

      if (!canLoad) {
        activeRequest.current += 1;
        replaceArticles([]);
        updateHasMore(false);
        setLoading(false);
        setRefreshing(false);
        loadingMoreRef.current = false;
        setLoadingMore(false);
        return;
      }

      if (mode === "more") {
        if (loadingMoreRef.current || !hasMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }

      const requestId = activeRequest.current + 1;
      activeRequest.current = requestId;

      if (mode === "refresh") setRefreshing(true);
      else if (mode === "initial") setLoading(true);
      if (mode !== "more") setError(null);

      const offset = mode === "more" ? articlesRef.current.length : 0;

      try {
        const result = await getHomepageArticleFeed({
          scope,
          language,
          includeDraft: PREVIEW_DRAFTS,
          country: activeLocation?.country,
          countryCode: activeLocation?.countryCode,
          city: activeLocation?.city,
          region: activeLocation?.region,
          regionCode: activeLocation?.regionCode,
          limit: PAGE_SIZE,
          offset,
        });
        if (activeRequest.current !== requestId) return;

        const nextArticles =
          mode === "more"
            ? appendArticles(result.articles ?? [])
            : replaceArticles(result.articles ?? []);

        if (mode !== "more") {
          trackProductEvent("feed_view", {
            properties: { scope, language },
          });
        }

        const nextHasMore = result.has_more === true;
        updateHasMore(nextHasMore);

        const coverageStatus =
          scope === "local"
            ? result.local_coverage?.status
            : scope === "national"
              ? result.national_coverage?.status
              : undefined;
        const coverageBuilding =
          scope !== "top" &&
          mode !== "more" &&
          (coverageStatus === "queued" || coverageStatus === "running");

        if (
          coverageBuilding &&
          coverageRetryCountRef.current < GEO_COVERAGE_MAX_RETRIES
        ) {
          coverageRetryCountRef.current += 1;
          if (coverageRetryTimerRef.current) {
            clearTimeout(coverageRetryTimerRef.current);
          }
          coverageRetryTimerRef.current = setTimeout(() => {
            coverageRetryTimerRef.current = null;
            setCoverageRetryTick((value) => value + 1);
          }, GEO_COVERAGE_RETRY_MS);
        } else if (
          scope === "top" ||
          coverageStatus === "ready" ||
          coverageStatus === "failed"
        ) {
          coverageRetryCountRef.current = 0;
          if (coverageRetryTimerRef.current) {
            clearTimeout(coverageRetryTimerRef.current);
            coverageRetryTimerRef.current = null;
          }
        }

        const fetchedAt = Date.now();
        lastFetchedAt.current = fetchedAt;

        const remembered = getRememberedHomeFeed(
          scope,
          language,
          newsLocation,
        );
        remembered.articles = nextArticles;
        remembered.hasMore = nextHasMore;
        remembered.lastFetchedAt = fetchedAt;
      } catch (err: unknown) {
        if (activeRequest.current !== requestId) return;
        if (mode !== "more") {
          setError(err instanceof Error ? err.message : t.unableLoad);
        }
      } finally {
        if (activeRequest.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
        if (mode === "more") {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [
      appendArticles,
      authReady,
      language,
      locationReady,
      newsLocation,
      replaceArticles,
      scope,
      t.unableLoad,
      updateHasMore,
    ],
  );

  const refreshIfStale = useCallback(() => {
    if (Date.now() - lastFetchedAt.current < REFRESH_FRESHNESS_MS) return;
    void loadFeed("refresh");
  }, [loadFeed]);

  const handleEnableAutoLocation = useCallback(async () => {
    if (locationBusy) return;
    setLocationBusy(true);
    setLocationError(null);
    try {
      const next = await enableAutoNewsLocation();
      setNewsLocation(next);
      setLocationReady(true);
      if (!next.location) {
        setLocationError(
          "Location permission is unavailable or was not granted. Choose Manual or Off, or enable location permission in your device settings.",
        );
      }
    } finally {
      setLocationBusy(false);
    }
  }, [locationBusy]);

  const handleSaveManualLocation = useCallback(
    async (input: {
      country: string;
      countryCode: string | null;
      region: string;
      regionCode: string | null;
    }) => {
      if (locationBusy) return;
      setLocationBusy(true);
      setLocationError(null);
      try {
        const next = await saveManualFeedLocation(input);
        setNewsLocation(next);
        setLocationReady(true);
      } catch (err: unknown) {
        setLocationError(
          err instanceof Error ? err.message : "Unable to save news location.",
        );
      } finally {
        setLocationBusy(false);
      }
    },
    [locationBusy],
  );

  const handleDisableLocation = useCallback(async () => {
    if (locationBusy) return;
    setLocationBusy(true);
    setLocationError(null);
    try {
      const next = await disableNewsLocation();
      setNewsLocation(next);
      setLocationReady(true);
      activeRequest.current += 1;
      replaceArticles([]);
      updateHasMore(false);
      setLoading(false);
    } finally {
      setLocationBusy(false);
    }
  }, [locationBusy, replaceArticles, updateHasMore]);

  useEffect(() => {
    let active = true;
    void getNewsLocationPreference()
      .then((preference) => {
        if (!active) return;
        setNewsLocation(preference);
        setLocationReady(true);
      })
      .catch(() => {
        if (!active) return;
        setNewsLocation({ mode: "off", location: null });
        setLocationReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;

    activeRequest.current += 1;
    const remembered = getRememberedHomeFeed(
      scope,
      language,
      newsLocation,
    );

    articlesRef.current = remembered.articles;
    hasMoreRef.current = remembered.hasMore;
    lastFetchedAt.current = remembered.lastFetchedAt;
    homeScrollOffsetRef.current = remembered.scrollOffset;
    restoredScrollRef.current = remembered.scrollOffset <= 0;
    loadingMoreRef.current = false;

    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;

      setArticles(remembered.articles);
      setHasMore(remembered.hasMore);
      setError(null);
      setLoadingMore(false);
      setShowTopButton(
        remembered.scrollOffset > SHOW_TOP_BUTTON_OFFSET,
      );

      if (remembered.articles.length > 0) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      void loadFeed("initial");
    });

    return () => {
      active = false;
    };
  }, [authReady, language, loadFeed, newsLocation, scope]);

  useEffect(() => {
    // Retry bookkeeping is imperative state and belongs in an effect rather
    // than the scope-switch callback used by the touch gesture handlers.
    coverageRetryCountRef.current = 0;
    if (coverageRetryTimerRef.current) {
      clearTimeout(coverageRetryTimerRef.current);
      coverageRetryTimerRef.current = null;
    }
  }, [scope, newsLocation]);

  useEffect(() => {
    if (coverageRetryTick === 0 || scope === "top") return;
    Promise.resolve().then(() => void loadFeed("refresh"));
  }, [coverageRetryTick, loadFeed, scope]);

  useEffect(
    () => () => {
      if (coverageRetryTimerRef.current) {
        clearTimeout(coverageRetryTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const onActive = () => {
      if (newsLocation.mode !== "auto") {
        refreshIfStale();
        return;
      }

      void refreshAutoNewsLocation()
        .then((next) => {
          const changed =
            locationPreferenceKey(next) !== locationPreferenceKey(newsLocation);
          if (changed) {
            setNewsLocation(next);
            return;
          }
          refreshIfStale();
        })
        .catch(() => refreshIfStale());
    };

    if (Platform.OS === "web") {
      if (typeof document === "undefined") return;
      const onVisibility = () => {
        if (document.visibilityState === "visible") onActive();
      };
      document.addEventListener("visibilitychange", onVisibility);
      return () =>
        document.removeEventListener("visibilitychange", onVisibility);
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") onActive();
    });
    return () => subscription.remove();
  }, [newsLocation, refreshIfStale]);

  const handleScroll = useCallback(
    (event: {
      nativeEvent: {
        layoutMeasurement: { height: number };
        contentOffset: { y: number };
        contentSize: { height: number };
      };
    }) => {
      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;
      const scrollY = Math.max(0, contentOffset.y);
      if (!restoredScrollRef.current) return;

      const remembered = getRememberedHomeFeed(
        scope,
        language,
        newsLocation,
      );
      remembered.scrollOffset = scrollY;
      homeScrollOffsetRef.current = scrollY;
      onScrollOffset(scrollY);
      setShowTopButton(scrollY > SHOW_TOP_BUTTON_OFFSET);

      const session = videoSessionRef.current;
      if (session && appConfig?.floating_video_enabled !== false) {
        const currentCardY =
          session.anchorWindowY - (scrollY - session.anchorScrollOffset);
        const outsideViewport =
          currentCardY + session.anchorHeight <= 8 ||
          currentCardY >= layoutMeasurement.height - 8;

        if (outsideViewport !== videoFloatingRef.current) {
          videoFloatingRef.current = outsideViewport;
          setVideoResumeTime(Math.max(0, session.currentTime));
          setVideoFloating(outsideViewport);
        }
      }
      const distanceFromBottom =
        contentSize.height - (layoutMeasurement.height + contentOffset.y);
      if (distanceFromBottom <= LOAD_MORE_THRESHOLD) {
        void loadFeed("more");
      }
    },
    [appConfig?.floating_video_enabled, language, loadFeed, newsLocation, onScrollOffset, scope],
  );

  // Responsive editorial tiers: narrow phones, phones, tablets and desktop.
  // Maintain the original card layout, feed batching and scroll positions.
  const desktop = width >= 1000;
  const tablet = width >= 700 && width < 1000;
  const mobileHeader = width < 480;
  const narrowPhone = width < 400;
  const compactEditorial = width < 700;
  const mobileLeadFit =
    width < 700 || Math.min(width, viewportHeight) < 700;
  const showWebScopeArrows = Platform.OS === "web";
  const webScopeArrowInset = Math.max(
    14,
    (width - layout.pageMax) / 2 - 58,
  );
  const availableScopes = enabledHomeScopes(appConfig);
  const scopeIndex = Math.max(0, availableScopes.indexOf(scope));
  const previousScope =
    availableScopes[(scopeIndex - 1 + availableScopes.length) % availableScopes.length];
  const nextScope =
    availableScopes[(scopeIndex + 1) % availableScopes.length];
  const lead = articles[0];
  const secondary = articles.slice(1, 3);
  const { developingHighlights, remaining } = useMemo(
    () => selectHomepageDevelopments(articles, desktop ? 3 : 2, PAGE_SIZE),
    [articles, desktop],
  );
  const remainingBatches = chunkArticles(remaining);
  const leadLanguageMatches = lead
    ? (lead.content_language || lead.language || "").toLowerCase().replace("_", "-")
        === language.toLowerCase()
    : false;
  const leadWhyItMatters = lead?.article_version_id != null && leadLanguageMatches
    ? (lead.why_it_matters || "").trim()
    : "";
  const userIsPro = account?.translation_entitled === true;
  const homepageVideoEnabled = appConfig?.homepage_video_enabled !== false;
  const floatingVideoEnabled = appConfig?.floating_video_enabled !== false;
  const showHomeAds =
    Platform.OS !== "web" &&
    appConfig?.ads_enabled === true &&
    appConfig.home_ad_enabled === true &&
    appConfig.ad_provider === "admob" &&
    !(appConfig.ads_free_for_pro && userIsPro);
  const homeAdInterval = Math.max(1, appConfig?.home_ad_interval ?? 8);

  const videoPropsFor = (article: CanonicalArticle) => {
    const active = videoSession?.eventId === article.event_id;
    return {
      videoDetached: active && videoFloating,
      videoResumeTime: active ? videoResumeTime : 0,
      onVideoStart: handleHomeVideoStart,
      onVideoTimeUpdate: handleHomeVideoTimeUpdate,
      onVideoStop: handleHomeVideoStop,
    };
  };

  const editorialFeature = (
    article: CanonicalArticle,
    index: number,
    size: "hero" | "secondary",
  ) => (
    <View
      key={storyKey(article)}
      style={[styles.featureFrame, { borderColor: colors.border }]}
    >
      <View style={styles.featureRail}>
        <Text style={[styles.featureIndex, { color: colors.accent }]}>
          {String(index).padStart(2, "0")}
        </Text>
        <View style={[styles.featureRailRule, { backgroundColor: colors.border }]} />
        <Text style={[styles.featureLabel, { color: colors.textMuted }]} numberOfLines={1}>
          {index === 1 ? edition.lead : edition.next}
        </Text>
      </View>
      <StoryTile
        article={article}
        presentation="editorial"
        size={size}
        fitViewport={size === "hero" && mobileLeadFit}
        videoEnabled={homepageVideoEnabled}
        analyticsSource="feed"
        analyticsScope={scope}
        {...videoPropsFor(article)}
      />
    </View>
  );

  const openFloatingVideoStory = () => {
    const session = videoSessionRef.current;
    if (!session || !session.storyReady) return;
    const separator = session.storyHref.includes("?") ? "&" : "?";
    const href =
      `${session.storyHref}${separator}autoplayVideo=1&videoTime=${Math.max(
        0,
        session.currentTime,
      ).toFixed(2)}`;
    stopActiveHomepageVideo();
    handleHomeVideoStop(session.eventId);
    router.push(href as never);
  };

  const scopeControls = (
    <FeedCategoryBar active={scope} onFeedScopePress={switchScope} />
  );

  // A lead-story explanation should follow its own article, not the entire
  // featured-story group. Render this once, at every responsive breakpoint.
  const leadContextPanel = !!leadWhyItMatters && (
    <Pressable
      accessibilityRole={Platform.OS === "web" ? "link" : "button"}
      accessibilityLabel={edition.readAnalysis}
      onPress={() => router.push(storyTileHref(lead, "feed", scope) as never)}
      style={({ pressed }) => [
        styles.contextPanel,
        !desktop && styles.contextPanelStacked,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.contextAccent, { backgroundColor: colors.accent }]} />
      <View style={styles.contextCopy}>
        <Text style={[styles.contextEyebrow, { color: colors.accent }]}>
          {edition.context}
        </Text>
        <Text
          style={[styles.contextBody, { color: colors.text }]}
          numberOfLines={compactEditorial ? 3 : 2}
        >
          {leadWhyItMatters}
        </Text>
        {compactEditorial && (
          <Text style={[styles.contextActionInline, { color: colors.accent }]}>
            {edition.readAnalysis} →
          </Text>
        )}
      </View>
      {!compactEditorial && (
        <Text style={[styles.contextAction, { color: colors.accent }]}>
          {edition.readAnalysis} →
        </Text>
      )}
    </Pressable>
  );

  const listHeader = (
    <View
      style={[
        styles.page,
        styles.pageWithoutBottomPadding,
        width < 480 && styles.pageCompact,
      ]}
    >
      <AppHeader />
      <HomeInstallBanners />
      {appConfig?.announcement_enabled && !!appConfig.announcement_text && (
        <View style={[styles.announcement, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Text style={[styles.announcementText, { color: colors.text }]}>
            {appConfig.announcement_text}
          </Text>
        </View>
      )}

      <View
        style={[styles.header, mobileHeader && styles.headerCompact]}
        onLayout={(event) => {
          headerOffsetRef.current = event.nativeEvent.layout.y;
          if (categoryOffsetRef.current !== null) {
            setBarTop(headerOffsetRef.current + categoryOffsetRef.current);
          }
        }}
      >
        <View style={[styles.headingRow, narrowPhone && styles.headingRowNarrow]}>
          <View style={styles.headingCopy}>
            <View style={styles.editionKickerRow}>
              <View style={[styles.editionAccent, { backgroundColor: colors.accent }]} />
              <Text style={[styles.editionKicker, { color: colors.accent }]}>
                {edition.kicker}
              </Text>
              <View style={[styles.editionKickerRule, { backgroundColor: colors.border }]} />
            </View>
            <Text
              style={[
                styles.editionHeadline,
                compactEditorial && styles.editionHeadlineCompact,
                tablet && styles.editionHeadlineTablet,
                narrowPhone && styles.editionHeadlineNarrow,
                { color: colors.text },
              ]}
              numberOfLines={compactEditorial ? 3 : 2}
            >
              {edition.headline}
            </Text>
            <Text
              style={[
                styles.subtitle,
                compactEditorial && styles.subtitleCompact,
                { color: colors.textMuted },
              ]}
              numberOfLines={2}
            >
              {t.subtitle}
            </Text>
          </View>

          <View style={[styles.headerActions, narrowPhone && styles.headerActionsNarrow]}>
            {Platform.OS === "web" && (
              <Pressable
                onPress={() => {
                  void refreshAppConfig();
                  void loadFeed("refresh");
                }}
                disabled={refreshing || !locationUsable}
                style={({ pressed }) => [
                  styles.refreshButton,
                  { borderColor: colors.border },
                  (refreshing || !locationUsable) && styles.refreshDisabled,
                  pressed && styles.refreshPressed,
                ]}
              >
                <Text style={[styles.refreshText, { color: colors.textMuted }]}>
                  {copy.refresh}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {scope !== "top" && locationReady && (
          <NewsLocationGate
            scope={scope}
            mode={newsLocation.mode}
            location={newsLocation.location}
            busy={locationBusy}
            error={locationError}
            onEnableAuto={() => void handleEnableAutoLocation()}
            onSaveManual={(input) => void handleSaveManualLocation(input)}
            onDisable={() => void handleDisableLocation()}
          />
        )}

        <View
          onLayout={(event) => {
            categoryOffsetRef.current = event.nativeEvent.layout.y;
            setBarTop(headerOffsetRef.current + categoryOffsetRef.current);
          }}
        >
          {scopeControls}
        </View>
      </View>

      {(!authReady || (scope !== "top" && !locationReady)) && (
        <ScreenState loading message={t.loadingStories} />
      )}

      {authReady && locationUsable && loading && (
        <ScreenState loading message={t.loadingStories} />
      )}

      {authReady && locationUsable && !loading && error && (
        <ScreenState
          title={t.unableLoad}
          message={error}
          onRetry={() => void loadFeed("initial")}
        />
      )}

      {authReady && locationUsable && !loading && !error && !lead && (
        <ScreenState
          title={t.noStories}
          message={t.noStoriesMessage}
          onRetry={() => void loadFeed("refresh")}
        />
      )}

      {authReady && locationUsable && !loading && !error && lead && (
        <>
          <View style={[styles.sectionHeading, { borderTopColor: colors.border }]}>
            <View style={styles.sectionHeadingCopy}>
              <Text style={[styles.sectionEyebrow, { color: colors.accent }]}>
                {edition.inFocus}
              </Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {edition[scope]}
              </Text>
            </View>
            {!narrowPhone && <View style={[styles.sectionCount, { borderColor: colors.border }]}>
              <Text style={[styles.sectionCountText, { color: colors.textMuted }]}>
                {String(Math.min(articles.length, 3)).padStart(2, "0")} {edition.stories}
              </Text>
            </View>}
          </View>

          {desktop ? (
            <View style={styles.heroGrid}>
              <View style={styles.heroColumn}>
                {editorialFeature(lead, 1, "hero")}
                {leadContextPanel}
              </View>
              <View style={styles.secondaryColumn}>
                {secondary.map((article, index) =>
                  editorialFeature(article, index + 2, "secondary")
                )}
              </View>
            </View>
          ) : (
            <View style={styles.stack}>
              {editorialFeature(lead, 1, "hero")}
              {leadContextPanel}
              <View style={tablet ? styles.twoColumnGrid : styles.stack}>
                {secondary.map((article, index) => (
                  <View
                    key={storyKey(article)}
                    style={tablet ? styles.half : undefined}
                  >
                    {editorialFeature(article, index + 2, "secondary")}
                  </View>
                ))}
              </View>
            </View>
          )}


          {developingHighlights.length > 0 && (
            <View style={styles.developingSection}>
              <View style={[styles.sectionHeading, { borderTopColor: colors.border }]}>
                <View style={styles.sectionHeadingCopy}>
                  <Text style={[styles.sectionEyebrow, { color: colors.accent }]}>
                    {edition.inFocus}
                  </Text>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {edition.evolving}
                  </Text>
                  <Text style={[styles.developingDetail, { color: colors.textMuted }]}>
                    {edition.evolvingDetail}
                  </Text>
                </View>
                <View style={[styles.developingSignal, { backgroundColor: colors.accent }]} />
              </View>
              <View
                style={[
                  styles.developingGrid,
                  (desktop || tablet) && styles.developingGridWide,
                ]}
              >
                {developingHighlights.map((article) => (
                  <Pressable
                    key={storyKey(article)}
                    accessibilityRole={Platform.OS === "web" ? "link" : "button"}
                    accessibilityLabel={`${edition.evolving}: ${article.headline}`}
                    onPress={() =>
                      router.push(storyTileHref(article, "feed", scope) as never)
                    }
                    style={({ pressed }) => [
                      styles.developingCard,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.border,
                        opacity: pressed ? 0.80 : 1,
                      },
                      desktop ? styles.developingThird : tablet ? styles.developingHalf : styles.full,
                    ]}
                  >
                    <View style={styles.developingCardMeta}>
                      <Text style={[styles.developingCardCategory, { color: colors.accent }]} numberOfLines={1}>
                        {(article.category || edition.evolving).toUpperCase()}
                      </Text>
                      <Text style={[styles.developingCardCount, { color: colors.textMuted }]}>
                        {article.developing_story_count} {edition.connected}
                      </Text>
                    </View>
                    <Text
                      style={[styles.developingCardTitle, { color: colors.text }]}
                      numberOfLines={3}
                    >
                      {article.headline}
                    </Text>
                    <Text style={[styles.developingCardArrow, { color: colors.accent }]}>
                      ↗
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {remaining.length > 0 && (
            <View style={[styles.moreSection, { borderTopColor: colors.border }]}>
              <View style={styles.moreSectionCopy}>
                <Text style={[styles.moreHeading, { color: colors.text }]}>
                  {edition.more}
                </Text>
                {!compactEditorial && (
                  <Text style={[styles.moreSubtitle, { color: colors.textMuted }]}>
                    {edition.moreDetail}
                  </Text>
                )}
              </View>
              <View style={[styles.moreRule, { backgroundColor: colors.accent }]} />
            </View>
          )}
        </>
      )}
    </View>
  );

  const scrollToTop = () => {
    const remembered = getRememberedHomeFeed(
      scope,
      language,
      newsLocation,
    );
    remembered.scrollOffset = 0;
    homeScrollOffsetRef.current = 0;
    restoredScrollRef.current = true;
    setShowTopButton(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  if (appConfig?.maintenance_mode) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenState
          title="Briefly is temporarily unavailable"
          message={appConfig.maintenance_message ?? "We are carrying out a short maintenance update. Please try again soon."}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      {...swipeResponder.panHandlers}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <FlatList
        key={homeFeedMemoryKey(scope, language, newsLocation)}
        ref={listRef}
        style={styles.list}
        data={locationUsable ? remainingBatches : []}
        keyExtractor={(batch) => batch.map(storyKey).join(":")}
        ListHeaderComponent={listHeader}
        renderItem={({ item: batch, index }) => {
          // Count featured and promoted stories once for native ad cadence.
          // The remainder stays virtualized and each article still renders in
          // the existing fully interactive StoryTile.
          const storiesBeforeBatch =
            3 + developingHighlights.length + index * VIRTUAL_BATCH_SIZE;
          const storiesAfterBatch = storiesBeforeBatch + batch.length;
          const crossedAdBoundary =
            Math.floor(storiesAfterBatch / homeAdInterval) >
            Math.floor(storiesBeforeBatch / homeAdInterval);
          // Alternate two and three columns rather than a repetitive wall of
          // identical cards. Tablets remain two-column; phones remain one.
          const twoColumnEdition = desktop && index % 2 === 1;

          return (
            <View
              style={[
                styles.page,
                styles.pageWithoutBottomPadding,
                width < 480 && styles.pageCompact,
              ]}
            >
              {index > 0 && index % 2 === 1 && (
                <View style={styles.feedInterlude}>
                  <Text style={[styles.feedInterludeText, { color: colors.accent }]}>
                    {edition.brief}
                  </Text>
                  <View style={[styles.feedInterludeRule, { backgroundColor: colors.border }]} />
                </View>
              )}
              <View
                style={[
                  styles.feedGrid,
                  (desktop || tablet) && styles.feedGridWide,
                ]}
              >
                {batch.map((article) => (
                  <View
                    key={storyKey(article)}
                    style={
                      desktop
                        ? twoColumnEdition ? styles.half : styles.third
                        : tablet
                          ? styles.half
                          : styles.full
                    }
                  >
                    <StoryTile
                      article={article}
                      presentation="editorial"
                      videoEnabled={homepageVideoEnabled}
                      analyticsSource="feed"
                      analyticsScope={scope}
                      {...videoPropsFor(article)}
                    />
                  </View>
                ))}
              </View>

              {showHomeAds && crossedAdBoundary && <HomeAdSlot />}
            </View>
          );
        }}
        ListFooterComponent={
          <View style={[styles.page, width < 480 && styles.pageCompact]}>
            {locationUsable && loadingMore && (
              <View style={styles.loadMoreIndicator}>
                <ActivityIndicator color={colors.textMuted} />
              </View>
            )}

            {locationUsable && !loadingMore && hasMore && (
              <View style={styles.loadMoreSpacer} />
            )}
          </View>
        }
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => {
          if (
            restoredScrollRef.current ||
            articlesRef.current.length === 0
          ) {
            return;
          }

          const remembered = getRememberedHomeFeed(
            scope,
            language,
            newsLocation,
          );
          const rememberedOffset = remembered.scrollOffset;

          if (rememberedOffset <= 0) {
            restoredScrollRef.current = true;
            onScrollOffset(0);
            return;
          }

          requestAnimationFrame(() => {
            listRef.current?.scrollToOffset({
              offset: rememberedOffset,
              animated: false,
            });
            requestAnimationFrame(() => {
              homeScrollOffsetRef.current = rememberedOffset;
              restoredScrollRef.current = true;
              setShowTopButton(
                rememberedOffset > SHOW_TOP_BUTTON_OFFSET,
              );
              onScrollOffset(rememberedOffset);
            });
          });
        }}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        refreshControl={
          Platform.OS === "web" || !locationUsable ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void refreshAppConfig();
                void loadFeed("refresh");
              }}
            />
          )
        }
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={5}
      />

      <PinnedFeedCategoryBar
        visible={categoriesPinned}
        active={scope}
        onFeedScopePress={switchScope}
      />

      {showWebScopeArrows && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Previous category: ${copy[previousScope]}`}
            accessibilityHint="Switches to the previous news category and restores its saved position"
            onPress={() => switchScopeByDirection(-1)}
            style={({ pressed }) => [
              styles.scopeArrowButton,
              {
                left: webScopeArrowInset,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.64 : 0.9,
              },
            ]}
          >
            <Text
              accessible={false}
              style={[styles.scopeArrowText, { color: colors.text }]}
            >
              ‹
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Next category: ${copy[nextScope]}`}
            accessibilityHint="Switches to the next news category and restores its saved position"
            onPress={() => switchScopeByDirection(1)}
            style={({ pressed }) => [
              styles.scopeArrowButton,
              {
                right: webScopeArrowInset,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.64 : 0.9,
              },
            ]}
          >
            <Text
              accessible={false}
              style={[styles.scopeArrowText, { color: colors.text }]}
            >
              ›
            </Text>
          </Pressable>
        </>
      )}

      {floatingVideoEnabled && videoFloating && videoSession && (
        <FloatingStoryVideo
          url={videoSession.url}
          posterUrl={videoSession.posterUrl}
          accessibilityLabel={videoSession.headline}
          initialTime={videoResumeTime}
          onTimeUpdate={(seconds) =>
            handleHomeVideoTimeUpdate(videoSession.eventId, seconds)
          }
          onClose={() => {
            stopActiveHomepageVideo();
            handleHomeVideoStop(videoSession.eventId);
          }}
          onOpenStory={
            videoSession.storyReady ? openFloatingVideoStory : undefined
          }
        />
      )}

      {showTopButton && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to top"
          onPress={scrollToTop}
          style={({ pressed }) => [
            styles.topButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.72 : 0.94,
            },
          ]}
        >
          <Text style={[styles.topButtonText, { color: colors.text }]}>↑</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flex: 1, width: "100%" },
  scrollContent: {},
  page: {
    width: "100%",
    maxWidth: layout.pageMax,
    paddingHorizontal: layout.pagePadding,
    paddingBottom: 80,
    alignSelf: "center",
  },
  pageWithoutBottomPadding: { paddingBottom: 0 },
  pageCompact: { paddingHorizontal: layout.pagePaddingCompact },
  announcement: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
  },
  announcementText: { fontSize: 14, lineHeight: 20, fontWeight: "700" },
  header: { paddingTop: 22, paddingBottom: 20, gap: 18 },
  headerCompact: { paddingTop: 14, paddingBottom: 14, gap: 12 },
  headingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headingRowNarrow: { flexDirection: "column", gap: 8 },
  headingCopy: { flex: 1, minWidth: 0, gap: 8 },
  editionKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minWidth: 0,
    marginBottom: 3,
  },
  editionAccent: { height: 7, width: 7, borderRadius: 4 },
  editionKicker: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "900",
    letterSpacing: 1.55,
    flexShrink: 1,
  },
  editionKickerRule: { width: 40, height: 1, flexShrink: 1 },
  editionHeadline: {
    fontSize: 43,
    lineHeight: 50,
    letterSpacing: -1.3,
    fontWeight: "900",
    maxWidth: 850,
  },
  editionHeadlineCompact: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  editionHeadlineTablet: {
    fontSize: 36,
    lineHeight: 43,
  },
  editionHeadlineNarrow: {
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
    gap: 10,
  },
  headerActionsNarrow: { alignSelf: "flex-end" },
  subtitle: { fontSize: 15, lineHeight: 23, maxWidth: 780 },
  subtitleCompact: { fontSize: 13, lineHeight: 18 },
  refreshButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  refreshDisabled: { opacity: 0.5 },
  refreshPressed: { opacity: 0.7 },
  refreshText: { fontSize: 12, fontWeight: "700" },
  sectionHeading: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    paddingBottom: 14,
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 10,
  },
  sectionHeadingCopy: { flex: 1, minWidth: 0, gap: 4 },
  sectionEyebrow: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 1.55,
  },
  sectionTitle: { fontSize: 27, lineHeight: 33, fontWeight: "900", letterSpacing: -0.5 },
  sectionCount: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    flexShrink: 0,
  },
  sectionCountText: { fontSize: 10, lineHeight: 14, fontWeight: "800", letterSpacing: 0.6 },
  featureFrame: {
    gap: 8,
    minWidth: 0,
  },
  featureRail: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    height: 23,
    gap: 8,
  },
  featureIndex: { fontSize: 12, lineHeight: 16, fontWeight: "900", letterSpacing: 0.6 },
  featureRailRule: { width: 19, height: 1 },
  featureLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  contextPanel: {
    marginTop: 18,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  contextPanelStacked: { marginTop: 0 },
  contextAccent: { width: 4, borderRadius: 4, alignSelf: "stretch" },
  contextCopy: { flex: 1, minWidth: 0, gap: 5 },
  contextEyebrow: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  contextBody: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  contextActionInline: {
    alignSelf: "flex-start",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    marginTop: 5,
  },
  contextAction: {
    maxWidth: 185,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "right",
  },
  developingSection: { marginTop: 26, gap: 2 },
  developingDetail: { fontSize: 13, lineHeight: 19, marginTop: 1 },
  developingSignal: { width: 8, height: 8, borderRadius: 4, alignSelf: "center" },
  developingGrid: { gap: 12 },
  developingGridWide: { flexDirection: "row", flexWrap: "wrap" },
  developingThird: { flexBasis: "31%", flexGrow: 1 },
  developingHalf: { flexBasis: "48%", flexGrow: 1 },
  developingCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    minHeight: 154,
    padding: 17,
    justifyContent: "space-between",
    gap: 12,
    minWidth: 0,
  },
  developingCardMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },
  developingCardCategory: {
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.75,
    fontWeight: "900",
    flexShrink: 1,
  },
  developingCardCount: { fontSize: 11, lineHeight: 16, fontWeight: "700" },
  developingCardTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.18,
    flex: 1,
  },
  developingCardArrow: { fontSize: 19, lineHeight: 22, alignSelf: "flex-end" },
  heroGrid: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroColumn: { flex: 2, minWidth: 0 },
  secondaryColumn: { flex: 1, minWidth: 0, gap: 10 },
  stack: { gap: 12 },
  twoColumnGrid: { flexDirection: "row", gap: 12 },
  moreSection: {
    marginTop: 32,
    marginBottom: 8,
    paddingTop: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  moreSectionCopy: { flex: 1, minWidth: 0, gap: 3 },
  moreHeading: { fontSize: 26, lineHeight: 32, fontWeight: "900", letterSpacing: -0.4 },
  moreSubtitle: { fontSize: 13, lineHeight: 19 },
  moreRule: { height: 3, width: 42, borderRadius: 2 },
  feedInterlude: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 26,
    marginBottom: 4,
    gap: 14,
  },
  feedInterludeText: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.4,
    fontWeight: "900",
    flexShrink: 0,
  },
  feedInterludeRule: { flex: 1, height: StyleSheet.hairlineWidth },
  feedGrid: { marginTop: 10, gap: 12 },
  feedGridWide: { flexDirection: "row", flexWrap: "wrap" },
  third: { flexBasis: "31%", flexGrow: 1, minWidth: 0 },
  half: { flexBasis: "48%", flexGrow: 1, minWidth: 0 },
  full: { width: "100%" },
  loadMoreIndicator: {
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreSpacer: { height: 32 },
  scopeArrowButton: {
    position: "absolute",
    top: "50%",
    width: 48,
    height: 48,
    marginTop: -24,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 12,
  },
  scopeArrowText: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "500",
    marginTop: -2,
  },
  topButton: {
    position: "absolute",
    right: 18,
    bottom: 22,
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  topButtonText: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "900",
  },
});

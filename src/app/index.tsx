import { router } from "expo-router";
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
  getBrieflyAppConfig,
  getHomepageArticleFeed,
  type BrieflyAppConfig,
  type HomepageFeedScope,
} from "@/api/briefly";
import { AppHeader } from "@/components/app-header";
import { FloatingStoryVideo } from "@/components/floating-story-video";
// Metro resolves the platform-specific .native/.web implementation at runtime.
// eslint-disable-next-line import/no-unresolved
import { HomeAdSlot } from "@/components/home-ad-slot";
// Metro resolves the platform-specific .native/.web implementation at runtime.
// eslint-disable-next-line import/no-unresolved
import { HomeInstallBanners } from "@/components/home-install-banners";
import { NewsLocationGate } from "@/components/news-location-gate";
import { ScreenState } from "@/components/screen-state";
import {
  StoryTile,
  stopActiveHomepageVideo,
  type StoryTileVideoStart,
} from "@/components/story-tile";
import { useBrieflyAuth } from "@/context/auth";
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

const scopes: HomepageFeedScope[] = ["top", "national", "local"];
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
  const { width } = useWindowDimensions();
  const { language, t } = useBrieflyLanguage();
  const { ready: authReady, account } = useBrieflyAuth();
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
  const [appConfig, setAppConfig] = useState<BrieflyAppConfig | null>(null);
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
  const videoSessionRef = useRef<HomeVideoSession | null>(null);
  const videoFloatingRef = useRef(false);
  const [pendingSwipeDirection, setPendingSwipeDirection] = useState<
    1 | -1 | null
  >(null);
  const [videoSession, setVideoSession] = useState<HomeVideoSession | null>(null);
  const [videoFloating, setVideoFloating] = useState(false);
  const [videoResumeTime, setVideoResumeTime] = useState(0);

  const copy = feedCopy[language] ?? feedCopy.en;

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
    [language, newsLocation, scope],
  );

  const switchScopeByDirection = useCallback(
    (direction: 1 | -1) => {
      const currentIndex = scopes.indexOf(scope);
      const nextIndex =
        (currentIndex + direction + scopes.length) % scopes.length;
      switchScope(scopes[nextIndex]);
    },
    [scope, switchScope],
  );

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

    void getBrieflyAppConfig()
      .then(setAppConfig)
      .catch(() => setAppConfig(null));
  }, [authReady]);

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
      setShowTopButton(scrollY > SHOW_TOP_BUTTON_OFFSET);

      const session = videoSessionRef.current;
      if (session) {
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
    [language, loadFeed, newsLocation, scope],
  );

  const desktop = width >= 1000;
  const tablet = width >= 700 && width < 1000;
  const mobileHeader = width < 480;
  const showWebScopeArrows = Platform.OS === "web" && width >= 1000;
  const webScopeArrowInset = Math.max(
    14,
    (width - layout.pageMax) / 2 - 58,
  );
  const scopeIndex = scopes.indexOf(scope);
  const previousScope =
    scopes[(scopeIndex - 1 + scopes.length) % scopes.length];
  const nextScope = scopes[(scopeIndex + 1) % scopes.length];
  const lead = articles[0];
  const secondary = articles.slice(1, 3);
  const remaining = articles.slice(3);
  const remainingBatches = chunkArticles(remaining);
  const userIsPro = account?.translation_entitled === true;
  const homepageVideoEnabled = appConfig?.homepage_video_enabled !== false;
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
    <View style={[styles.scopeTabs, !mobileHeader && styles.scopeTabsWide]}>
      {scopes.map((item) => {
        const selected = scope === item;
        return (
          <Pressable
            key={item}
            onPress={() => switchScope(item)}
            style={[
              styles.scopeTab,
              {
                borderColor: selected ? colors.text : colors.border,
                backgroundColor: selected ? colors.text : "transparent",
              },
            ]}
          >
            <Text
              style={[
                styles.scopeText,
                { color: selected ? colors.background : colors.textMuted },
              ]}
              numberOfLines={1}
            >
              {copy[item]}
            </Text>
          </Pressable>
        );
      })}
    </View>
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

      <View style={[styles.header, mobileHeader && styles.headerCompact]}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text
              style={[
                styles.subtitle,
                mobileHeader && styles.subtitleCompact,
                { color: colors.textMuted },
              ]}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {t.subtitle}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {Platform.OS === "web" && (
              <Pressable
                onPress={() => void loadFeed("refresh")}
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
            {!mobileHeader && scopeControls}
          </View>
        </View>

        {mobileHeader && scopeControls}
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
          {desktop ? (
            <View style={styles.heroGrid}>
              <View style={styles.heroColumn}>
                <StoryTile
                  article={lead}
                  size="hero"
                  videoEnabled={homepageVideoEnabled}
                  analyticsSource="feed"
                  analyticsScope={scope}
                  {...videoPropsFor(lead)}
                />
              </View>
              <View style={styles.secondaryColumn}>
                {secondary.map((article) => (
                  <StoryTile
                    key={storyKey(article)}
                    article={article}
                    size="secondary"
                    videoEnabled={homepageVideoEnabled}
                    analyticsSource="feed"
                    analyticsScope={scope}
                    {...videoPropsFor(article)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.stack}>
              <StoryTile
                article={lead}
                size="hero"
                videoEnabled={homepageVideoEnabled}
                analyticsSource="feed"
                analyticsScope={scope}
                {...videoPropsFor(lead)}
              />
              <View style={tablet ? styles.twoColumnGrid : styles.stack}>
                {secondary.map((article) => (
                  <View
                    key={storyKey(article)}
                    style={tablet ? styles.half : undefined}
                  >
                    <StoryTile
                      article={article}
                      size="secondary"
                      videoEnabled={homepageVideoEnabled}
                      analyticsSource="feed"
                      analyticsScope={scope}
                      {...videoPropsFor(article)}
                    />
                  </View>
                ))}
              </View>
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
          const storiesBeforeBatch = 3 + index * VIRTUAL_BATCH_SIZE;
          const storiesAfterBatch = storiesBeforeBatch + batch.length;
          const crossedAdBoundary =
            Math.floor(storiesAfterBatch / homeAdInterval) >
            Math.floor(storiesBeforeBatch / homeAdInterval);

          return (
            <View
              style={[
                styles.page,
                styles.pageWithoutBottomPadding,
                width < 480 && styles.pageCompact,
              ]}
            >
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
                        ? styles.third
                        : tablet
                          ? styles.half
                          : styles.full
                    }
                  >
                    <StoryTile
                      article={article}
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
            });
          });
        }}
        onScroll={handleScroll}
        scrollEventThrottle={200}
        refreshControl={
          Platform.OS === "web" || !locationUsable ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadFeed("refresh")}
            />
          )
        }
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={5}
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

      {videoFloating && videoSession && (
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
  header: { paddingTop: 22, paddingBottom: 20, gap: 18 },
  headerCompact: { paddingTop: 14, paddingBottom: 12, gap: 12 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },
  headingCopy: { flex: 1, minWidth: 0 },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
    gap: 10,
  },
  subtitle: { fontSize: 21, lineHeight: 29 },
  subtitleCompact: { fontSize: 15, lineHeight: 20 },
  refreshButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  refreshDisabled: { opacity: 0.5 },
  refreshPressed: { opacity: 0.7 },
  refreshText: { fontSize: 12, fontWeight: "700" },
  scopeTabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  scopeTabsWide: {
    flexWrap: "nowrap",
    flexShrink: 0,
    justifyContent: "flex-end",
  },
  scopeTab: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  scopeText: { fontSize: 14, fontWeight: "800" },
  heroGrid: { flexDirection: "row", gap: 8 },
  heroColumn: { flex: 2 },
  secondaryColumn: { flex: 1, gap: 8 },
  stack: { gap: 10 },
  twoColumnGrid: { flexDirection: "row", gap: 10 },
  feedGrid: { marginTop: 10, gap: 10 },
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

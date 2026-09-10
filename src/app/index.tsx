import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getBrieflyAppConfig,
  getHomepageArticleFeed,
  type BrieflyAppConfig,
  type HomepageFeedScope,
} from "@/api/briefly";
import { AppHeader } from "@/components/app-header";
// Metro resolves the platform-specific .native/.web implementation at runtime.
// eslint-disable-next-line import/no-unresolved
import { HomeAdSlot } from "@/components/home-ad-slot";
import { ScreenState } from "@/components/screen-state";
import { StoryTile } from "@/components/story-tile";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";
import { layout } from "@/theme/tokens";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";
const REFRESH_FRESHNESS_MS = 2 * 60 * 1000;
const DEFAULT_COUNTRY = "Australia";
const DEFAULT_CITY = "Sydney";
const PAGE_SIZE = 20;
const LOAD_MORE_THRESHOLD = 800;
const VIRTUAL_BATCH_SIZE = 6;
const SHOW_TOP_BUTTON_OFFSET = 700;

let rememberedHomeScrollOffset = 0;

const feedCopy = {
  en: { top: "Top", national: "National", local: "Local", refresh: "Refresh" },
  es: { top: "Principal", national: "Nacional", local: "Local", refresh: "Actualizar" },
  ja: { top: "トップ", national: "国内", local: "地域", refresh: "更新" },
  "zh-CN": { top: "头条", national: "全国", local: "本地", refresh: "刷新" },
  "zh-TW": { top: "頭條", national: "全國", local: "本地", refresh: "重新整理" },
} as const;

const scopes: HomepageFeedScope[] = ["top", "national", "local"];
const storyKey = (article: CanonicalArticle) =>
  String(article.article_version_id ?? article.event_id);

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

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { language, t } = useBrieflyLanguage();
  const { ready: authReady, account } = useBrieflyAuth();
  const { colors } = useBrieflyTheme();

  const [scope, setScope] = useState<HomepageFeedScope>("top");
  const [appConfig, setAppConfig] = useState<BrieflyAppConfig | null>(null);
  const [articles, setArticles] = useState<CanonicalArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [showTopButton, setShowTopButton] = useState(
    rememberedHomeScrollOffset > SHOW_TOP_BUTTON_OFFSET,
  );
  const [error, setError] = useState<string | null>(null);
  const lastFetchedAt = useRef(0);
  const activeRequest = useRef(0);
  const articlesRef = useRef<CanonicalArticle[]>([]);
  const listRef = useRef<FlatList<CanonicalArticle[]>>(null);
  const restoredScrollRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);

  const copy = feedCopy[language] ?? feedCopy.en;

  const replaceArticles = useCallback((next: CanonicalArticle[]) => {
    articlesRef.current = next;
    setArticles(next);
  }, []);

  const appendArticles = useCallback((next: CanonicalArticle[]) => {
    const merged = mergeUnique(articlesRef.current, next);
    articlesRef.current = merged;
    setArticles(merged);
  }, []);

  const updateHasMore = useCallback((value: boolean) => {
    hasMoreRef.current = value;
    setHasMore(value);
  }, []);

  const loadFeed = useCallback(
    async (mode: "initial" | "refresh" | "more" = "initial") => {
      if (!authReady) return;

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
          country: DEFAULT_COUNTRY,
          city: DEFAULT_CITY,
          limit: PAGE_SIZE,
          offset,
        });
        if (activeRequest.current !== requestId) return;

        if (mode === "more") appendArticles(result.articles ?? []);
        else replaceArticles(result.articles ?? []);

        updateHasMore(result.has_more === true);
        lastFetchedAt.current = Date.now();
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

  useEffect(() => {
    if (!authReady) return;

    void getBrieflyAppConfig()
      .then(setAppConfig)
      .catch(() => setAppConfig(null));
  }, [authReady]);

  useEffect(() => {
    if (!authReady) return;

    articlesRef.current = [];
    hasMoreRef.current = false;
    Promise.resolve().then(() => void loadFeed("initial"));
  }, [authReady, loadFeed, language, scope]);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof document === "undefined") return;
      const onVisibility = () => {
        if (document.visibilityState === "visible") refreshIfStale();
      };
      document.addEventListener("visibilitychange", onVisibility);
      return () => document.removeEventListener("visibilitychange", onVisibility);
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") refreshIfStale();
    });
    return () => subscription.remove();
  }, [refreshIfStale]);

  const handleScroll = useCallback(
    (event: {
      nativeEvent: {
        layoutMeasurement: { height: number };
        contentOffset: { y: number };
        contentSize: { height: number };
      };
    }) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      rememberedHomeScrollOffset = Math.max(0, contentOffset.y);
      setShowTopButton(contentOffset.y > SHOW_TOP_BUTTON_OFFSET);
      const distanceFromBottom =
        contentSize.height - (layoutMeasurement.height + contentOffset.y);
      if (distanceFromBottom <= LOAD_MORE_THRESHOLD) {
        void loadFeed("more");
      }
    },
    [loadFeed],
  );

  const desktop = width >= 1000;
  const tablet = width >= 700 && width < 1000;
  const mobileHeader = width < 480;
  const lead = articles[0];
  const secondary = articles.slice(1, 3);
  const remaining = articles.slice(3);
  const remainingBatches = chunkArticles(remaining);
  const userIsPro = account?.translation_entitled === true;
  const showHomeAds =
    Platform.OS !== "web" &&
    appConfig?.ads_enabled === true &&
    appConfig.home_ad_enabled === true &&
    appConfig.ad_provider === "admob" &&
    !(appConfig.ads_free_for_pro && userIsPro);
  const homeAdInterval = Math.max(1, appConfig?.home_ad_interval ?? 8);

  useEffect(() => {
    if (Platform.OS === "web") return;
    console.log("[Briefly Ads] gate", {
      platform: Platform.OS,
      appConfig,
      userIsPro,
      showHomeAds,
      homeAdInterval,
    });
  }, [appConfig, homeAdInterval, showHomeAds, userIsPro]);

  const scopeControls = (
    <View style={[styles.scopeTabs, !mobileHeader && styles.scopeTabsWide]}>
      {scopes.map((item) => {
        const selected = scope === item;
        return (
          <Pressable
            key={item}
            onPress={() => setScope(item)}
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
    <View style={[styles.page, styles.pageWithoutBottomPadding, width < 480 && styles.pageCompact]}>
      <AppHeader />

      <View style={[styles.header, mobileHeader && styles.headerCompact]}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  mobileHeader && styles.titleCompact,
                  { color: colors.text },
                ]}
              >
                {t.topStories}
              </Text>
              {Platform.OS === "web" && (
                <Pressable
                  onPress={() => void loadFeed("refresh")}
                  disabled={refreshing}
                  style={({ pressed }) => [
                    styles.refreshButton,
                    { borderColor: colors.border },
                    refreshing && styles.refreshDisabled,
                    pressed && styles.refreshPressed,
                  ]}
                >
                  <Text style={[styles.refreshText, { color: colors.textMuted }]}>
                    {copy.refresh}
                  </Text>
                </Pressable>
              )}
            </View>
            <Text
              style={[
                styles.subtitle,
                mobileHeader && styles.subtitleCompact,
                { color: colors.textMuted },
              ]}
            >
              {t.subtitle}
            </Text>
          </View>

          {!mobileHeader && scopeControls}
        </View>

        {mobileHeader && scopeControls}
      </View>

      {(!authReady || loading) && (
        <ScreenState loading message={t.loadingStories} />
      )}

      {authReady && !loading && error && (
        <ScreenState
          title={t.unableLoad}
          message={error}
          onRetry={() => void loadFeed("initial")}
        />
      )}

      {authReady && !loading && !error && !lead && (
        <ScreenState
          title={t.noStories}
          message={t.noStoriesMessage}
          onRetry={() => void loadFeed("refresh")}
        />
      )}

      {authReady && !loading && !error && lead && (
        <>
          {desktop ? (
            <View style={styles.heroGrid}>
              <View style={styles.heroColumn}>
                <StoryTile article={lead} size="hero" />
              </View>
              <View style={styles.secondaryColumn}>
                {secondary.map((article) => (
                  <StoryTile key={storyKey(article)} article={article} size="secondary" />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.stack}>
              <StoryTile article={lead} size="hero" />
              <View style={tablet ? styles.twoColumnGrid : styles.stack}>
                {secondary.map((article) => (
                  <View key={storyKey(article)} style={tablet ? styles.half : undefined}>
                    <StoryTile article={article} size="secondary" />
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
    rememberedHomeScrollOffset = 0;
    restoredScrollRef.current = true;
    setShowTopButton(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        ref={listRef}
        style={styles.list}
        data={remainingBatches}
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
                    style={desktop ? styles.third : tablet ? styles.half : styles.full}
                  >
                    <StoryTile article={article} />
                  </View>
                ))}
              </View>

              {showHomeAds && crossedAdBoundary && <HomeAdSlot />}
            </View>
          );
        }}
        ListFooterComponent={
          <View style={[styles.page, width < 480 && styles.pageCompact]}>
            {loadingMore && (
              <View style={styles.loadMoreIndicator}>
                <ActivityIndicator color={colors.textMuted} />
              </View>
            )}

            {!loadingMore && hasMore && <View style={styles.loadMoreSpacer} />}
          </View>
        }
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => {
          if (
            restoredScrollRef.current ||
            rememberedHomeScrollOffset <= 0 ||
            articlesRef.current.length === 0
          ) {
            return;
          }

          restoredScrollRef.current = true;
          requestAnimationFrame(() => {
            listRef.current?.scrollToOffset({
              offset: rememberedHomeScrollOffset,
              animated: false,
            });
          });
        }}
        onScroll={handleScroll}
        scrollEventThrottle={200}
        refreshControl={
          Platform.OS === "web" ? undefined : (
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
  header: { paddingTop: 28, paddingBottom: 24, gap: 20 },
  headerCompact: { paddingTop: 16, paddingBottom: 14, gap: 12 },
  headingRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 18,
  },
  headingCopy: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  title: {
    fontSize: 43,
    lineHeight: 50,
    fontWeight: "900",
    letterSpacing: -1.1,
  },
  titleCompact: { fontSize: 31, lineHeight: 36, letterSpacing: -0.6 },
  subtitle: { marginTop: 6, fontSize: 21, lineHeight: 29 },
  subtitleCompact: { marginTop: 4, fontSize: 15, lineHeight: 20 },
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

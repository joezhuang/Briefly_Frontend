import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getHomepageArticleFeed,
  type HomepageFeedScope,
} from "@/api/briefly";
import { AppHeader } from "@/components/app-header";
import { ScreenState } from "@/components/screen-state";
import { StoryTile } from "@/components/story-tile";
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

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  const [scope, setScope] = useState<HomepageFeedScope>("top");
  const [articles, setArticles] = useState<CanonicalArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedAt = useRef(0);
  const activeRequest = useRef(0);
  const articlesRef = useRef<CanonicalArticle[]>([]);
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
    [appendArticles, language, replaceArticles, scope, t.unableLoad, updateHasMore],
  );

  const refreshIfStale = useCallback(() => {
    if (Date.now() - lastFetchedAt.current < REFRESH_FRESHNESS_MS) return;
    void loadFeed("refresh");
  }, [loadFeed]);

  useEffect(() => {
    articlesRef.current = [];
    hasMoreRef.current = false;
    Promise.resolve().then(() => void loadFeed("initial"));
  }, [loadFeed, language, scope]);

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
  const mobileHeader = width < 700;
  const lead = articles[0];
  const secondary = articles.slice(1, 3);
  const remaining = articles.slice(3);

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

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
      >
        <View style={[styles.page, width < 480 && styles.pageCompact]}>
          <AppHeader />

          <View style={styles.header}>
            <View style={styles.headingRow}>
              <View style={styles.headingCopy}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { color: colors.text }]}>{t.topStories}</Text>
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
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t.subtitle}</Text>
              </View>

              {!mobileHeader && scopeControls}
            </View>

            {mobileHeader && scopeControls}
          </View>

          {loading && <ScreenState loading message={t.loadingStories} />}

          {!loading && error && (
            <ScreenState
              title={t.unableLoad}
              message={error}
              onRetry={() => void loadFeed("initial")}
            />
          )}

          {!loading && !error && !lead && (
            <ScreenState
              title={t.noStories}
              message={t.noStoriesMessage}
              onRetry={() => void loadFeed("refresh")}
            />
          )}

          {!loading && !error && lead && (
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

              <View style={[styles.feedGrid, (desktop || tablet) && styles.feedGridWide]}>
                {remaining.map((article) => (
                  <View
                    key={storyKey(article)}
                    style={desktop ? styles.third : tablet ? styles.half : styles.full}
                  >
                    <StoryTile article={article} />
                  </View>
                ))}
              </View>

              {loadingMore && (
                <View style={styles.loadMoreIndicator}>
                  <ActivityIndicator color={colors.textMuted} />
                </View>
              )}

              {!loadingMore && hasMore && <View style={styles.loadMoreSpacer} />}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { alignItems: "center" },
  page: {
    width: "100%",
    maxWidth: layout.pageMax,
    paddingHorizontal: layout.pagePadding,
    paddingBottom: 80,
  },
  pageCompact: { paddingHorizontal: layout.pagePaddingCompact },
  header: { paddingTop: 28, paddingBottom: 24, gap: 20 },
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
  subtitle: { marginTop: 6, fontSize: 21, lineHeight: 29 },
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
});

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { searchBrieflyArticles } from "@/api/search";
import { AppHeader } from "@/components/app-header";
import { ScreenState } from "@/components/screen-state";
import { StoryTile } from "@/components/story-tile";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";
import { layout } from "@/theme/tokens";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";
const SEARCH_DEBOUNCE_MS = 450;

const searchCopy = {
  en: { subtitle: "Search current Briefly stories and the developments in their timelines." },
  es: { subtitle: "Busca noticias actuales de Briefly y los acontecimientos de sus cronologías." },
  ja: { subtitle: "Brieflyの現在の記事と、そのタイムライン上の展開を検索できます。" },
  "zh-CN": { subtitle: "搜索 Briefly 当前新闻及其时间线中的事件进展。" },
  "zh-TW": { subtitle: "搜尋 Briefly 當前新聞及其時間線中的事件進展。" },
} as const;

export default function SearchScreen() {
  const { width } = useWindowDimensions();
  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const labels = searchCopy[language] ?? searchCopy.en;

  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<CanonicalArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  useEffect(() => {
    if (!trimmedQuery) return;

    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);

      void searchBrieflyArticles(trimmedQuery, {
        includeDraft: PREVIEW_DRAFTS,
        language,
        limit: 30,
      })
        .then((result) => {
          if (!active) return;
          setArticles(result.articles ?? []);
          setHasSearched(true);
        })
        .catch((err: unknown) => {
          if (!active) return;
          setArticles([]);
          setHasSearched(true);
          setError(err instanceof Error ? err.message : t.searchUnavailable);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [language, trimmedQuery, t.searchUnavailable]);

  const visibleArticles = hasQuery ? articles : [];
  const visibleError = hasQuery ? error : null;
  const showLoading = hasQuery && loading;
  const showNoMatches =
    hasQuery && hasSearched && !showLoading && visibleArticles.length === 0;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.page, width < 480 && styles.pageCompact]}>
          <AppHeader />

          <View style={styles.header}>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {labels.subtitle}
            </Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t.searchPlaceholder}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    color: colors.text,
                  },
                ]}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {showLoading ? (
                <ActivityIndicator
                  size="small"
                  color={colors.accent}
                  style={styles.inputSpinner}
                />
              ) : null}
            </View>
          </View>

          {visibleError ? (
            <ScreenState title={t.searchUnavailable} message={visibleError} />
          ) : showNoMatches ? (
            <ScreenState title={t.noMatches} message={t.noMatchesMessage} />
          ) : visibleArticles.length > 0 ? (
            <View style={styles.grid}>
              {visibleArticles.map((article) => (
                <View
                  key={String(article.event_id ?? article.article_version_id)}
                  style={styles.card}
                >
                  <StoryTile article={article} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { alignItems: "center" },
  page: {
    width: "100%",
    maxWidth: layout.pageMax,
    paddingHorizontal: layout.pagePadding,
    paddingBottom: 80,
  },
  pageCompact: {
    paddingHorizontal: layout.pagePaddingCompact,
  },
  header: { paddingVertical: 28, gap: 14 },
  subtitle: { maxWidth: 760, fontSize: 18, lineHeight: 27 },
  inputWrap: { position: "relative" },
  input: {
    width: "100%",
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingRight: 48,
    fontSize: 17,
  },
  inputSpinner: {
    position: "absolute",
    right: 16,
    top: 15,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { minWidth: 0, flexGrow: 1, flexBasis: 300, maxWidth: "100%" },
});

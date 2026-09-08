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

export default function SearchScreen() {
  const { width } = useWindowDimensions();
  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<CanonicalArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setArticles([]);
      setLoading(false);
      setError(null);
      setHasSearched(false);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);

      void searchBrieflyArticles(trimmed, {
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
  }, [language, query, t.searchUnavailable]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.page, width < 480 && styles.pageCompact]}>
          <AppHeader />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t.search}
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
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color={colors.accent}
                  style={styles.inputSpinner}
                />
              ) : null}
            </View>
          </View>

          {error ? (
            <ScreenState title={t.searchUnavailable} message={error} />
          ) : hasSearched && !loading && articles.length === 0 ? (
            <ScreenState title={t.noMatches} message={t.noMatchesMessage} />
          ) : articles.length > 0 ? (
            <View style={styles.grid}>
              {articles.map((article) => (
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
  header: { paddingVertical: 28, gap: 18 },
  title: { fontSize: 42, fontWeight: "900" },
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

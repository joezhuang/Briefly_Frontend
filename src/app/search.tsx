import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCanonicalArticles } from "@/api/briefly";
import { AppHeader } from "@/components/app-header";
import { ScreenState } from "@/components/screen-state";
import { StoryTile } from "@/components/story-tile";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";
import { layout } from "@/theme/tokens";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";

export default function SearchScreen() {
  const { width } = useWindowDimensions();
  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<CanonicalArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (!active) return;

      setLoading(true);
      setError(null);

      getCanonicalArticles({
        includeDraft: PREVIEW_DRAFTS,
        language,
        limit: 50,
      })
        .then((result) => {
          if (active) setArticles(result.articles ?? []);
        })
        .catch((err: unknown) => {
          if (active) {
            setError(
              err instanceof Error ? err.message : t.searchUnavailable,
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });

    return () => {
      active = false;
    };
  }, [language, reloadKey, t.searchUnavailable]);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return articles;

    return articles.filter((article) =>
      [
        article.headline,
        article.standfirst,
        article.category,
        article.what_happened,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [articles, query]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.page, width < 480 && styles.pageCompact]}>
          <AppHeader />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t.search}
            </Text>
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
          </View>

          {loading ? (
            <ScreenState loading message={t.loadingStories} />
          ) : error ? (
            <ScreenState
              title={t.searchUnavailable}
              message={error}
              onRetry={() => setReloadKey((value) => value + 1)}
            />
          ) : results.length === 0 ? (
            <ScreenState title={t.noMatches} message={t.noMatchesMessage} />
          ) : (
            <View style={styles.grid}>
              {results.map((article) => (
                <View key={article.article_version_id} style={styles.card}>
                  <StoryTile article={article} />
                </View>
              ))}
            </View>
          )}
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
  input: {
    width: "100%",
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 17,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { minWidth: 0, flexGrow: 1, flexBasis: 300, maxWidth: "100%" },
});

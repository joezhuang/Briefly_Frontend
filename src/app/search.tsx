import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCanonicalArticles } from "@/api/briefly";
import { AppHeader } from "@/components/app-header";
import { ScreenState } from "@/components/screen-state";
import { StoryTile } from "@/components/story-tile";
import { useBrieflyLanguage } from "@/context/language";
import type { CanonicalArticle } from "@/models/article";
import { colors, layout } from "@/theme/tokens";

export default function SearchScreen() {
  const { language } = useBrieflyLanguage();
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<CanonicalArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (!active) return;

      setLoading(true);
      setError(null);

      getCanonicalArticles({ language, limit: 50 })
        .then((result) => {
          if (active) setArticles(result.articles ?? []);
        })
        .catch((err: unknown) => {
          if (active) {
            setError(
              err instanceof Error
                ? err.message
                : "Unable to search stories.",
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
  }, [language]);

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
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.page}>
          <AppHeader />

          <View style={styles.header}>
            <Text style={styles.title}>Search</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search current Briefly stories"
              placeholderTextColor="#858078"
              style={styles.input}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>

          {loading ? (
            <ScreenState loading message="Loading stories…" />
          ) : error ? (
            <ScreenState title="Search unavailable" message={error} />
          ) : results.length === 0 ? (
            <ScreenState
              title="No matches"
              message="Try a different person, place, topic or keyword."
            />
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
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { alignItems: "center" },
  page: {
    width: "100%",
    maxWidth: layout.pageMax,
    paddingHorizontal: layout.pagePadding,
    paddingBottom: 80,
  },
  header: { paddingVertical: 28, gap: 18 },
  title: { fontSize: 42, fontWeight: "900", color: colors.text },
  input: {
    width: "100%",
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontSize: 17,
    color: colors.text,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { minWidth: 300, flexGrow: 1, flexBasis: "32%" },
});

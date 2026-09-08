import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
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

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

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
        limit: 30,
      })
        .then((result) => {
          if (active) setArticles(result.articles ?? []);
        })
        .catch((err: unknown) => {
          if (active) {
            setError(err instanceof Error ? err.message : t.unableLoad);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });

    return () => {
      active = false;
    };
  }, [language, reloadKey, t.unableLoad]);

  const desktop = width >= 1000;
  const tablet = width >= 700 && width < 1000;
  const lead = articles[0];
  const secondary = articles.slice(1, 3);
  const remaining = articles.slice(3);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.page, width < 480 && styles.pageCompact]}>
          <AppHeader />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t.topStories}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t.subtitle}
            </Text>
          </View>

          {loading && <ScreenState loading message={t.loadingStories} />}

          {!loading && error && (
            <ScreenState
              title={t.unableLoad}
              message={error}
              onRetry={() => setReloadKey((value) => value + 1)}
            />
          )}

          {!loading && !error && !lead && (
            <ScreenState
              title={t.noStories}
              message={t.noStoriesMessage}
              onRetry={() => setReloadKey((value) => value + 1)}
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
                      <StoryTile
                        key={article.article_version_id}
                        article={article}
                        size="secondary"
                      />
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.stack}>
                  <StoryTile article={lead} size="hero" />
                  <View style={tablet ? styles.twoColumnGrid : styles.stack}>
                    {secondary.map((article) => (
                      <View
                        key={article.article_version_id}
                        style={tablet ? styles.half : undefined}
                      >
                        <StoryTile article={article} size="secondary" />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View
                style={[
                  styles.feedGrid,
                  (desktop || tablet) && styles.feedGridWide,
                ]}
              >
                {remaining.map((article) => (
                  <View
                    key={article.article_version_id}
                    style={
                      desktop
                        ? styles.third
                        : tablet
                          ? styles.half
                          : styles.full
                    }
                  >
                    <StoryTile article={article} />
                  </View>
                ))}
              </View>
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
  pageCompact: {
    paddingHorizontal: layout.pagePaddingCompact,
  },
  header: { paddingTop: 28, paddingBottom: 24 },
  title: {
    fontSize: 43,
    lineHeight: 50,
    fontWeight: "900",
    letterSpacing: -1.1,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 21,
    lineHeight: 29,
  },
  heroGrid: { flexDirection: "row", gap: 8 },
  heroColumn: { flex: 2 },
  secondaryColumn: { flex: 1, gap: 8 },
  stack: { gap: 10 },
  twoColumnGrid: { flexDirection: "row", gap: 10 },
  feedGrid: { marginTop: 10, gap: 10 },
  feedGridWide: { flexDirection: "row", flexWrap: "wrap" },
  third: { width: "32.75%" },
  half: { width: "49.25%" },
  full: { width: "100%" },
});

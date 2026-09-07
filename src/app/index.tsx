import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCanonicalArticles } from "@/api/briefly";
import { StoryTile } from "@/components/story-tile";
import type { CanonicalArticle } from "@/models/article";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";

export default function HomeScreen() {
  const { width } = useWindowDimensions();

  const [articles, setArticles] = useState<CanonicalArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getCanonicalArticles({
      includeDraft: PREVIEW_DRAFTS,
      limit: 30,
    })
      .then((result) => {
        if (active) {
          setArticles(result.articles);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Unable to load stories.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const desktop = width >= 1000;
  const tablet = width >= 700 && width < 1000;

  const lead = articles[0];
  const secondary = articles.slice(1, 3);
  const remaining = articles.slice(3);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.page}>
          <View style={styles.topNav}>
            <Text style={styles.logo}>BRIEFLY</Text>

            <View style={styles.navLinks}>
              <Text style={[styles.navText, styles.navActive]}>Home</Text>

              <Text style={styles.navText}>Saved</Text>

              <Text style={styles.navText}>Search</Text>
            </View>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Today’s top stories</Text>

            <Text style={styles.subtitle}>
              A deeper understanding of what’s happening in the world.
            </Text>
          </View>

          {loading && (
            <View style={styles.state}>
              <ActivityIndicator size="large" />

              <Text style={styles.stateText}>Loading stories…</Text>
            </View>
          )}

          {error && (
            <View style={styles.state}>
              <Text style={styles.errorTitle}>Unable to load Briefly</Text>

              <Text style={styles.stateText}>{error}</Text>
            </View>
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
                        key={article.event_id}
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
                        key={article.event_id}
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

                  desktop && styles.feedGridDesktop,

                  tablet && styles.feedGridTablet,
                ]}
              >
                {remaining.map((article) => (
                  <View
                    key={article.event_id}
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
  screen: {
    flex: 1,
    backgroundColor: "#F4F1EB",
  },

  scrollContent: {
    alignItems: "center",
  },

  page: {
    width: "100%",
    maxWidth: 1320,
    paddingHorizontal: 20,
    paddingBottom: 80,
  },

  topNav: {
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D3CFC6",
  },

  logo: {
    color: "#9A4D28",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 3,
  },

  navLinks: {
    marginLeft: 44,
    flexDirection: "row",
    gap: 30,
  },

  navText: {
    fontSize: 16,
    color: "#4D4B47",
  },

  navActive: {
    color: "#111111",
    fontWeight: "700",
  },

  header: {
    paddingTop: 28,
    paddingBottom: 24,
  },

  title: {
    fontSize: 43,
    lineHeight: 50,
    fontWeight: "900",
    color: "#151515",
    letterSpacing: -1.1,
  },

  subtitle: {
    marginTop: 6,
    fontSize: 21,
    lineHeight: 29,
    color: "#67635E",
  },

  heroGrid: {
    flexDirection: "row",
    gap: 8,
  },

  heroColumn: {
    flex: 2,
  },

  secondaryColumn: {
    flex: 1,
    gap: 8,
  },

  stack: {
    gap: 10,
  },

  twoColumnGrid: {
    flexDirection: "row",
    gap: 10,
  },

  feedGrid: {
    marginTop: 10,
    gap: 10,
  },

  feedGridDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  feedGridTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  third: {
    width: "32.75%",
  },

  half: {
    width: "49.25%",
  },

  full: {
    width: "100%",
  },

  state: {
    alignItems: "center",
    paddingVertical: 100,
    gap: 14,
  },

  stateText: {
    color: "#68645F",
    fontSize: 16,
  },

  errorTitle: {
    fontSize: 23,
    fontWeight: "800",
  },
});

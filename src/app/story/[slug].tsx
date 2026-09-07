import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCanonicalArticleBySlug } from "@/api/briefly";
import type { CanonicalArticle } from "@/models/article";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";

function BriefSection({ title, text }: { title: string; text: string }) {
  if (!text) return null;

  return (
    <View style={styles.briefSection}>
      <Text style={styles.briefTitle}>{title}</Text>
      <Text style={styles.briefText}>{text}</Text>
    </View>
  );
}

export default function StoryDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();

  const resolvedSlug = useMemo(
    () => (Array.isArray(slug) ? slug[0] : slug),
    [slug],
  );

  const [article, setArticle] = useState<CanonicalArticle | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resolvedSlug) return;

    let active = true;

    setArticle(null);
    setError(null);

    getCanonicalArticleBySlug(resolvedSlug, {
      includeDraft: PREVIEW_DRAFTS,
    })
      .then((result) => {
        if (active) setArticle(result);
      })
      .catch((err: unknown) => {
        if (!active) return;

        setError(
          err instanceof Error ? err.message : "Unable to load this story.",
        );
      });

    return () => {
      active = false;
    };
  }, [resolvedSlug]);

  if (!article && !error) {
    return (
      <SafeAreaView style={styles.state}>
        <ActivityIndicator size="large" />
        <Text style={styles.stateText}>Loading story…</Text>
      </SafeAreaView>
    );
  }

  if (!article || error) {
    return (
      <SafeAreaView style={styles.state}>
        <Text style={styles.errorTitle}>Story unavailable</Text>

        <Text style={styles.stateText}>{error ?? "Article not found."}</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Briefly",
          headerBackTitle: "Back",
        }}
      />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
      >
        <SafeAreaView edges={["bottom"]} style={styles.page}>
          <Text style={styles.brand}>BRIEFLY</Text>

          <Text style={styles.headline}>{article.headline}</Text>

          {!!article.standfirst && (
            <Text style={styles.standfirst}>{article.standfirst}</Text>
          )}

          <View style={styles.meta}>
            <Text style={styles.metaText}>
              Version {article.version_number}
            </Text>

            <Text style={styles.metaText}>•</Text>

            <Text style={styles.metaText}>
              {article.language.toUpperCase()}
            </Text>
          </View>

          <View style={styles.briefCard}>
            <BriefSection title="What happened" text={article.what_happened} />

            <BriefSection
              title="Why it matters"
              text={article.why_it_matters}
            />

            <BriefSection title="What next" text={article.what_next} />
          </View>

          <View style={styles.body}>
            {article.body.map((paragraph, index) => (
              <Text key={`${paragraph.type}-${index}`} style={styles.bodyText}>
                {paragraph.text}
              </Text>
            ))}
          </View>

          {article.uncertainties.length > 0 && (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>What we don’t know</Text>

              {article.uncertainties.map((item, index) => (
                <View key={index} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {article.sources_used.length > 0 && (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>Sources</Text>

              {article.sources_used.map((source, index) => (
                <View key={`${source.source}-${index}`} style={styles.source}>
                  <Text style={styles.sourceName}>{source.source}</Text>

                  {!!source.contribution && (
                    <Text style={styles.sourceContribution}>
                      {source.contribution}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </SafeAreaView>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F5EF",
  },

  scrollContent: {
    alignItems: "center",
  },

  page: {
    width: "100%",
    maxWidth: 860,
    paddingHorizontal: Platform.OS === "web" ? 32 : 20,
    paddingTop: 28,
    paddingBottom: 72,
  },

  brand: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2.2,
    color: "#8A3B12",
    marginBottom: 16,
  },

  headline: {
    fontSize: Platform.OS === "web" ? 48 : 36,
    lineHeight: Platform.OS === "web" ? 55 : 42,
    fontWeight: "800",
    letterSpacing: -1.2,
    color: "#171717",
  },

  standfirst: {
    marginTop: 18,
    fontSize: 21,
    lineHeight: 31,
    color: "#4B4B47",
  },

  meta: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },

  metaText: {
    fontSize: 13,
    color: "#71716B",
  },

  briefCard: {
    marginTop: 34,
    padding: 24,
    borderRadius: 18,
    backgroundColor: "#ECE8DE",
    gap: 22,
  },

  briefSection: {
    gap: 7,
  },

  briefTitle: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#7A3211",
  },

  briefText: {
    fontSize: 18,
    lineHeight: 28,
    color: "#262623",
  },

  body: {
    marginTop: 38,
    gap: 24,
  },

  bodyText: {
    fontSize: 19,
    lineHeight: 31,
    color: "#242421",
  },

  group: {
    marginTop: 44,
    paddingTop: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C9C5BA",
    gap: 14,
  },

  groupTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1D1D1B",
  },

  bulletRow: {
    flexDirection: "row",
    gap: 10,
  },

  bullet: {
    fontSize: 18,
    lineHeight: 27,
    color: "#8A3B12",
  },

  bulletText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 27,
    color: "#3C3C38",
  },

  source: {
    gap: 4,
    paddingVertical: 7,
  },

  sourceName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#242421",
  },

  sourceContribution: {
    fontSize: 15,
    lineHeight: 22,
    color: "#62625D",
  },

  state: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
    backgroundColor: "#F7F5EF",
  },

  stateText: {
    fontSize: 16,
    textAlign: "center",
    color: "#5F5F5A",
  },

  errorTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1D1D1B",
  },
});

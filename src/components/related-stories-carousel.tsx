import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { getHomepageArticleFeed } from "@/api/briefly";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";

const copy = {
  en: { title: "Related stories", sources: "sources" },
  es: { title: "Historias relacionadas", sources: "fuentes" },
  ja: { title: "関連ニュース", sources: "件の情報源" },
  "zh-CN": { title: "相关新闻", sources: "个来源" },
  "zh-TW": { title: "相關新聞", sources: "個來源" },
} as const;

function terms(article: CanonicalArticle) {
  return new Set(
    `${article.headline} ${article.standfirst} ${article.category ?? ""}`
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4),
  );
}

function relevance(current: CanonicalArticle, candidate: CanonicalArticle) {
  const a = terms(current);
  const b = terms(candidate);
  let overlap = 0;
  a.forEach((word) => {
    if (b.has(word)) overlap += 1;
  });
  if (current.category && current.category === candidate.category) overlap += 2;
  return overlap;
}

export function RelatedStoriesCarousel({
  article,
}: {
  article: CanonicalArticle;
}) {
  const { width } = useWindowDimensions();
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const labels = copy[language] ?? copy.en;
  const [candidates, setCandidates] = useState<CanonicalArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let active = true;
    getHomepageArticleFeed({
      scope: "top",
      includeDraft: process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true",
      language: Platform.OS === "web" ? "en" : language,
      limit: 30,
      offset: 0,
    })
      .then((result) => {
        if (active) setCandidates(result.articles ?? []);
      })
      .catch(() => {
        if (active) setCandidates([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [language]);

  const related = useMemo(
    () =>
      candidates
        .filter((candidate) => candidate.event_id !== article.event_id)
        .map((candidate) => ({
          article: candidate,
          score: relevance(article, candidate),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((item) => item.article),
    [article, candidates],
  );

  if (loading) {
    return (
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  if (related.length === 0) return null;

  const cardWidth = width < 480 ? Math.min(width * 0.76, 300) : width < 900 ? 300 : 320;
  const scrollStep = cardWidth + 12;

  const scrollBy = (direction: -1 | 1) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const node = scrollRef.current as unknown as {
        getScrollableNode?: () => HTMLElement;
      };
      const element = node?.getScrollableNode?.();
      if (element?.scrollBy) {
        element.scrollBy({ left: direction * scrollStep, behavior: "smooth" });
        return;
      }
    }

    scrollRef.current?.scrollTo({
      x: Math.max(0, direction > 0 ? scrollStep : 0),
      animated: true,
    });
  };

  return (
    <View style={[styles.section, { borderTopColor: colors.border }]}>
      <View style={styles.headingRow}>
        <Text style={[styles.title, { color: colors.text }]}>{labels.title}</Text>
        {Platform.OS === "web" && related.length > 1 ? (
          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Scroll related stories left"
              onPress={() => scrollBy(-1)}
              style={({ pressed }) => [
                styles.control,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceMuted,
                  opacity: pressed ? 0.65 : 1,
                },
              ]}
            >
              <Text style={[styles.controlText, { color: colors.text }]}>←</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Scroll related stories right"
              onPress={() => scrollBy(1)}
              style={({ pressed }) => [
                styles.control,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceMuted,
                  opacity: pressed ? 0.65 : 1,
                },
              ]}
            >
              <Text style={[styles.controlText, { color: colors.text }]}>→</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
      >
        {related.map((item) => {
          const params = new URLSearchParams({
            eventId: item.event_id,
            previewHeadline: item.headline,
          });
          if (item.image_url) params.set("imageUrl", item.image_url);
          const href = `/story/${item.slug}?${params.toString()}`;
          const sourceCount = item.source_count ?? item.sources_used?.length ?? 0;

          return (
            <Pressable
              key={item.event_id}
              onPress={() => router.push(href as never)}
              style={[
                styles.card,
                {
                  width: cardWidth,
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                },
              ]}
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.image} contentFit="cover" />
              ) : (
                <View style={[styles.image, { backgroundColor: colors.imageFallback }]} />
              )}
              <View style={styles.copy}>
                {!!item.category && (
                  <Text style={[styles.category, { color: colors.accent }]} numberOfLines={1}>
                    {item.category.toUpperCase()}
                  </Text>
                )}
                <Text style={[styles.headline, { color: colors.text }]} numberOfLines={3}>
                  {item.headline}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {sourceCount} {labels.sources}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 44,
    paddingTop: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  headingRow: {
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { flex: 1, fontSize: 23, fontWeight: "900" },
  controls: { flexDirection: "row", gap: 8 },
  control: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  controlText: { fontSize: 20, fontWeight: "800" },
  track: { gap: 12, paddingRight: 20 },
  card: {
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  image: { width: "100%", aspectRatio: 16 / 9 },
  copy: { padding: 14, gap: 7 },
  category: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "800" },
  meta: { fontSize: 11, fontWeight: "600" },
});

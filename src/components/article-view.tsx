import { Image } from "expo-image";
import * as Linking from "expo-linking";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSavedArticles } from "@/context/saved-articles";
import type { CanonicalArticle } from "@/models/article";
import { colors, layout } from "@/theme/tokens";

function BriefSection({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <View style={styles.briefSection}>
      <Text style={styles.briefTitle}>{title}</Text>
      <Text style={styles.briefText}>{text}</Text>
    </View>
  );
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function ArticleView({
  article,
  immutable = false,
}: {
  article: CanonicalArticle;
  immutable?: boolean;
}) {
  const { isSaved, toggleSaved } = useSavedArticles();
  const saved = isSaved(article);
  const sourceCount = article.source_count ?? article.sources_used?.length ?? 0;
  const timestamp = formatDate(article.published_at ?? article.generated_at);

  const share = async () => {
    const webBase = process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL?.replace(/\/$/, "");
    const path = `/share/${article.article_version_id}`;
    const url = webBase ? `${webBase}${path}` : Linking.createURL(path);
    await Share.share({ message: `${article.headline}\n${url}`, url });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.page}>
        {!!article.image_url && (
          <Image
            source={{ uri: article.image_url }}
            style={styles.heroImage}
            contentFit="contain"
            transition={180}
          />
        )}
        <Text style={styles.brand}>BRIEFLY</Text>
        <Text style={styles.headline}>{article.headline}</Text>
        {!!article.standfirst && (
          <Text style={styles.standfirst}>{article.standfirst}</Text>
        )}
        <View style={styles.meta}>
          {!!article.category && (
            <Text style={styles.metaText}>{article.category}</Text>
          )}
          {!!timestamp && <Text style={styles.metaText}>{timestamp}</Text>}
          <Text style={styles.metaText}>
            {sourceCount} {sourceCount === 1 ? "source" : "sources"}
          </Text>
          {immutable && <Text style={styles.snapshotBadge}>Saved version</Text>}
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={() => void toggleSaved(article)}
            style={[styles.action, saved && styles.actionActive]}
          >
            <Text style={[styles.actionText, saved && styles.actionTextActive]}>
              {saved ? "Saved" : "Save"}
            </Text>
          </Pressable>
          <Pressable onPress={() => void share()} style={styles.action}>
            <Text style={styles.actionText}>Share</Text>
          </Pressable>
        </View>
        <View style={styles.briefCard}>
          <BriefSection title="What happened" text={article.what_happened} />
          <BriefSection title="Why it matters" text={article.why_it_matters} />
          <BriefSection title="What next" text={article.what_next} />
        </View>
        <View style={styles.body}>
          {(article.body ?? []).map((paragraph, index) => (
            <Text key={`${paragraph.type}-${index}`} style={styles.bodyText}>
              {paragraph.text}
            </Text>
          ))}
        </View>
        {(article.uncertainties ?? []).length > 0 && (
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
        {(article.sources_used ?? []).length > 0 && (
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  scrollContent: { alignItems: "center" },
  page: {
    width: "100%",
    maxWidth: layout.articleMax,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 72,
  },
  heroImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 18,
    marginBottom: 28,
    backgroundColor: "#DDD7CB",
  },
  brand: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2.2,
    color: colors.accent,
    marginBottom: 16,
  },
  headline: {
    fontSize: 42,
    lineHeight: 49,
    fontWeight: "900",
    letterSpacing: -1.1,
    color: colors.text,
  },
  standfirst: { marginTop: 18, fontSize: 21, lineHeight: 31, color: "#4B4B47" },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    marginTop: 18,
  },
  metaText: { fontSize: 13, color: "#71716B" },
  snapshotBadge: { fontSize: 12, fontWeight: "800", color: colors.accent },
  actions: { flexDirection: "row", gap: 10, marginTop: 22 },
  action: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionActive: { backgroundColor: colors.text, borderColor: colors.text },
  actionText: { fontWeight: "800", color: colors.text },
  actionTextActive: { color: colors.white },
  briefCard: {
    marginTop: 34,
    padding: 24,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    gap: 22,
  },
  briefSection: { gap: 7 },
  briefTitle: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#7A3211",
  },
  briefText: { fontSize: 18, lineHeight: 28, color: "#262623" },
  body: { marginTop: 38, gap: 24 },
  bodyText: { fontSize: 19, lineHeight: 31, color: "#242421" },
  group: {
    marginTop: 44,
    paddingTop: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C9C5BA",
    gap: 14,
  },
  groupTitle: { fontSize: 24, fontWeight: "800", color: "#1D1D1B" },
  bulletRow: { flexDirection: "row", gap: 10 },
  bullet: { fontSize: 18, lineHeight: 27, color: colors.accent },
  bulletText: { flex: 1, fontSize: 17, lineHeight: 27, color: "#3C3C38" },
  source: { gap: 4, paddingVertical: 7 },
  sourceName: { fontSize: 16, fontWeight: "700", color: "#242421" },
  sourceContribution: { fontSize: 15, lineHeight: 22, color: "#62625D" },
});

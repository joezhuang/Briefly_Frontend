import { Image } from "expo-image";
import {
  Alert,
  Pressable,
  ScrollView,
  Platform,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useBrieflyLanguage } from "@/context/language";
import { useSavedArticles } from "@/context/saved-articles";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";
import { layout } from "@/theme/tokens";

function formatDate(value: string | null, language: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(language, {
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
  const { width } = useWindowDimensions();
  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const { isSaved, toggleSaved } = useSavedArticles();

  const saved = isSaved(article);
  const sourceCount = article.source_count ?? article.sources_used?.length ?? 0;
  const timestamp = formatDate(
    article.published_at ?? article.generated_at,
    language,
  );
  const contentLanguage = article.content_language ?? article.language;
  const showingEnglishFallback =
    language !== "en" && contentLanguage === "en";
  const translationPending = article.translation_status === "pending";
  const experimentalTranslation = article.experimental_localization === true;

  const share = async () => {
    const webBase =
      process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL?.replace(/\/$/, "");

    if (!webBase) {
      Alert.alert("Briefly", t.shareConfigMissing);
      return;
    }

    const url = `${webBase}/share/${article.article_version_id}`;

    await Share.share(
      Platform.OS === "ios"
        ? {
            message: article.headline,
            url,
          }
        : {
            message: `${article.headline}\n${url}`,
          },
    );
  };

  const briefSection = (title: string, text: string) => {
    if (!text) return null;

    return (
      <View style={styles.briefSection}>
        <Text style={[styles.briefTitle, { color: colors.accent }]}>
          {title}
        </Text>
        <Text style={[styles.briefText, { color: colors.text }]}>
          {text}
        </Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.surface }]}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.page, width < 480 && styles.pageCompact]}>
        {!!article.image_url && (
          <Image
            source={{ uri: article.image_url }}
            style={[
              styles.heroImage,
              { backgroundColor: colors.imageFallback },
            ]}
            contentFit="contain"
            transition={180}
          />
        )}

        <Text style={[styles.brand, { color: colors.accent }]}>BRIEFLY</Text>

        <Text
          style={[
            styles.headline,
            width < 480 && styles.headlineCompact,
            { color: colors.text },
          ]}
        >
          {article.headline}
        </Text>

        {!!article.standfirst && (
          <Text
            style={[
              styles.standfirst,
              width < 480 && styles.standfirstCompact,
              { color: colors.textMuted },
            ]}
          >
            {article.standfirst}
          </Text>
        )}

        {(translationPending || experimentalTranslation) && (
          <View
            style={[
              styles.localizationNotice,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.localizationNoticeTitle, { color: colors.text }]}>
              {translationPending
                ? "Experimental translation is being prepared"
                : "Experimental translation"}
            </Text>
            <Text
              style={[
                styles.localizationNoticeText,
                { color: colors.textMuted },
              ]}
            >
              {translationPending
                ? "Showing the English original for now. This page will update automatically when the local translation is ready."
                : article.localization_warning ??
                  "This AI-generated translation may contain inaccuracies. Refer to the original English article for authoritative content."}
            </Text>
          </View>
        )}

        <View style={styles.meta}>
          {!!article.category && (
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {article.category}
            </Text>
          )}

          {!!timestamp && (
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {timestamp}
            </Text>
          )}

          {showingEnglishFallback && (
            <Text style={[styles.languageBadge, { color: colors.textMuted }]}>
              {t.articleContentEnglish}
            </Text>
          )}

          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            {sourceCount} {sourceCount === 1 ? t.source : t.sourcesPlural}
          </Text>

          {immutable && (
            <Text style={[styles.snapshotBadge, { color: colors.accent }]}>
              {t.savedVersion}
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => void toggleSaved(article)}
            style={[
              styles.action,
              { borderColor: colors.border },
              saved && {
                backgroundColor: colors.text,
                borderColor: colors.text,
              },
            ]}
          >
            <Text
              style={[
                styles.actionText,
                { color: saved ? colors.background : colors.text },
              ]}
            >
              {saved ? t.savedAction : t.save}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void share()}
            style={[styles.action, { borderColor: colors.border }]}
          >
            <Text style={[styles.actionText, { color: colors.text }]}>
              {t.share}
            </Text>
          </Pressable>
        </View>

        <View
          style={[styles.briefCard, { backgroundColor: colors.surfaceMuted }]}
        >
          {briefSection(t.whatHappened, article.what_happened)}
          {briefSection(t.whyItMatters, article.why_it_matters)}
          {briefSection(t.whatNext, article.what_next)}
        </View>

        <View style={styles.body}>
          {(article.body ?? []).map((paragraph, index) => (
            <Text
              key={`${paragraph.type}-${index}`}
              style={[styles.bodyText, { color: colors.text }]}
            >
              {paragraph.text}
            </Text>
          ))}
        </View>

        {(article.uncertainties ?? []).length > 0 && (
          <View style={[styles.group, { borderTopColor: colors.border }]}>
            <Text style={[styles.groupTitle, { color: colors.text }]}>
              {t.whatWeDontKnow}
            </Text>
            {article.uncertainties.map((item, index) => (
              <View key={index} style={styles.bulletRow}>
                <Text style={[styles.bullet, { color: colors.accent }]}>•</Text>
                <Text style={[styles.bulletText, { color: colors.textMuted }]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        )}

        {(article.sources_used ?? []).length > 0 && (
          <View style={[styles.group, { borderTopColor: colors.border }]}>
            <Text style={[styles.groupTitle, { color: colors.text }]}>
              {t.sources}
            </Text>
            {article.sources_used.map((source, index) => (
              <View key={`${source.source}-${index}`} style={styles.source}>
                <Text style={[styles.sourceName, { color: colors.text }]}>
                  {source.source}
                </Text>
                {!!source.contribution && (
                  <Text
                    style={[
                      styles.sourceContribution,
                      { color: colors.textMuted },
                    ]}
                  >
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
  screen: { flex: 1 },
  scrollContent: { alignItems: "center" },
  page: {
    width: "100%",
    maxWidth: layout.articleMax,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 72,
  },
  pageCompact: {
    paddingHorizontal: 14,
    paddingTop: 18,
  },
  heroImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 18,
    marginBottom: 28,
  },
  brand: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2.2,
    marginBottom: 16,
  },
  headline: {
    fontSize: 42,
    lineHeight: 49,
    fontWeight: "900",
    letterSpacing: -1.1,
  },
  headlineCompact: {
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.7,
  },
  standfirst: {
    marginTop: 18,
    fontSize: 21,
    lineHeight: 31,
  },
  standfirstCompact: {
    fontSize: 18,
    lineHeight: 27,
  },
  localizationNotice: {
    marginTop: 22,
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  localizationNoticeTitle: { fontSize: 14, fontWeight: "800" },
  localizationNoticeText: { fontSize: 13, lineHeight: 19 },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    marginTop: 18,
  },
  metaText: { fontSize: 13 },
  languageBadge: { fontSize: 12, fontWeight: "700" },
  snapshotBadge: { fontSize: 12, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 10, marginTop: 22 },
  action: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionText: { fontWeight: "800" },
  briefCard: {
    marginTop: 34,
    padding: 24,
    borderRadius: 18,
    gap: 22,
  },
  briefSection: { gap: 7 },
  briefTitle: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  briefText: { fontSize: 18, lineHeight: 28 },
  body: { marginTop: 38, gap: 24 },
  bodyText: { fontSize: 19, lineHeight: 31 },
  group: {
    marginTop: 44,
    paddingTop: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  groupTitle: { fontSize: 24, fontWeight: "800" },
  bulletRow: { flexDirection: "row", gap: 10 },
  bullet: { fontSize: 18, lineHeight: 27 },
  bulletText: { flex: 1, fontSize: 17, lineHeight: 27 },
  source: { gap: 4, paddingVertical: 7 },
  sourceName: { fontSize: 16, fontWeight: "700" },
  sourceContribution: { fontSize: 15, lineHeight: 22 },
});

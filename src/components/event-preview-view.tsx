import { Image } from "expo-image";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";
import { layout } from "@/theme/tokens";

const previewCopy = {
  en: {
    preparing: "Briefly analysis is being prepared from the event evidence…",
    failed: "Briefly could not prepare an authoritative analysis from the available source material.",
    coverage: "Coverage",
    open: "Open original",
  },
  es: {
    preparing: "El análisis de Briefly se está preparando a partir de las evidencias del evento…",
    failed: "Briefly no pudo preparar un análisis autorizado con las fuentes disponibles.",
    coverage: "Cobertura",
    open: "Abrir original",
  },
  ja: {
    preparing: "イベントの根拠情報からBrieflyの分析を準備しています…",
    failed: "利用可能な情報から信頼できるBriefly分析を作成できませんでした。",
    coverage: "関連記事",
    open: "元記事を開く",
  },
  "zh-CN": {
    preparing: "Briefly 正在根据事件证据生成分析…",
    failed: "Briefly 无法根据现有来源生成可靠的权威分析。",
    coverage: "相关报道",
    open: "打开原文",
  },
  "zh-TW": {
    preparing: "Briefly 正在根據事件證據產生分析…",
    failed: "Briefly 無法根據現有來源產生可靠的權威分析。",
    coverage: "相關報導",
    open: "開啟原文",
  },
} as const;

export function EventPreviewView({
  article,
  onRetry,
}: {
  article: CanonicalArticle;
  onRetry?: () => void;
}) {
  const { width } = useWindowDimensions();
  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const copy = previewCopy[language] ?? previewCopy.en;
  const sourceCount = article.source_count ?? article.coverage?.length ?? 0;
  const failed = article.generation_status === "failed";

  const openCoverage = async (url: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    await Linking.openURL(url);
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
            style={[styles.heroImage, { backgroundColor: colors.imageFallback }]}
            contentFit="cover"
            transition={180}
          />
        )}

        <Text style={[styles.brand, { color: colors.accent }]}>BRIEFLY</Text>
        <Text style={[styles.headline, width < 480 && styles.headlineCompact, { color: colors.text }]}> 
          {article.headline}
        </Text>

        {!!article.standfirst && (
          <Text style={[styles.standfirst, width < 480 && styles.standfirstCompact, { color: colors.textMuted }]}>
            {article.standfirst}
          </Text>
        )}

        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.textMuted }]}> 
            {sourceCount} {sourceCount === 1 ? t.source : t.sourcesPlural}
          </Text>
        </View>

        <View style={[styles.statusCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}> 
          <Text style={[styles.statusTitle, { color: colors.text }]}> 
            {failed ? copy.failed : copy.preparing}
          </Text>
          {failed && onRetry && (
            <Pressable onPress={onRetry} style={[styles.retryButton, { borderColor: colors.border }]}> 
              <Text style={[styles.retryText, { color: colors.text }]}>Retry</Text>
            </Pressable>
          )}
        </View>

        {!!article.coverage?.length && (
          <View style={styles.coverageSection}>
            <Text style={[styles.coverageTitle, { color: colors.text }]}>{copy.coverage}</Text>
            {article.coverage.map((item) => (
              <Pressable
                key={item.evidence_id}
                onPress={() => void openCoverage(item.url)}
                style={[styles.coverageRow, { borderColor: colors.border }]}
              >
                <View style={styles.coverageCopy}>
                  <Text style={[styles.coverageSource, { color: colors.accent }]}>{item.source}</Text>
                  <Text style={[styles.coverageHeadline, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>
                <Text style={[styles.coverageOpen, { color: colors.textMuted }]}>{copy.open}</Text>
              </Pressable>
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
  pageCompact: { paddingHorizontal: 14, paddingTop: 18 },
  heroImage: { width: "100%", aspectRatio: 16 / 9, borderRadius: 18, marginBottom: 28 },
  brand: { fontSize: 13, fontWeight: "800", letterSpacing: 2.2, marginBottom: 16 },
  headline: { fontSize: 42, lineHeight: 49, fontWeight: "900", letterSpacing: -1.1 },
  headlineCompact: { fontSize: 34, lineHeight: 40, letterSpacing: -0.7 },
  standfirst: { marginTop: 18, fontSize: 21, lineHeight: 31 },
  standfirstCompact: { fontSize: 18, lineHeight: 27 },
  metaRow: { marginTop: 18 },
  metaText: { fontSize: 13, fontWeight: "600" },
  statusCard: { marginTop: 28, borderWidth: 1, borderRadius: 16, padding: 18, gap: 14 },
  statusTitle: { fontSize: 16, lineHeight: 23, fontWeight: "700" },
  retryButton: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  retryText: { fontSize: 13, fontWeight: "800" },
  coverageSection: { marginTop: 44, paddingTop: 28, gap: 14 },
  coverageTitle: { fontSize: 24, lineHeight: 30, fontWeight: "800" },
  coverageRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14, flexDirection: "row", gap: 16, alignItems: "center" },
  coverageCopy: { flex: 1, gap: 4 },
  coverageSource: { fontSize: 13, fontWeight: "800" },
  coverageHeadline: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  coverageOpen: { fontSize: 12, fontWeight: "700", flexShrink: 0 },
});

import { Image } from "expo-image";
import { createElement } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import type { PodcastAnalysisStatus } from "@/api/briefly";
import { PodcastInlinePlayer } from "@/components/podcast-inline-player";
import { useBrieflyLanguage } from "@/context/language";
import { useSavedArticles } from "@/context/saved-articles";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";
import { layout } from "@/theme/tokens";

const PODCAST_VOLUME_STORAGE_KEY = "briefly.podcast.volume.v1";

const localizationCopy = {
  en: {
    pendingTitle: "Experimental translation is being prepared",
    pendingText:
      "Showing the English original for now. This page will update automatically when the local translation is ready.",
    readyTitle: "Experimental translation",
    readyText:
      "This AI-generated translation may contain inaccuracies or awkward wording. Refer to the original English article for authoritative content.",
  },
  es: {
    pendingTitle: "Traducción experimental en preparación",
    pendingText:
      "Por ahora mostramos el artículo original en inglés. Esta página se actualizará automáticamente cuando la traducción local esté lista.",
    readyTitle: "Traducción experimental",
    readyText:
      "Esta traducción generada por IA puede contener errores o expresiones poco naturales. Consulta el artículo original en inglés como fuente de referencia.",
  },
  ja: {
    pendingTitle: "実験的な翻訳を準備しています",
    pendingText:
      "現在は英語の原文を表示しています。ローカル翻訳の準備ができると、このページは自動的に更新されます。",
    readyTitle: "実験的な翻訳",
    readyText:
      "このAI生成翻訳には誤りや不自然な表現が含まれる可能性があります。正確な内容は英語の原文を参照してください。",
  },
  "zh-CN": {
    pendingTitle: "正在准备实验性翻译",
    pendingText:
      "目前先显示英文原文。本地翻译准备好后，此页面会自动更新。",
    readyTitle: "实验性翻译",
    readyText:
      "此翻译由 AI 生成，可能包含错误或不自然的表述。权威内容请以英文原文为准。",
  },
  "zh-TW": {
    pendingTitle: "正在準備實驗性翻譯",
    pendingText:
      "目前先顯示英文原文。本地翻譯準備完成後，此頁面會自動更新。",
    readyTitle: "實驗性翻譯",
    readyText:
      "此翻譯由 AI 產生，可能包含錯誤或不自然的表述。權威內容請以英文原文為準。",
  },
} as const;

const podcastCopy = {
  en: {
    title: "Podcast analysis",
    body: "A two-host Deeply analysis generated from the authoritative English Briefly article.",
    proOnly: "Briefly Pro",
    signIn: "Sign in to use podcast analysis",
    generate: "Generate podcast analysis",
    preparing: "Preparing podcast analysis…",
    listen: "Listen to analysis",
    retry: "Retry podcast analysis",
  },
  es: {
    title: "Análisis en pódcast",
    body: "Un análisis de Deeply con dos presentadores, generado a partir del artículo original de Briefly en inglés.",
    proOnly: "Briefly Pro",
    signIn: "Inicia sesión para usar el análisis en pódcast",
    generate: "Generar análisis en pódcast",
    preparing: "Preparando el análisis en pódcast…",
    listen: "Escuchar el análisis",
    retry: "Reintentar el análisis en pódcast",
  },
  ja: {
    title: "ポッドキャスト分析",
    body: "Brieflyの権威ある英語記事を基に生成する、Deeplyの2人ホストによる解説です。",
    proOnly: "Briefly Pro",
    signIn: "ポッドキャスト分析を利用するにはログインしてください",
    generate: "ポッドキャスト分析を生成",
    preparing: "ポッドキャスト分析を準備中…",
    listen: "分析を聴く",
    retry: "ポッドキャスト分析を再試行",
  },
  "zh-CN": {
    title: "播客分析",
    body: "由 Deeply 双主持人根据 Briefly 权威英文原文生成的深度分析。",
    proOnly: "Briefly Pro",
    signIn: "登录后使用播客分析",
    generate: "生成播客分析",
    preparing: "正在准备播客分析…",
    listen: "收听分析",
    retry: "重新生成播客分析",
  },
  "zh-TW": {
    title: "Podcast 分析",
    body: "由 Deeply 雙主持人根據 Briefly 權威英文原文產生的深度分析。",
    proOnly: "Briefly Pro",
    signIn: "登入後使用 Podcast 分析",
    generate: "產生 Podcast 分析",
    preparing: "正在準備 Podcast 分析…",
    listen: "收聽分析",
    retry: "重新產生 Podcast 分析",
  },
} as const;

const coverageCopy = {
  en: { title: "Coverage", open: "Open original" },
  es: { title: "Cobertura", open: "Abrir original" },
  ja: { title: "関連記事", open: "元記事を開く" },
  "zh-CN": { title: "相关报道", open: "打开原文" },
  "zh-TW": { title: "相關報導", open: "開啟原文" },
} as const;

function formatDate(value: string | null | undefined, language: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function readStoredPodcastVolume() {
  if (Platform.OS !== "web" || typeof window === "undefined") return 1;
  const stored = Number(window.localStorage.getItem(PODCAST_VOLUME_STORAGE_KEY));
  return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 1;
}

function storePodcastVolume(volume: number) {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const normalized = Math.max(0, Math.min(1, volume));
  window.localStorage.setItem(PODCAST_VOLUME_STORAGE_KEY, String(normalized));
}

export function ArticleView({
  article,
  immutable = false,
  podcast = null,
  podcastBusy = false,
  podcastPro = false,
  podcastSignedIn = false,
  onPodcastAction,
}: {
  article: CanonicalArticle;
  immutable?: boolean;
  podcast?: PodcastAnalysisStatus | null;
  podcastBusy?: boolean;
  podcastPro?: boolean;
  podcastSignedIn?: boolean;
  onPodcastAction?: () => void;
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
  const localizationText = localizationCopy[language] ?? localizationCopy.en;
  const podcastText = podcastCopy[language] ?? podcastCopy.en;
  const coverageText = coverageCopy[language] ?? coverageCopy.en;
  const podcastProcessing = podcastBusy || podcast?.status === "processing";
  const podcastReady = podcast?.status === "ready" && !!podcast.audio_url;
  const webPodcastReady = Platform.OS === "web" && podcastReady;
  const nativePodcastReady = Platform.OS !== "web" && podcastReady;

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
        ? { message: article.headline, url }
        : { message: `${article.headline}\n${url}` },
    );
  };

  const openCoverage = async (url: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    await Linking.openURL(url);
  };

  const briefSection = (title: string, text: string) => {
    if (!text) return null;

    return (
      <View style={styles.briefSection}>
        <Text style={[styles.briefTitle, { color: colors.accent }]}>{title}</Text>
        <Text style={[styles.briefText, { color: colors.text }]}>{text}</Text>
      </View>
    );
  };

  let podcastAction = podcastText.generate;
  let podcastDisabled = podcastBusy;

  if (!podcastSignedIn) {
    podcastAction = podcastText.signIn;
  } else if (!podcastPro) {
    podcastAction = podcastText.proOnly;
  } else if (podcastProcessing) {
    podcastAction = podcastText.preparing;
    podcastDisabled = true;
  } else if (podcast?.status === "failed") {
    podcastAction = podcastText.retry;
  }

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
            <View style={styles.statusTitleRow}>
              {translationPending && (
                <ActivityIndicator size="small" color={colors.accent} />
              )}
              <Text style={[styles.localizationNoticeTitle, { color: colors.text }]}>
                {translationPending
                  ? localizationText.pendingTitle
                  : localizationText.readyTitle}
              </Text>
            </View>
            <Text
              style={[
                styles.localizationNoticeText,
                { color: colors.textMuted },
              ]}
            >
              {translationPending
                ? localizationText.pendingText
                : localizationText.readyText}
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
              saved && { backgroundColor: colors.text, borderColor: colors.text },
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

        {!!onPodcastAction && !immutable && (
          <View
            style={[
              styles.podcastCard,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            ]}
          >
            <View style={styles.podcastCopy}>
              <View style={styles.statusTitleRow}>
                {podcastProcessing && (
                  <ActivityIndicator size="small" color={colors.accent} />
                )}
                <Text style={[styles.podcastTitle, { color: colors.text }]}>
                  {podcastText.title}
                </Text>
              </View>
              <Text style={[styles.podcastBody, { color: colors.textMuted }]}>
                {podcastText.body}
              </Text>
            </View>

            {nativePodcastReady && podcast?.audio_url
              ? <PodcastInlinePlayer source={podcast.audio_url} />
              : webPodcastReady
                ? createElement("audio", {
                    controls: true,
                    preload: "metadata",
                    src: podcast.audio_url ?? undefined,
                    onLoadedMetadata: (event: { currentTarget: HTMLAudioElement }) => {
                      event.currentTarget.volume = readStoredPodcastVolume();
                    },
                    onVolumeChange: (event: { currentTarget: HTMLAudioElement }) => {
                      storePodcastVolume(event.currentTarget.volume);
                    },
                    style: { width: "100%" },
                  })
                : (
                  <Pressable
                    disabled={podcastDisabled}
                    onPress={onPodcastAction}
                    style={[
                      styles.podcastButton,
                      { backgroundColor: colors.text },
                      podcastDisabled && styles.podcastButtonDisabled,
                    ]}
                  >
                    <View style={styles.buttonContent}>
                      <Text
                        style={[
                          styles.podcastButtonText,
                          { color: colors.background },
                        ]}
                      >
                        {podcastAction}
                      </Text>
                    </View>
                  </Pressable>
                )}
          </View>
        )}

        <View style={[styles.briefCard, { backgroundColor: colors.surfaceMuted }]}>
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

        {(article.coverage ?? []).length > 0 && (
          <View style={[styles.group, { borderTopColor: colors.border }]}>
            <Text style={[styles.groupTitle, { color: colors.text }]}>
              {coverageText.title} · {article.coverage?.length ?? 0}
            </Text>
            {(article.coverage ?? []).map((item, index) => {
              const coverageDate = formatDate(item.published_at, language);
              return (
                <Pressable
                  key={`${item.evidence_id || item.url}-${index}`}
                  onPress={() => void openCoverage(item.url)}
                  style={({ pressed }) => [
                    styles.coverageRow,
                    { borderColor: colors.border },
                    pressed && styles.coveragePressed,
                  ]}
                >
                  <View style={styles.coverageCopy}>
                    <Text style={[styles.coverageSource, { color: colors.accent }]}>
                      {item.source}
                    </Text>
                    {!!item.title && (
                      <Text style={[styles.coverageTitle, { color: colors.text }]}>
                        {item.title}
                      </Text>
                    )}
                    {!!coverageDate && (
                      <Text style={[styles.coverageMeta, { color: colors.textMuted }]}>
                        {coverageDate}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.coverageOpen, { color: colors.textMuted }]}>
                    {coverageText.open} ↗
                  </Text>
                </Pressable>
              );
            })}
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
  headlineCompact: { fontSize: 34, lineHeight: 40, letterSpacing: -0.7 },
  standfirst: { marginTop: 18, fontSize: 21, lineHeight: 31 },
  standfirstCompact: { fontSize: 18, lineHeight: 27 },
  localizationNotice: {
    marginTop: 22,
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  statusTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  localizationNoticeTitle: { fontSize: 14, fontWeight: "800", flexShrink: 1 },
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
  podcastCard: {
    marginTop: 24,
    padding: 18,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  podcastCopy: { gap: 5 },
  podcastTitle: { fontSize: 19, fontWeight: "900", flexShrink: 1 },
  podcastBody: { fontSize: 14, lineHeight: 21 },
  podcastButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  podcastButtonDisabled: { opacity: 0.6 },
  buttonContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  podcastButtonText: { fontSize: 14, fontWeight: "800" },
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
  coverageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  coveragePressed: { opacity: 0.6 },
  coverageCopy: { flex: 1, gap: 4 },
  coverageSource: { fontSize: 13, fontWeight: "800" },
  coverageTitle: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  coverageMeta: { fontSize: 12 },
  coverageOpen: { fontSize: 12, fontWeight: "700", flexShrink: 0 },
});

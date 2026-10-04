import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { trackProductEvent } from "@/analytics/product-analytics";
import { StoryVideo } from "@/components/story-video";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle, ArticleVideo } from "@/models/article";
import type { FeatureAccessState } from "@/subscriptions/feature-access";
import { layout } from "@/theme/tokens";

function previewVideoList(article: CanonicalArticle): ArticleVideo[] {
  const list = [...(article.videos ?? [])];
  if (article.video_url && !list.some((item) => item.url === article.video_url)) {
    list.unshift({
      url: article.video_url,
      thumbnail_url: article.video_thumbnail_url,
      title: article.headline,
    });
  }
  const seen = new Set<string>();
  return list.filter((item) => {
    const url = String(item.url || "").trim();
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function previewVideoPoster(video: ArticleVideo, all: ArticleVideo[]): string | null {
  const poster = String(video.thumbnail_url || "").trim();
  const duplicated = poster && all.some((item) => item.url !== video.url && item.thumbnail_url === poster);
  try {
    const url = new URL(video.url);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const id = host === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0]
      : ["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(host)
        ? url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1]
        : null;
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id) && (!poster || duplicated)) {
      return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
  } catch {
    // Non-YouTube source: retain an individual, valid poster if available.
  }
  return poster && !duplicated && !/\.(mp4|webm|m3u8)(?:$|[?#])/i.test(poster) ? poster : null;
}

const previewCopy = {
  en: {
    preparing: "Briefly is preparing this analysis from the event evidence.",
    waiting: "You do not need to wait here. Keep browsing other stories and Briefly will notify you in the app when this analysis is ready to read.",
    sourceOnly: "Source coverage",
    proVideo: "PRO · Play video",
    signInVideo: "Sign in to play video",
    sourceOnlyBody: "Briefly has not generated an analysis for this event. Read the original reports below, or watch the available source videos above.",
    failed: "Briefly could not prepare an authoritative analysis from the available source material.",
    retry: "Retry",
    retrying: "Retrying…",
    retryFailed: "Unable to restart generation. Please try again.",
    coverage: "Coverage",
    open: "Open original",
  },
  es: {
    preparing: "Briefly está preparando este análisis a partir de la evidencia del evento.",
    waiting: "No necesitas esperar aquí. Sigue explorando otras noticias y Briefly te avisará dentro de la app cuando el análisis esté listo para leer.",
    sourceOnly: "Cobertura de fuentes",
    proVideo: "PRO · Reproducir vídeo",
    signInVideo: "Inicia sesión para ver el vídeo",
    sourceOnlyBody: "Briefly todavía no ha generado un análisis. Puedes leer los reportajes originales o ver los vídeos disponibles arriba.",
    failed: "Briefly no pudo preparar un análisis autorizado con las fuentes disponibles.",
    retry: "Reintentar",
    retrying: "Reintentando…",
    retryFailed: "No se pudo reiniciar la generación. Inténtalo de nuevo.",
    coverage: "Cobertura",
    open: "Abrir original",
  },
  ja: {
    preparing: "イベントの根拠情報からBriefly分析を準備しています。",
    waiting: "ここで待つ必要はありません。他のニュースを見ながらお待ちください。分析が読めるようになったらBriefly内でお知らせします。",
    sourceOnly: "元記事の報道",
    proVideo: "PRO · 動画を再生",
    signInVideo: "ログインして動画を視聴",
    sourceOnlyBody: "この出来事の分析はまだ生成されていません。元記事を読んだり、上にある動画を視聴したりできます。",
    failed: "利用可能な情報から信頼できるBriefly分析を作成できませんでした。",
    retry: "再試行",
    retrying: "再試行中…",
    retryFailed: "生成を再開できませんでした。もう一度お試しください。",
    coverage: "関連記事",
    open: "元記事を開く",
  },
  "zh-CN": {
    preparing: "Briefly 正在根据事件证据准备这篇分析。",
    waiting: "你不需要停留在这里等待。可以继续浏览其他新闻，分析准备好后 Briefly 会在应用内通知你。",
    sourceOnly: "新闻来源",
    proVideo: "PRO · 播放视频",
    signInVideo: "登录后播放视频",
    sourceOnlyBody: "此事件尚未生成 Briefly 分析。你可以阅读下方的原始报道，或观看上方的视频。",
    failed: "Briefly 无法根据现有来源生成可靠的权威分析。",
    retry: "重试",
    retrying: "正在重试…",
    retryFailed: "无法重新启动生成，请重试。",
    coverage: "相关报道",
    open: "打开原文",
  },
  "zh-TW": {
    preparing: "Briefly 正在根據事件證據準備這篇分析。",
    waiting: "你不需要停留在這裡等待。可以繼續瀏覽其他新聞，分析準備好後 Briefly 會在應用內通知你。",
    sourceOnly: "新聞來源",
    proVideo: "PRO · 播放影片",
    signInVideo: "登入後播放影片",
    sourceOnlyBody: "此事件尚未產生 Briefly 分析。你可以閱讀下方的原始報導，或觀看上方的影片。",
    failed: "Briefly 無法根據現有來源產生可靠的權威分析。",
    retry: "重試",
    retrying: "正在重試…",
    retryFailed: "無法重新啟動產生，請再試一次。",
    coverage: "相關報導",
    open: "開啟原文",
  },
} as const;

export function EventPreviewView({
  article,
  onRetry,
  sourceScope,
  videoAccess,
  signedIn = false,
}: {
  article: CanonicalArticle;
  onRetry?: () => void;
  sourceScope?: "top" | "national" | "local";
  videoAccess: FeatureAccessState;
  signedIn?: boolean;
}) {
  const { width } = useWindowDimensions();
  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const copy = previewCopy[language] ?? previewCopy.en;
  const sourceCount = article.source_count ?? article.coverage?.length ?? 0;
  const failed = article.generation_status === "failed";
  const sourceOnly = article.generation_status === "source_only";
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const videoItems = previewVideoList(article);
  const selectedVideo = videoItems.find((item) => item.url === selectedVideoUrl) ?? videoItems[0] ?? null;
  const poster = selectedVideo ? previewVideoPoster(selectedVideo, videoItems) : null;
  const openVideoUpgrade = () => {
    const returnTo = `/story/${encodeURIComponent(article.slug)}?eventId=${encodeURIComponent(article.event_id)}`;
    if (!signedIn || videoAccess.gate === "sign_in") {
      router.push(`/sign-in?returnTo=${encodeURIComponent(returnTo)}` as never);
    } else {
      router.push(`/upgrade?returnTo=${encodeURIComponent(returnTo)}` as never);
    }
  };

  const openCoverage = async (
    url: string,
    source: string,
    sourceLanguage?: string | null,
  ) => {
    trackProductEvent("source_open", {
      eventId: article.event_id,
      articleVersionId: article.article_version_id,
      properties: {
        surface: sourceOnly ? "local_source_only_story" : "event_preview",
        source,
        language: sourceLanguage ?? null,
      },
    });

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    await Linking.openURL(url);
  };

  const retryGeneration = async () => {
    if (!onRetry || retrying || !article.event_id) return;

    const apiBase = process.env.EXPO_PUBLIC_BRIEFLY_API_URL?.replace(/\/$/, "");
    if (!apiBase) {
      setRetryError(copy.retryFailed);
      return;
    }

    setRetrying(true);
    setRetryError(null);
    try {
      const params = new URLSearchParams({
        include_draft: String(
          process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true",
        ),
      });
      if (sourceScope) params.set("source_scope", sourceScope);
      const response = await fetch(
        `${apiBase}/api/lazy-articles/event/${encodeURIComponent(article.event_id)}/retry?${params.toString()}`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(`Retry failed (${response.status})`);
      }
      onRetry();
    } catch (error) {
      console.warn("Briefly lazy article retry failed", error);
      setRetryError(copy.retryFailed);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.surface }]}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.page, width < 480 && styles.pageCompact]}>
        {!!selectedVideo && (
          <View style={styles.topVideoSection}>
            <View style={styles.topVideoPlayer}>
              {videoAccess.allowed ? (
                <StoryVideo
                  key={selectedVideo.url}
                  url={selectedVideo.url}
                  posterUrl={poster}
                  accessibilityLabel={selectedVideo.title || article.headline}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Unlock video"
                  onPress={openVideoUpgrade}
                  style={styles.videoLocked}
                >
                  {!!poster && <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" />}
                  <Text style={styles.videoLockedLabel}>{signedIn ? copy.proVideo : copy.signInVideo}</Text>
                </Pressable>
              )}
            </View>
            {videoItems.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.videoStrip}>
                {videoItems.map((video, index) => {
                  const thumbnail = previewVideoPoster(video, videoItems);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={video.title || `Video ${index + 1}`}
                      key={video.url}
                      onPress={() => {
                        if (!videoAccess.allowed) { openVideoUpgrade(); return; }
                        setSelectedVideoUrl(video.url);
                      }}
                      style={[styles.videoTile, { borderColor: selectedVideo.url === video.url ? colors.accent : colors.border }]}
                    >
                      {!!thumbnail && <Image source={{ uri: thumbnail }} style={styles.videoTilePoster} contentFit="cover" />}
                      <Text numberOfLines={2} style={[styles.videoTileText, { color: colors.text }]}>
                        {video.title || video.source || `Video ${index + 1}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}
        {!selectedVideo && !!article.image_url && (
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
            {sourceOnly ? copy.sourceOnly : failed ? copy.failed : copy.preparing}
          </Text>
          {!failed && (
            <Text style={[styles.statusBody, { color: colors.textMuted }]}>
              {sourceOnly ? copy.sourceOnlyBody : copy.waiting}
            </Text>
          )}
          {failed && onRetry && (
            <Pressable
              disabled={retrying}
              onPress={() => void retryGeneration()}
              style={[
                styles.retryButton,
                { borderColor: colors.border },
                retrying && styles.retryButtonDisabled,
              ]}
            > 
              <Text style={[styles.retryText, { color: colors.text }]}>
                {retrying ? copy.retrying : copy.retry}
              </Text>
            </Pressable>
          )}
          {!!retryError && (
            <Text style={[styles.retryError, { color: colors.textMuted }]}>
              {retryError}
            </Text>
          )}
        </View>

        {!!article.coverage?.length && (
          <View style={styles.coverageSection}>
            <Text style={[styles.coverageTitle, { color: colors.text }]}>{copy.coverage}</Text>
            {article.coverage.map((item) => (
              <Pressable
                key={item.evidence_id}
                onPress={() =>
                  void openCoverage(item.url, item.source, item.language)
                }
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
  topVideoSection: { width: "100%", marginBottom: 24, gap: 12 },
  topVideoPlayer: { width: "100%", aspectRatio: 16 / 9, borderRadius: 18, overflow: "hidden" },
  videoLocked: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#252525" },
  videoLockedLabel: { color: "#FFFFFF", backgroundColor: "rgba(0,0,0,0.78)", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, fontSize: 14, fontWeight: "800", overflow: "hidden" },
  videoStrip: { gap: 9, paddingBottom: 4 },
  videoTile: { width: 145, borderWidth: 1, borderRadius: 9, padding: 6, gap: 6 },
  videoTilePoster: { width: "100%", aspectRatio: 16 / 9, borderRadius: 6 },
  videoTileText: { fontSize: 12, lineHeight: 17, fontWeight: "600" },
  brand: { fontSize: 13, fontWeight: "800", letterSpacing: 2.2, marginBottom: 16 },
  headline: { fontSize: 42, lineHeight: 49, fontWeight: "900", letterSpacing: -1.1 },
  headlineCompact: { fontSize: 34, lineHeight: 40, letterSpacing: -0.7 },
  standfirst: { marginTop: 18, fontSize: 21, lineHeight: 31 },
  standfirstCompact: { fontSize: 18, lineHeight: 27 },
  metaRow: { marginTop: 18 },
  metaText: { fontSize: 13, fontWeight: "600" },
  statusCard: { marginTop: 28, borderWidth: 1, borderRadius: 16, padding: 18, gap: 14 },
  statusTitle: { fontSize: 16, lineHeight: 23, fontWeight: "800" },
  statusBody: { fontSize: 14, lineHeight: 21 },
  retryButton: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  retryButtonDisabled: { opacity: 0.55 },
  retryText: { fontSize: 13, fontWeight: "800" },
  retryError: { fontSize: 12, lineHeight: 18 },
  coverageSection: { marginTop: 44, paddingTop: 28, gap: 14 },
  coverageTitle: { fontSize: 24, lineHeight: 30, fontWeight: "800" },
  coverageRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14, flexDirection: "row", gap: 16, alignItems: "center" },
  coverageCopy: { flex: 1, gap: 4 },
  coverageSource: { fontSize: 13, fontWeight: "800" },
  coverageHeadline: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  coverageOpen: { fontSize: 12, fontWeight: "700", flexShrink: 0 },
});

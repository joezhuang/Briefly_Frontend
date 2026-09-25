import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  requestCardTranslation,
  type CardTranslation,
} from "@/api/briefly";
import { trackProductEvent } from "@/analytics/product-analytics";
import { BrieflyMediaFallback } from "@/components/briefly-brand";
import { StoryVideo } from "@/components/story-video";
import { useBrieflyAppConfig } from "@/context/app-config";
import { useBrieflyLanguage } from "@/context/language";
import { usePodcastPlayer } from "@/context/podcast-player";
import type { CanonicalArticle } from "@/models/article";
import { shareBrieflyStory } from "@/navigation/platform-share";
import { buildPublicStoryShareUrl } from "@/navigation/story-share";

type TileSize = "hero" | "secondary" | "standard";

export type StoryTileVideoStart = {
  eventId: string;
  url: string;
  posterUrl: string | null;
  headline: string;
  storyHref: string;
  storyReady: boolean;
  currentTime: number;
  anchorWindowY: number;
  anchorHeight: number;
};

type Props = {
  article: CanonicalArticle;
  size?: TileSize;
  href?: string;
  videoEnabled?: boolean;
  analyticsSource?: string;
  analyticsScope?: string;
  videoDetached?: boolean;
  videoResumeTime?: number;
  onVideoStart?: (session: StoryTileVideoStart) => void;
  onVideoTimeUpdate?: (eventId: string, seconds: number) => void;
  onVideoStop?: (eventId: string) => void;
};

type ActiveVideoListener = (eventId: string | null) => void;
let activeVideoEventId: string | null = null;
const activeVideoListeners = new Set<ActiveVideoListener>();

function setActiveHomepageVideo(eventId: string | null) {
  activeVideoEventId = eventId;
  activeVideoListeners.forEach((listener) => listener(eventId));
}

export function stopActiveHomepageVideo() {
  setActiveHomepageVideo(null);
}

function subscribeActiveHomepageVideo(listener: ActiveVideoListener) {
  activeVideoListeners.add(listener);
  listener(activeVideoEventId);
  return () => {
    activeVideoListeners.delete(listener);
  };
}

function normalizeLanguage(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (normalized === "cn" || normalized === "zh" || normalized === "zh-cn" || normalized.startsWith("zh-hans")) return "zh-CN";
  if (normalized === "tw" || normalized === "zh-tw" || normalized === "zh-hk" || normalized.startsWith("zh-hant")) return "zh-TW";
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("ja")) return "ja";
  return normalized;
}

function hasObviousHeadlineLanguageMismatch(
  headline: string,
  targetLanguage: string,
) {
  const text = String(headline ?? "").trim();
  if (!text) return false;

  const hasKana = /[\u3040-\u30ff]/.test(text);
  const hasHan = /[\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
  const hasHangul = /[\uac00-\ud7af]/.test(text);
  const hasCyrillic = /[\u0400-\u04ff]/.test(text);
  const hasArabic = /[\u0600-\u06ff]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);

  if (targetLanguage === "en" || targetLanguage === "es") {
    return hasKana || hasHan || hasHangul || hasCyrillic || hasArabic;
  }

  if (targetLanguage === "zh-CN" || targetLanguage === "zh-TW") {
    return (
      hasKana ||
      hasHangul ||
      hasCyrillic ||
      hasArabic ||
      (hasLatin && !hasHan)
    );
  }

  if (targetLanguage === "ja") {
    return (
      hasHangul ||
      hasCyrillic ||
      hasArabic ||
      (hasLatin && !hasHan && !hasKana)
    );
  }

  return false;
}

const translationCopy: Record<string, { translate: string; original: string; retry: string; play: string; listen: string; close: string; share: string; community: string }> = {
  en: { translate: "Translate", original: "Original", retry: "Retry", play: "Play", listen: "Listen to podcast", close: "Close video", share: "Share", community: "Community" },
  es: { translate: "Traducir", original: "Original", retry: "Reintentar", play: "Reproducir", listen: "Escuchar pódcast", close: "Cerrar video", share: "Compartir", community: "Comunidad" },
  ja: { translate: "翻訳", original: "原文", retry: "再試行", play: "再生", listen: "ポッドキャストを聴く", close: "動画を閉じる", share: "共有", community: "コミュニティ" },
  "zh-CN": { translate: "翻译", original: "原文", retry: "重试", play: "播放", listen: "收听播客", close: "关闭视频", share: "分享", community: "社区" },
  "zh-TW": { translate: "翻譯", original: "原文", retry: "重試", play: "播放", listen: "收聽 Podcast", close: "關閉影片", share: "分享", community: "社群" },
};

export function StoryTile({
  article,
  size = "standard",
  href,
  videoEnabled = true,
  analyticsSource,
  analyticsScope,
  videoDetached = false,
  videoResumeTime = 0,
  onVideoStart,
  onVideoTimeUpdate,
  onVideoStop,
}: Props) {
  const { language, t } = useBrieflyLanguage();
  const { config: appConfig } = useBrieflyAppConfig();
  const { currentTrack, status: podcastStatus, play: playPodcast, addToQueue: addPodcastToQueue } = usePodcastPlayer();
  const communityEnabled = appConfig?.community_enabled !== false;
  const translationEnabled = appConfig?.translation_enabled !== false;
  const podcastEnabled = appConfig?.podcast_enabled !== false;
  const [translation, setTranslation] = useState<CardTranslation | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translationFailed, setTranslationFailed] = useState(false);
  const [playingVideo, setPlayingVideo] = useState(false);
  const tileRef = useRef<View | null>(null);
  const lastVideoTimeRef = useRef(Math.max(0, videoResumeTime));

  useEffect(() => {
    return subscribeActiveHomepageVideo((eventId) => {
      setPlayingVideo(videoEnabled && eventId === article.event_id);
    });
  }, [article.event_id, videoEnabled]);

  useEffect(() => {
    if (!videoEnabled && activeVideoEventId === article.event_id) {
      setActiveHomepageVideo(null);
    }
  }, [article.event_id, videoEnabled]);

  useEffect(() => {
    if (videoResumeTime > 0) {
      lastVideoTimeRef.current = videoResumeTime;
    }
  }, [videoResumeTime]);

  const height = size === "hero" ? 520 : size === "secondary" ? 252 : 270;
  const headlineStyle =
    size === "hero"
      ? styles.heroHeadline
      : size === "secondary"
        ? styles.secondaryHeadline
        : styles.standardHeadline;
  const sourceCount = article.source_count ?? article.sources_used?.length ?? 0;
  const videoUrl = videoEnabled ? article.video_url ?? null : null;
  const podcastUrl = podcastEnabled ? article.podcast_audio_url ?? null : null;
  const imageUrl = article.video_thumbnail_url || article.image_url || null;
  const storyHref =
    href ??
    (() => {
      const params = new URLSearchParams({
        eventId: article.event_id,
        previewHeadline: article.headline,
      });
      if (analyticsSource) params.set("source", analyticsSource);
      if (analyticsScope) params.set("scope", analyticsScope);
      if (imageUrl) params.set("imageUrl", imageUrl);
      if (videoUrl) params.set("videoUrl", videoUrl);
      return `/story/${article.slug}?${params.toString()}`;
    })();

  const communityHref = `${storyHref}${storyHref.includes("?") ? "&" : "?"}community=1`;
  const articleReady = article.article_version_id != null;
  const contentLanguage = normalizeLanguage(article.content_language ?? article.language);
  const requestedLanguage = normalizeLanguage(article.requested_language ?? language);
  const presentationLanguage = normalizeLanguage(language);
  const metadataLanguageMismatch = contentLanguage
    ? contentLanguage !== presentationLanguage
    : requestedLanguage !== presentationLanguage;
  const visibleHeadlineMismatch = hasObviousHeadlineLanguageMismatch(
    article.headline,
    presentationLanguage,
  );
  const showTranslate =
    translationEnabled &&
    !!presentationLanguage &&
    (metadataLanguageMismatch || visibleHeadlineMismatch);

  const playbackStoryHref = () => {
    const separator = storyHref.includes("?") ? "&" : "?";
    const time = Math.max(0, lastVideoTimeRef.current);
    return `${storyHref}${separator}autoplayVideo=1&videoTime=${time.toFixed(2)}`;
  };

  const reportVideoStart = () => {
    lastVideoTimeRef.current = Math.max(0, videoResumeTime);
    setActiveHomepageVideo(article.event_id);
    requestAnimationFrame(() => {
      tileRef.current?.measureInWindow((_, y, __, measuredHeight) => {
        onVideoStart?.({
          eventId: article.event_id,
          url: videoUrl ?? "",
          posterUrl: imageUrl,
          headline: displayedHeadline,
          storyHref,
          storyReady: articleReady,
          currentTime: lastVideoTimeRef.current,
          anchorWindowY: y,
          anchorHeight: measuredHeight || height,
        });
      });
    });
  };

  const openStory = () => {
    router.push(storyHref as never);
  };

  const handlePodcast = () => {
    if (!podcastUrl) return;

    const track = {
      id: podcastUrl,
      title: displayedHeadline,
      source: podcastUrl,
    };
    const playerBusy = podcastStatus.playing === true;

    if (playerBusy) {
      addPodcastToQueue(track);
    } else {
      playPodcast(track);
    }

    trackProductEvent("podcast_action", {
      eventId: article.event_id,
      articleVersionId:
        article.podcast_article_version_id ?? article.article_version_id,
      properties: {
        action: playerBusy ? "queue" : "play",
        language: article.podcast_language ?? language,
        surface: "homepage_card",
        already_current: currentTrack?.id === podcastUrl,
      },
    });
  };

  const handleShare = async () => {
    const url = buildPublicStoryShareUrl(article, storyHref);
    if (!url) {
      Alert.alert("Briefly", "Sharing is not configured.");
      return;
    }
    const result = await shareBrieflyStory({
      headline: article.headline,
      url,
    });
    if (result === "copied") {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(t.shareLinkCopied);
      } else {
        Alert.alert("Briefly", t.shareLinkCopied);
      }
    }
    if (result !== "dismissed") {
      trackProductEvent("story_share", {
        eventId: article.event_id,
        articleVersionId: article.article_version_id,
        properties: { source: "homepage_card" },
      });
    }
  };

  const currentTranslation =
    translation?.language === language ? translation : null;
  const translated = showTranslation && currentTranslation !== null;
  const displayedHeadline = translated
    ? currentTranslation.headline
    : article.headline;
  const displayedStandfirst = translated
    ? currentTranslation.summary
    : article.standfirst;
  const copy = translationCopy[language] ?? translationCopy.en;

  const handleTranslation = async () => {
    if (translating) return;

    if (currentTranslation) {
      setShowTranslation((value) => !value);
      setTranslationFailed(false);
      return;
    }

    setTranslating(true);
    setTranslationFailed(false);
    try {
      const result = await requestCardTranslation(
        article.event_id,
        language,
        article.article_version_id,
        article.headline,
        article.standfirst,
      );
      setTranslation(result);
      setShowTranslation(true);
    } catch {
      setTranslationFailed(true);
    } finally {
      setTranslating(false);
    }
  };

  if (playingVideo && videoUrl) {
    return (
      <View ref={tileRef} style={StyleSheet.flatten([styles.tile, { height }])}>
        <View style={StyleSheet.absoluteFill}>
          {videoDetached ? (
            imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <BrieflyMediaFallback style={StyleSheet.absoluteFill} />
            )
          ) : (
            <StoryVideo
              url={videoUrl}
              posterUrl={imageUrl}
              accessibilityLabel={copy.play}
              autoStart
              initialTime={videoResumeTime}
              onTimeUpdate={(seconds) => {
                lastVideoTimeRef.current = seconds;
                onVideoTimeUpdate?.(article.event_id, seconds);
              }}
            />
          )}
          {articleReady && (
            <Pressable
              accessibilityRole={Platform.OS === "web" ? "link" : "button"}
              accessibilityLabel={displayedHeadline}
              onPress={() => {
                const nextHref = playbackStoryHref();
                setActiveHomepageVideo(null);
                onVideoStop?.(article.event_id);
                router.push(nextHref as never);
              }}
              style={({ pressed }) => [
                styles.videoStoryLink,
                pressed && styles.actionButtonPressed,
              ]}
            >
              <Text style={styles.arrowText}>→</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.close}
            onPress={() => {
              if (activeVideoEventId === article.event_id) {
                setActiveHomepageVideo(null);
                onVideoStop?.(article.event_id);
              }
            }}
            style={({ pressed }) => [
              styles.videoClose,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <Text style={styles.videoCloseText}>×</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      ref={tileRef}
      accessibilityRole={Platform.OS === "web" ? "link" : "button"}
      accessibilityLabel={displayedHeadline}
      onPress={openStory}
      style={StyleSheet.flatten([styles.tile, { height }])}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={180}
        />
      ) : (
        <BrieflyMediaFallback style={StyleSheet.absoluteFill} />
      )}

      <View
        style={[
          StyleSheet.absoluteFill,
          imageUrl ? styles.overlay : styles.fallbackOverlay,
        ]}
      />

      <View style={styles.content}>
        <Text style={styles.category}>
          {(article.category ?? t.topStory).toUpperCase()}
        </Text>

        <View style={styles.bottom}>
          <Text
            style={[styles.headline, headlineStyle]}
            numberOfLines={size === "hero" ? 4 : 3}
          >
            {displayedHeadline}
          </Text>

          {size === "hero" && !!displayedStandfirst && (
            <Text style={styles.standfirst} numberOfLines={3}>
              {displayedStandfirst}
            </Text>
          )}

          <View style={styles.mediaActions}>
            {articleReady && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.share}
                onPress={(event) => {
                  event.stopPropagation();
                  void handleShare();
                }}
                style={({ pressed }) => [
                  styles.actionIconButton,
                  pressed && styles.actionButtonPressed,
                ]}
              >
                <Text style={styles.actionIcon}>↗</Text>
              </Pressable>
            )}

            {communityEnabled && articleReady && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.community}
                onPress={(event) => {
                  event.stopPropagation();
                  router.push(communityHref as never);
                }}
                style={({ pressed }) => [
                  styles.actionIconButton,
                  pressed && styles.actionButtonPressed,
                ]}
              >
                <Text style={styles.actionIcon}>◎</Text>
              </Pressable>
            )}
            {!!videoUrl && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.play}
                onPress={(event) => {
                  event.stopPropagation();
                  reportVideoStart();
                }}
                style={({ pressed }) => [
                  styles.actionIconButton,
                  pressed && styles.actionButtonPressed,
                ]}
              >
                <Text style={styles.actionIcon}>▶</Text>
              </Pressable>
            )}

            {!!podcastUrl && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.listen}
                onPress={(event) => {
                  event.stopPropagation();
                  handlePodcast();
                }}
                style={({ pressed }) => [
                  styles.actionIconButton,
                  pressed && styles.actionButtonPressed,
                ]}
              >
                <Text style={styles.actionIcon}>🎧</Text>
              </Pressable>
            )}

            {showTranslate && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  translationFailed
                    ? copy.retry
                    : translated
                      ? copy.original
                      : copy.translate
                }
                disabled={translating}
                onPress={(event) => {
                  event.stopPropagation();
                  void handleTranslation();
                }}
                style={({ pressed }) => [
                  styles.actionIconButton,
                  translated && styles.actionIconButtonActive,
                  pressed && styles.actionButtonPressed,
                ]}
              >
                {translating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.actionIcon}>
                    {translationFailed ? "↻" : translated ? "A" : "文"}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {sourceCount}{" "}
            {sourceCount === 1 ? t.source : t.sourcesPlural}
          </Text>
          <View style={styles.arrow}>
            <Text style={styles.arrowText}>→</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#252525",
  },
  overlay: { backgroundColor: "rgba(0, 0, 0, 0.42)" },
  fallbackOverlay: { backgroundColor: "rgba(0, 0, 0, 0.52)" },
  content: {
    flex: 1,
    position: "relative",
    justifyContent: "space-between",
    padding: 22,
  },
  category: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  bottom: { gap: 10, paddingBottom: 54 },
  headline: {
    color: "#FFFFFF",
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  heroHeadline: { fontSize: 38, lineHeight: 43 },
  secondaryHeadline: { fontSize: 23, lineHeight: 27 },
  standardHeadline: { fontSize: 22, lineHeight: 27 },
  standfirst: {
    maxWidth: 620,
    color: "rgba(255,255,255,0.88)",
    fontSize: 16,
    lineHeight: 23,
  },
  mediaActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  actionIconButton: {
    alignSelf: "flex-start",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconButtonActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderColor: "rgba(255,255,255,0.85)",
  },
  actionButtonPressed: { opacity: 0.72 },
  actionIcon: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  videoStoryLink: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  videoClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  videoCloseText: {
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 28,
    fontWeight: "700",
  },
  metaRow: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: { color: "rgba(255,255,255,0.82)", fontSize: 13 },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { color: "#FFFFFF", fontSize: 21 },
});

import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  requestCardTranslation,
  type CardTranslation,
} from "@/api/briefly";
import { StoryVideo } from "@/components/story-video";
import { useBrieflyLanguage } from "@/context/language";
import type { CanonicalArticle } from "@/models/article";

type TileSize = "hero" | "secondary" | "standard";
type Props = { article: CanonicalArticle; size?: TileSize; href?: string };

type ActiveVideoListener = (eventId: string | null) => void;
let activeVideoEventId: string | null = null;
const activeVideoListeners = new Set<ActiveVideoListener>();

function setActiveHomepageVideo(eventId: string | null) {
  activeVideoEventId = eventId;
  activeVideoListeners.forEach((listener) => listener(eventId));
}

function subscribeActiveHomepageVideo(listener: ActiveVideoListener) {
  activeVideoListeners.add(listener);
  listener(activeVideoEventId);
  return () => activeVideoListeners.delete(listener);
}

const translationCopy: Record<string, { translate: string; original: string; retry: string; play: string; close: string }> = {
  en: { translate: "Translate", original: "Original", retry: "Retry", play: "Play", close: "Close video" },
  es: { translate: "Traducir", original: "Original", retry: "Reintentar", play: "Reproducir", close: "Cerrar video" },
  ja: { translate: "翻訳", original: "原文", retry: "再試行", play: "再生", close: "動画を閉じる" },
  "zh-CN": { translate: "翻译", original: "原文", retry: "重试", play: "播放", close: "关闭视频" },
  "zh-TW": { translate: "翻譯", original: "原文", retry: "重試", play: "播放", close: "關閉影片" },
};

export function StoryTile({ article, size = "standard", href }: Props) {
  const { language, t } = useBrieflyLanguage();
  const [translation, setTranslation] = useState<CardTranslation | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translationFailed, setTranslationFailed] = useState(false);
  const [playingVideo, setPlayingVideo] = useState(false);

  useEffect(() => {
    return subscribeActiveHomepageVideo((eventId) => {
      setPlayingVideo(eventId === article.event_id);
    });
  }, [article.event_id]);

  const height = size === "hero" ? 520 : size === "secondary" ? 252 : 270;
  const headlineStyle =
    size === "hero"
      ? styles.heroHeadline
      : size === "secondary"
        ? styles.secondaryHeadline
        : styles.standardHeadline;
  const sourceCount = article.source_count ?? article.sources_used?.length ?? 0;
  const videoUrl = article.video_url ?? null;
  const imageUrl = article.video_thumbnail_url || article.image_url || null;
  const storyHref =
    href ??
    (() => {
      const params = new URLSearchParams({
        eventId: article.event_id,
        previewHeadline: article.headline,
      });
      if (imageUrl) params.set("imageUrl", imageUrl);
      if (videoUrl) params.set("videoUrl", videoUrl);
      return `/story/${article.slug}?${params.toString()}`;
    })();

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

  return (
    <Pressable
      onPress={() => {
        if (!playingVideo) router.push(storyHref as never);
      }}
      style={StyleSheet.flatten([styles.tile, { height }])}
    >
      {playingVideo && videoUrl ? (
        <View style={StyleSheet.absoluteFill}>
          <StoryVideo
            url={videoUrl}
            posterUrl={imageUrl}
            accessibilityLabel={copy.play}
            autoStart
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.close}
            onPress={(event) => {
              event.stopPropagation();
              if (activeVideoEventId === article.event_id) {
                setActiveHomepageVideo(null);
              }
            }}
            style={({ pressed }) => [
              styles.videoClose,
              pressed && styles.translateButtonPressed,
            ]}
          >
            <Text style={styles.videoCloseText}>×</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={180}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.imageFallback]} />
          )}

          <View style={[StyleSheet.absoluteFill, styles.overlay]} />

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
                {!!videoUrl && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={copy.play}
                    onPress={(event) => {
                      event.stopPropagation();
                      setActiveHomepageVideo(article.event_id);
                    }}
                    style={({ pressed }) => [
                      styles.translateButton,
                      pressed && styles.translateButtonPressed,
                    ]}
                  >
                    <Text style={styles.translateText}>▶ {copy.play}</Text>
                  </Pressable>
                )}

                <Pressable
                  accessibilityRole="button"
                  disabled={translating}
                  onPress={(event) => {
                    event.stopPropagation();
                    void handleTranslation();
                  }}
                  style={({ pressed }) => [
                    styles.translateButton,
                    pressed && styles.translateButtonPressed,
                  ]}
                >
                  {translating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.translateText}>
                      {translationFailed
                        ? copy.retry
                        : translated
                          ? copy.original
                          : copy.translate}
                    </Text>
                  )}
                </Pressable>
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
          </View>
        </>
      )}
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
  imageFallback: { backgroundColor: "#42433F" },
  overlay: { backgroundColor: "rgba(0, 0, 0, 0.42)" },
  content: { flex: 1, justifyContent: "space-between", padding: 22 },
  category: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  bottom: { gap: 10 },
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
  translateButton: {
    alignSelf: "flex-start",
    minHeight: 30,
    minWidth: 72,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  translateButtonPressed: { opacity: 0.72 },
  translateText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  videoClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  meta: { color: "rgba(255,255,255,0.82)", fontSize: 13 },
  arrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { color: "#FFFFFF", fontSize: 21 },
});

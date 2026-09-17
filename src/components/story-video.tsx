import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import StoryVideoEmbed from "./story-video-embed";

type Props = {
  url: string;
  posterUrl?: string | null;
  accessibilityLabel?: string;
  compact?: boolean;
  autoStart?: boolean;
};

function embeddedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}?playsinline=1&rel=0&autoplay=1` : null;
    }

    if (host.endsWith("youtube.com")) {
      const id = parsed.searchParams.get("v") || parsed.pathname.match(/\/(?:shorts|embed)\/([^/?#]+)/)?.[1];
      return id ? `https://www.youtube.com/embed/${id}?playsinline=1&rel=0&autoplay=1` : null;
    }

    if (host.endsWith("vimeo.com")) {
      const id = parsed.pathname.match(/\/(?:video\/)?(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null;
    }
  } catch {}
  return null;
}

function DirectVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
    instance.play();
  });

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls
      contentFit="cover"
      surfaceType="textureView"
      allowsFullscreen
      allowsPictureInPicture
    />
  );
}

export function StoryVideo({
  url,
  posterUrl,
  accessibilityLabel = "Play video",
  compact = false,
  autoStart = false,
}: Props) {
  const [started, setStarted] = useState(autoStart);
  const embed = useMemo(() => embeddedUrl(url), [url]);

  useEffect(() => {
    if (autoStart) setStarted(true);
  }, [autoStart]);

  return (
    <View style={styles.root}>
      {started ? (
        embed ? (
          <StoryVideoEmbed src={embed} title={accessibilityLabel} />
        ) : (
          <DirectVideo url={url} />
        )
      ) : (
        <>
          {posterUrl ? (
            <Image
              source={{ uri: posterUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={180}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.fallback]} />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            onPress={() => setStarted(true)}
            style={({ pressed }) => [
              compact ? styles.compactButton : styles.playButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={compact ? styles.compactIcon : styles.playIcon}>▶</Text>
            {!compact && <Text style={styles.playText}>{accessibilityLabel}</Text>}
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: "100%", height: "100%", backgroundColor: "#252525", overflow: "hidden" },
  fallback: { backgroundColor: "#343434" },
  playButton: {
    position: "absolute",
    alignSelf: "center",
    top: "50%",
    transform: [{ translateY: -22 }],
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.72)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  compactButton: {
    position: "absolute",
    right: 18,
    bottom: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.72 },
  playIcon: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  compactIcon: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", marginLeft: 2 },
  playText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
});

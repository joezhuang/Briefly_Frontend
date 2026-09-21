import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import StoryVideoEmbed from "./story-video-embed";

type Props = {
  url: string;
  posterUrl?: string | null;
  accessibilityLabel?: string;
  compact?: boolean;
  autoStart?: boolean;
  initialTime?: number;
  onStarted?: () => void;
  onTimeUpdate?: (seconds: number) => void;
  onPlayingChange?: (playing: boolean) => void;
};

function safeTime(value: number | undefined) {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : 0;
}

function embeddedUrl(url: string, initialTime: number): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const start = Math.floor(safeTime(initialTime));

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (!id) return null;
      const embed = new URL(`https://www.youtube.com/embed/${id}`);
      embed.searchParams.set("playsinline", "1");
      embed.searchParams.set("rel", "0");
      embed.searchParams.set("autoplay", "1");
      embed.searchParams.set("enablejsapi", "1");
      if (start > 0) embed.searchParams.set("start", String(start));
      return embed.toString();
    }

    if (host.endsWith("youtube.com")) {
      const id =
        parsed.searchParams.get("v") ||
        parsed.pathname.match(/\/(?:shorts|embed)\/([^/?#]+)/)?.[1];
      if (!id) return null;
      const embed = new URL(`https://www.youtube.com/embed/${id}`);
      embed.searchParams.set("playsinline", "1");
      embed.searchParams.set("rel", "0");
      embed.searchParams.set("autoplay", "1");
      embed.searchParams.set("enablejsapi", "1");
      if (start > 0) embed.searchParams.set("start", String(start));
      return embed.toString();
    }

    if (host.endsWith("vimeo.com")) {
      const id = parsed.pathname.match(/\/(?:video\/)?(\d+)/)?.[1];
      if (!id) return null;
      const embed = new URL(`https://player.vimeo.com/video/${id}`);
      embed.searchParams.set("autoplay", "1");
      embed.searchParams.set("api", "1");
      if (start > 0) embed.hash = `t=${start}s`;
      return embed.toString();
    }
  } catch {}
  return null;
}

function DirectVideo({
  url,
  initialTime,
  onTimeUpdate,
  onPlayingChange,
}: {
  url: string;
  initialTime: number;
  onTimeUpdate?: (seconds: number) => void;
  onPlayingChange?: (playing: boolean) => void;
}) {
  const startTime = safeTime(initialTime);
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
    instance.timeUpdateEventInterval = 0.5;
    if (startTime > 0) {
      instance.currentTime = startTime;
    }
    instance.play();
  });

  useEffect(() => {
    const timeSubscription = player.addListener("timeUpdate", (payload) => {
      onTimeUpdate?.(Math.max(0, payload.currentTime || 0));
    });
    const playingSubscription = player.addListener("playingChange", (payload) => {
      onPlayingChange?.(payload.isPlaying);
    });

    return () => {
      timeSubscription.remove();
      playingSubscription.remove();
    };
  }, [onPlayingChange, onTimeUpdate, player]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls
      contentFit="cover"
      surfaceType="textureView"
      fullscreenOptions={{ enable: true }}
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
  initialTime = 0,
  onStarted,
  onTimeUpdate,
  onPlayingChange,
}: Props) {
  const [manuallyStarted, setManuallyStarted] = useState(false);
  const started = autoStart || manuallyStarted;
  const startTime = safeTime(initialTime);
  const startedNotifiedRef = useRef(false);
  const embed = useMemo(
    () => embeddedUrl(url, startTime),
    [startTime, url],
  );

  useEffect(() => {
    if (!started || startedNotifiedRef.current) return;
    startedNotifiedRef.current = true;
    onStarted?.();
  }, [onStarted, started]);

  return (
    <View style={styles.root}>
      {started ? (
        embed ? (
          <StoryVideoEmbed
            src={embed}
            title={accessibilityLabel}
            initialTime={startTime}
            onTimeUpdate={onTimeUpdate}
            onPlayingChange={onPlayingChange}
            dom={{ useExpoDOMWebView: false }}
          />
        ) : (
          <DirectVideo
            url={url}
            initialTime={startTime}
            onTimeUpdate={onTimeUpdate}
            onPlayingChange={onPlayingChange}
          />
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
            onPress={() => {
              setManuallyStarted(true);
              onPlayingChange?.(true);
            }}
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
  root: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#252525",
    overflow: "hidden",
  },
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
  compactIcon: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginLeft: 2,
  },
  playText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
});

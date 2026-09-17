import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  url: string;
  posterUrl?: string | null;
  accessibilityLabel?: string;
  compact?: boolean;
};

export function StoryVideo({
  url,
  posterUrl,
  accessibilityLabel = "Play video",
  compact = false,
}: Props) {
  const [started, setStarted] = useState(false);
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
  });

  const start = () => {
    setStarted(true);
    player.play();
  };

  return (
    <View style={styles.root}>
      {started ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          nativeControls
          contentFit="cover"
          surfaceType="textureView"
          allowsFullscreen
          allowsPictureInPicture
        />
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
            onPress={start}
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
  root: { flex: 1, width: "100%", height: "100%", backgroundColor: "#252525" },
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

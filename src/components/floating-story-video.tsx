import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { StoryVideo } from "@/components/story-video";

type Props = {
  url: string;
  posterUrl?: string | null;
  accessibilityLabel?: string;
  initialTime?: number;
  onTimeUpdate?: (seconds: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onClose: () => void;
  onOpenStory?: () => void;
};

export function FloatingStoryVideo({
  url,
  posterUrl,
  accessibilityLabel = "Playing video",
  initialTime = 0,
  onTimeUpdate,
  onPlayingChange,
  onClose,
  onOpenStory,
}: Props) {
  const { width } = useWindowDimensions();
  const playerWidth = Math.min(360, Math.max(220, width * 0.62));

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={[styles.player, { width: playerWidth }]}>
        <StoryVideo
          url={url}
          posterUrl={posterUrl}
          accessibilityLabel={accessibilityLabel}
          autoStart
          initialTime={initialTime}
          onTimeUpdate={onTimeUpdate}
          onPlayingChange={onPlayingChange}
        />

        {!!onOpenStory && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open story"
            onPress={onOpenStory}
            style={({ pressed }) => [
              styles.storyButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.storyButtonText}>→</Text>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close video"
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 80,
    elevation: 12,
  },
  player: {
    aspectRatio: 16 / 9,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#252525",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 12,
  },
  storyButton: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  storyButtonText: {
    color: "#FFFFFF",
    fontSize: 21,
    lineHeight: 24,
    fontWeight: "800",
  },
  closeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 28,
    fontWeight: "700",
  },
  pressed: { opacity: 0.72 },
});

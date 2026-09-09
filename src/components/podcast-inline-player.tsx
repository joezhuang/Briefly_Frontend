import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useBrieflyTheme } from "@/context/theme";

function formatTime(value: number) {
  const safe = Number.isFinite(value) && value > 0 ? value : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PodcastInlinePlayer({ source }: { source: string }) {
  const { colors } = useBrieflyTheme();
  const player = useAudioPlayer(source, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  const duration = status.duration || 0;
  const currentTime = status.currentTime || 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const progressWidth = `${progress * 100}%` as `${number}%`;

  const togglePlayback = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (duration > 0 && currentTime >= duration - 0.25) {
      void player.seekTo(0);
    }
    player.play();
  };

  const seekBy = (seconds: number) => {
    const upperBound = duration > 0 ? duration : currentTime + Math.max(seconds, 0);
    const next = Math.max(0, Math.min(upperBound, currentTime + seconds));
    void player.seekTo(next);
  };

  return (
    <View
      style={[
        styles.player,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={status.playing ? "Pause podcast" : "Play podcast"}
          onPress={togglePlayback}
          style={[styles.primaryButton, { backgroundColor: colors.text }]}
        >
          <Text style={[styles.primaryText, { color: colors.background }]}>
            {status.playing ? "Pause" : "Play"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rewind 15 seconds"
          onPress={() => seekBy(-15)}
          style={[styles.secondaryButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.secondaryText, { color: colors.text }]}>−15s</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Forward 15 seconds"
          onPress={() => seekBy(15)}
          style={[styles.secondaryButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.secondaryText, { color: colors.text }]}>+15s</Text>
        </Pressable>
      </View>

      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progress,
            { backgroundColor: colors.accent, width: progressWidth },
          ]}
        />
      </View>

      <View style={styles.timeRow}>
        <Text style={[styles.timeText, { color: colors.textMuted }]}>
          {formatTime(currentTime)}
        </Text>
        <Text style={[styles.timeText, { color: colors.textMuted }]}>
          {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  player: {
    width: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryButton: {
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: 14, fontWeight: "800" },
  secondaryButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 13, fontWeight: "700" },
  track: {
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  progress: {
    height: "100%",
    borderRadius: 999,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeText: { fontSize: 12, fontVariant: ["tabular-nums"] },
});

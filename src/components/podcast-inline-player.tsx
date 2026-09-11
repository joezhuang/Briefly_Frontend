import { Pressable, StyleSheet, Text, View } from "react-native";

import { usePodcastPlayer } from "@/context/podcast-player";
import { useBrieflyTheme } from "@/context/theme";

function formatTime(value: number) {
  const safe = Number.isFinite(value) && value > 0 ? value : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PodcastInlinePlayer({
  source,
  title,
}: {
  source: string;
  title: string;
}) {
  const { colors } = useBrieflyTheme();
  const { currentTrack, status, toggle, seekBy } = usePodcastPlayer();
  const trackId = source;
  const isCurrentTrack = currentTrack?.id === trackId;

  const duration = isCurrentTrack ? status.duration || 0 : 0;
  const currentTime = isCurrentTrack ? status.currentTime || 0 : 0;
  const isPlaying = isCurrentTrack && status.playing;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const progressWidth = `${progress * 100}%` as `${number}%`;

  const track = { id: trackId, title, source };

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
          accessibilityLabel={isPlaying ? "Pause podcast" : "Play podcast"}
          onPress={() => toggle(track)}
          style={[styles.primaryButton, { backgroundColor: colors.text }]}
        >
          <Text style={[styles.primaryText, { color: colors.background }]}> 
            {isPlaying ? "Pause" : "Play"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rewind 15 seconds"
          disabled={!isCurrentTrack}
          onPress={() => seekBy(-15)}
          style={[
            styles.secondaryButton,
            { borderColor: colors.border },
            !isCurrentTrack && styles.disabled,
          ]}
        >
          <Text style={[styles.secondaryText, { color: colors.text }]}>−15s</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Forward 15 seconds"
          disabled={!isCurrentTrack}
          onPress={() => seekBy(15)}
          style={[
            styles.secondaryButton,
            { borderColor: colors.border },
            !isCurrentTrack && styles.disabled,
          ]}
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
  disabled: { opacity: 0.45 },
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

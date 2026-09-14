import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { usePodcastPlayer } from "@/context/podcast-player";
import { useBrieflyTheme } from "@/context/theme";

function formatTime(value: number) {
  const safe = Number.isFinite(value) && value > 0 ? value : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function GlobalPodcastPlayer() {
  const { colors } = useBrieflyTheme();
  const {
    currentTrack,
    queue,
    currentIndex,
    status,
    toggle,
    seekBy,
    playNext,
    playPrevious,
    playQueueTrack,
    removeFromQueue,
    moveQueueItem,
    clearQueue,
    close,
  } = usePodcastPlayer();
  const [minimized, setMinimized] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  if (!currentTrack) return null;

  const duration = status.duration || 0;
  const currentTime = status.currentTime || 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const progressWidth = `${progress * 100}%` as `${number}%`;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex + 1 < queue.length;

  if (minimized) {
    return (
      <View pointerEvents="box-none" style={styles.minimizedOverlay}>
        <View
          style={[
            styles.minimizedPlayer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Expand podcast player"
            onPress={() => setMinimized(false)}
            hitSlop={8}
            style={styles.miniButton}
          >
            <Text style={[styles.miniIcon, { color: colors.textMuted }]}>↗</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={status.playing ? "Pause podcast" : "Play podcast"}
            onPress={() => toggle()}
            style={[styles.miniPlayButton, { backgroundColor: colors.text }]}
          >
            <Text style={[styles.miniPlayText, { color: colors.background }]}> 
              {status.playing ? "❚❚" : "▶"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open podcast queue"
            onPress={() => {
              setMinimized(false);
              setQueueOpen(true);
            }}
            style={styles.miniQueueButton}
          >
            <Text style={[styles.miniQueueText, { color: colors.text }]}>☰ {queue.length}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close podcast player"
            onPress={close}
            hitSlop={8}
            style={styles.miniButton}
          >
            <Text style={[styles.miniClose, { color: colors.textMuted }]}>×</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View
        style={[
          styles.player,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.topRow}>
          <View style={styles.copy}>
            <Text style={[styles.kicker, { color: colors.accent }]}>PODCAST</Text>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {currentTrack.title}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open podcast queue"
            onPress={() => setQueueOpen((value) => !value)}
            style={[styles.queueButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.queueButtonText, { color: colors.text }]}>Queue {queue.length}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Minimize podcast player"
            onPress={() => setMinimized(true)}
            hitSlop={10}
          >
            <Text style={[styles.minimize, { color: colors.textMuted }]}>⌄</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close podcast player"
            onPress={close}
            hitSlop={10}
          >
            <Text style={[styles.close, { color: colors.textMuted }]}>×</Text>
          </Pressable>
        </View>

        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous podcast"
            disabled={!hasPrevious}
            onPress={playPrevious}
            style={[
              styles.secondaryButton,
              { borderColor: colors.border },
              !hasPrevious && styles.disabled,
            ]}
          >
            <Text style={[styles.secondaryText, { color: colors.text }]}>Previous</Text>
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
            accessibilityLabel={status.playing ? "Pause podcast" : "Play podcast"}
            onPress={() => toggle()}
            style={[styles.primaryButton, { backgroundColor: colors.text }]}
          >
            <Text style={[styles.primaryText, { color: colors.background }]}> 
              {status.playing ? "Pause" : "Play"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Forward 15 seconds"
            onPress={() => seekBy(15)}
            style={[styles.secondaryButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.secondaryText, { color: colors.text }]}>+15s</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next podcast"
            disabled={!hasNext}
            onPress={playNext}
            style={[
              styles.secondaryButton,
              { borderColor: colors.border },
              !hasNext && styles.disabled,
            ]}
          >
            <Text style={[styles.secondaryText, { color: colors.text }]}>Next</Text>
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

        {queueOpen && (
          <View style={[styles.queuePanel, { borderTopColor: colors.border }]}>
            <View style={styles.queueHeader}>
              <Text style={[styles.queueTitle, { color: colors.text }]}>Up next</Text>
              {queue.length > 0 && (
                <Pressable onPress={clearQueue} hitSlop={8}>
                  <Text style={[styles.clearText, { color: colors.textMuted }]}>Clear</Text>
                </Pressable>
              )}
            </View>

            {queue.length === 0 ? (
              <Text style={[styles.emptyQueue, { color: colors.textMuted }]}>No podcasts in queue.</Text>
            ) : (
              <ScrollView style={styles.queueScroll} contentContainerStyle={styles.queueList}>
                {queue.map((track, index) => {
                  const active = track.id === currentTrack.id;
                  return (
                    <View
                      key={track.id}
                      style={[
                        styles.queueRow,
                        {
                          borderColor: active ? colors.accent : colors.border,
                          backgroundColor: active ? colors.surfaceMuted : colors.surface,
                        },
                      ]}
                    >
                      <Pressable
                        style={styles.queueTrackCopy}
                        onPress={() => playQueueTrack(index)}
                      >
                        <Text
                          style={[
                            styles.queueTrackTitle,
                            { color: active ? colors.accent : colors.text },
                          ]}
                          numberOfLines={2}
                        >
                          {index + 1}. {track.title}
                        </Text>
                        {active && (
                          <Text style={[styles.nowPlaying, { color: colors.textMuted }]}>Now playing</Text>
                        )}
                      </Pressable>

                      <View style={styles.queueActions}>
                        <Pressable
                          disabled={index === 0}
                          onPress={() => moveQueueItem(index, -1)}
                          hitSlop={6}
                          style={index === 0 && styles.disabled}
                        >
                          <Text style={[styles.queueActionText, { color: colors.textMuted }]}>↑</Text>
                        </Pressable>
                        <Pressable
                          disabled={index === queue.length - 1}
                          onPress={() => moveQueueItem(index, 1)}
                          hitSlop={6}
                          style={index === queue.length - 1 && styles.disabled}
                        >
                          <Text style={[styles.queueActionText, { color: colors.textMuted }]}>↓</Text>
                        </Pressable>
                        <Pressable onPress={() => removeFromQueue(track.id)} hitSlop={6}>
                          <Text style={[styles.removeText, { color: colors.textMuted }]}>×</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 14,
    alignItems: "center",
  },
  minimizedOverlay: {
    position: "absolute",
    left: 56,
    right: 56,
    bottom: 18,
    alignItems: "center",
  },
  player: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "78%",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
  },
  minimizedPlayer: {
    minHeight: 50,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  copy: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  title: { marginTop: 2, fontSize: 14, fontWeight: "800" },
  minimize: { fontSize: 26, lineHeight: 26, fontWeight: "700" },
  close: { fontSize: 26, lineHeight: 26, fontWeight: "500" },
  queueButton: {
    minHeight: 32,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  queueButtonText: { fontSize: 11, fontWeight: "800" },
  miniButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  miniIcon: { fontSize: 18, lineHeight: 20, fontWeight: "800" },
  miniClose: { fontSize: 24, lineHeight: 24, fontWeight: "500" },
  miniPlayButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  miniPlayText: { fontSize: 13, lineHeight: 16, fontWeight: "900" },
  miniQueueButton: {
    minHeight: 34,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  miniQueueText: { fontSize: 12, fontWeight: "800" },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryButton: {
    minHeight: 36,
    minWidth: 92,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: 13, fontWeight: "800" },
  secondaryButton: {
    minHeight: 36,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 12, fontWeight: "700" },
  disabled: { opacity: 0.35 },
  track: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  progress: { height: "100%", borderRadius: 999 },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeText: { fontSize: 11, fontVariant: ["tabular-nums"] },
  queuePanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 8,
  },
  queueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  queueTitle: { fontSize: 14, fontWeight: "900" },
  clearText: { fontSize: 12, fontWeight: "800" },
  emptyQueue: { fontSize: 13, paddingVertical: 8 },
  queueScroll: { maxHeight: 240 },
  queueList: { gap: 7, paddingBottom: 2 },
  queueRow: {
    minHeight: 54,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  queueTrackCopy: { flex: 1, minWidth: 0 },
  queueTrackTitle: { fontSize: 12, fontWeight: "800", lineHeight: 17 },
  nowPlaying: { marginTop: 2, fontSize: 10, fontWeight: "700" },
  queueActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  queueActionText: { fontSize: 18, fontWeight: "900" },
  removeText: { fontSize: 22, lineHeight: 22, fontWeight: "500" },
});

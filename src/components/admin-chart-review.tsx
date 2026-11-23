import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { getChartReviewQueue, type ChartReviewQueue } from "@/api/briefly";
import { useBrieflyTheme } from "@/context/theme";
import { chartReviewStoryHref } from "@/utils/chart-review-link";

/** The dashboard is the inbox; moderation happens inside the actual story. */
export function AdminChartReview({ initialEventId }: { initialEventId?: string }) {
  const { colors } = useBrieflyTheme();
  const [queue, setQueue] = useState<ChartReviewQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshQueue = useCallback(async () => {
    try {
      setQueue(await getChartReviewQueue());
      setError("");
    } catch {
      setError("Could not load the chart review queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch asynchronously rather than invoking a state-updating callback
    // directly from an effect. Ignore results after unmount.
    let active = true;
    void getChartReviewQueue()
      .then((next) => {
        if (!active) return;
        setQueue(next);
        setError("");
      })
      .catch(() => {
        if (active) setError("Could not load the chart review queue.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    // Old dashboard deep links are forwarded to the in-article editor.
    if (initialEventId) router.replace(chartReviewStoryHref(initialEventId) as never);
  }, [initialEventId]);

  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: colors.text }]}>Chart review</Text>
          <Text style={[styles.note, { color: colors.textMuted }]}>
            Open a live story to review its charts exactly as readers will see them.
            Remove unwanted charts, publish the selection, or dismiss a draft that is not good enough.
          </Text>
        </View>
        <Pressable accessibilityRole="button" style={[styles.button, { borderColor: colors.border }]}
          onPress={() => void refreshQueue()}>
          <Text style={[styles.action, { color: colors.text }]}>Refresh</Text>
        </Pressable>
      </View>
      {loading && <ActivityIndicator color={colors.accent} />}
      {!!error && <Text style={[styles.note, { color: colors.accent }]}>{error}</Text>}
      {queue && (
        <Text style={[styles.count, { color: colors.text }]}>
          {queue.pending_count} chart {queue.pending_count === 1 ? "set" : "sets"} awaiting review
        </Text>
      )}
      {queue && queue.items.length === 0 && (
        <Text style={[styles.note, { color: colors.textMuted }]}>
          No new chart sets are awaiting review.
        </Text>
      )}
      {queue?.items.map((item) => (
        <Pressable
          key={item.event_id + ":" + item.article_version_id}
          accessibilityRole="button"
          onPress={() => router.push(chartReviewStoryHref(item.event_id) as never)}
          style={[styles.queueRow, { borderColor: colors.border }]}
        >
          <View style={styles.headingCopy}>
            <Text style={[styles.count, { color: colors.text }]} numberOfLines={2}>
              {item.preview_title || "Generated chart set"}
            </Text>
            <Text style={[styles.note, { color: colors.textMuted }]}>
              {item.chart_count} chart(s) · Article version {item.article_version_id}
            </Text>
          </View>
          <Text style={[styles.action, { color: colors.accent }]}>Review in article ›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 14 },
  heading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12,
    justifyContent: "space-between" },
  headingCopy: { flex: 1, minWidth: 160, gap: 6 },
  title: { fontSize: 18, fontWeight: "900" },
  count: { fontSize: 13, fontWeight: "800" },
  note: { fontSize: 12, lineHeight: 18 },
  action: { fontSize: 12, fontWeight: "800" },
  button: { borderWidth: 1, minHeight: 44, borderRadius: 999,
    paddingHorizontal: 14, justifyContent: "center" },
  queueRow: { borderWidth: 1, minHeight: 68, borderRadius: 12, padding: 12,
    flexDirection: "row", alignItems: "center", gap: 12 },
});

import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import {
  getChartReview, getChartReviewQueue, releaseChartDraft, removeChartFromDraft,
  type ChartReviewDraft, type ChartReviewQueue, type VerifiedDataChart,
} from "@/api/briefly";
import { SmartChartVisual } from "@/components/smart-chart-visual";
import { useBrieflyTheme } from "@/context/theme";

const visualKinds = new Set(["donut", "stacked", "grouped", "dumbbell", "waterfall"]);

function ChartPreview({ chart }: { chart: VerifiedDataChart }) {
  const { colors } = useBrieflyTheme();
  const maximum = Math.max(Number.EPSILON, ...chart.points.map((p) => p.value));
  return (
    <View style={styles.preview}>
      <Text style={[styles.chartTitle, { color: colors.text }]}>{chart.title}</Text>
      <Text style={[styles.note, { color: colors.textMuted }]}>
        {chart.unit} · {chart.chart_type}
      </Text>
      {visualKinds.has(chart.chart_type) ? <SmartChartVisual chart={chart} /> :
        chart.points.map((point, index) => (
          <View key={point.label + index} style={styles.valueRow}>
            <View style={styles.heading}>
              <Text style={[styles.label, { color: colors.text }]}>{point.label}</Text>
              <Text style={[styles.label, { color: colors.text }]}>
                {Number(point.value).toLocaleString()}
              </Text>
            </View>
            {chart.chart_type !== "kpi" && (
              <View style={[styles.track, { backgroundColor: colors.border }]}>
                <View style={[styles.fill, { backgroundColor: colors.accent,
                  width: (Math.max(0, Math.min(100, point.value / maximum * 100)) + "%") as never }]} />
              </View>
            )}
          </View>
        ))
      }
    </View>
  );
}

export function AdminChartReview({ initialEventId }: { initialEventId?: string }) {
  const { colors } = useBrieflyTheme();
  const [queue, setQueue] = useState<ChartReviewQueue | null>(null);
  const [draft, setDraft] = useState<ChartReviewDraft | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const refreshQueue = useCallback(async () => {
    const next = await getChartReviewQueue();
    setQueue(next);
  }, []);
  const openDraft = useCallback(async (eventId: string) => {
    setSelected(eventId);
    setDraft(null);
    setConfirmRemove(null);
    setConfirmRelease(false);
    setExpanded(null);
    setError("");
    try {
      setDraft(await getChartReview(eventId));
    } catch {
      setError("Could not load the chart draft for this story version.");
    }
  }, []);
  useEffect(() => {
    if (!initialEventId) return;
    let active = true;
    void getChartReview(initialEventId)
      .then((result) => {
        if (!active) return;
        setSelected(initialEventId);
        setDraft(result);
        setConfirmRemove(null);
        setConfirmRelease(false);
        setExpanded(null);
        setError("");
      })
      .catch(() => {
        if (active) setError("Could not load the chart draft for this story version.");
      });
    return () => { active = false; };
  }, [initialEventId]);

  useEffect(() => {
    let active = true;
    void getChartReviewQueue()
      .then((result) => { if (active) setQueue(result); })
      .catch(() => { if (active) setError("Could not load the admin chart queue."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const moderate = async (kind: "remove" | "release", index?: number) => {
    if (!selected || !draft || busy) return;
    const event = selected;
    setBusy(true);
    setError("");
    try {
      if (kind === "remove" && index != null) {
        await removeChartFromDraft(event, index, draft.revision);
      } else {
        await releaseChartDraft(event, draft.revision);
      }
      await refreshQueue();
      if (kind === "release") {
        setSelected(null);
        setDraft(null);
      } else {
        setDraft(await getChartReview(event));
      }
      setConfirmRemove(null);
      setConfirmRelease(false);
      setExpanded(null);
    } catch {
      setError("The change could not be saved. Refresh this draft before retrying.");
      try { setDraft(await getChartReview(event)); } catch { /* previous error remains */ }
      setConfirmRemove(null);
      setConfirmRelease(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.panel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: colors.text }]}>Chart review</Text>
          <Text style={[styles.note, { color: colors.textMuted }]}>
            Source-verified drafts stay private until you release them. Removing a draft
            chart does not alter the existing public version.
          </Text>
        </View>
        <Pressable accessibilityRole="button" disabled={busy} style={[styles.outline, { borderColor: colors.border }]}
          onPress={() => {
            void refreshQueue().catch(() => setError("Could not refresh review queue."));
            if (selected) void openDraft(selected);
          }}>
          <Text style={[styles.action, { color: colors.text }]}>Refresh</Text>
        </Pressable>
      </View>
      {loading && <ActivityIndicator color={colors.accent} />}
      {!!error && <Text style={[styles.note, { color: colors.accent }]}>{error}</Text>}
      {queue && <Text style={[styles.label, { color: colors.text }]}>
        {queue.pending_count} chart {queue.pending_count === 1 ? "set" : "sets"} awaiting review
      </Text>}
      {queue && queue.items.length === 0 && !selected &&
        <Text style={[styles.note, { color: colors.textMuted }]}>No new chart sets await review.</Text>}
      <View style={styles.queue}>
        {queue?.items.map((item) => (
          <Pressable key={item.event_id + ":" + item.article_version_id} accessibilityRole="button"
            onPress={() => void openDraft(item.event_id)}
            style={[styles.queueRow, { borderColor: selected === item.event_id ? colors.accent : colors.border }]}>
            <View style={styles.headingCopy}>
              <Text numberOfLines={2} style={[styles.label, { color: colors.text }]}>
                {item.preview_title || "New chart set"}
              </Text>
              <Text style={[styles.note, { color: colors.textMuted }]}>
                {item.chart_count} chart(s) · Article version {item.article_version_id}
              </Text>
            </View>
            <Text style={[styles.action, { color: colors.accent }]}>Review ›</Text>
          </Pressable>
        ))}
      </View>
      {selected && draft && (
        <View style={[styles.draft, { borderTopColor: colors.border }]}>
          <View style={styles.heading}>
            <Text style={[styles.title, { color: colors.text }]}>Review selection</Text>
            <Pressable accessibilityRole="button"
              onPress={() => router.push(("/s/" + encodeURIComponent(selected)) as never)}>
              <Text style={[styles.action, { color: colors.accent }]}>Open story ↗</Text>
            </Pressable>
          </View>
          {!!draft.published_charts.length && <Text style={[styles.note, { color: colors.textMuted }]}>
            {draft.published_charts.length} currently published chart(s) remain unchanged until release.
          </Text>}
          {!draft.ready && <Text style={[styles.note, { color: colors.textMuted }]}>
            No completed draft for the current story version.
          </Text>}
          {draft.ready && draft.draft_charts.length === 0 &&
            <Text style={[styles.note, { color: colors.textMuted }]}>
              The selection is empty. Releasing it withdraws the public chart set.
            </Text>}
          {draft.draft_charts.map((chart, index) => (
            <View key={chart.title + index} style={[styles.chartCard, { borderColor: colors.border }]}>
              <ChartPreview chart={chart} />
              <Pressable accessibilityRole="button" style={styles.touch}
                onPress={() => setExpanded(expanded === index ? null : index)}>
                <Text style={[styles.action, { color: colors.accent }]}>
                  {expanded === index ? "Hide source evidence −" : "View numerical evidence +"}
                </Text>
              </Pressable>
              {expanded === index && chart.points.map((point, i) => (
                <View key={point.label + i} style={styles.evidence}>
                  <Text style={[styles.label, { color: colors.text }]}>{point.label}</Text>
                  <Text style={[styles.note, { color: colors.textMuted }]}>{point.evidence_quote}</Text>
                  <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(point.source_url)}>
                    <Text style={[styles.action, { color: colors.accent }]}>{point.source} ↗</Text>
                  </Pressable>
                </View>
              ))}
              {confirmRemove === index ? (
                <View style={styles.heading}>
                  <Text style={[styles.note, { color: colors.textMuted }]}>Remove this chart from the draft?</Text>
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => void moderate("remove", index)}
                    style={[styles.outline, { borderColor: colors.border }]}>
                    <Text style={[styles.action, { color: colors.text }]}>Confirm remove</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => setConfirmRemove(null)}>
                    <Text style={[styles.action, { color: colors.accent }]}>Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable accessibilityRole="button" style={styles.touch}
                  onPress={() => setConfirmRemove(index)}>
                  <Text style={[styles.action, { color: colors.accent }]}>Remove from draft</Text>
                </Pressable>
              )}
            </View>
          ))}
          {draft.ready && <View style={styles.releaseArea}>
            {confirmRelease && <Text style={[styles.note, { color: colors.textMuted }]}>
              Release this exact selection to everyone?
            </Text>}
            <Pressable accessibilityRole="button" disabled={busy}
              style={[styles.releaseButton, { backgroundColor: colors.text }]}
              onPress={() => confirmRelease ? void moderate("release") : setConfirmRelease(true)}>
              <Text style={[styles.action, { color: colors.background }]}>
                {busy ? "Saving…" : confirmRelease ? "Confirm release" :
                  draft.draft_charts.length ? "Release selected charts" : "Withdraw public charts"}
              </Text>
            </Pressable>
            {confirmRelease && <Pressable accessibilityRole="button" onPress={() => setConfirmRelease(false)}>
              <Text style={[styles.action, { color: colors.accent }]}>Cancel</Text>
            </Pressable>}
          </View>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 14 },
  heading: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  headingCopy: { flex: 1, minWidth: 180, gap: 5 },
  title: { fontSize: 18, fontWeight: "900" },
  label: { fontSize: 13, fontWeight: "800" },
  note: { fontSize: 12, lineHeight: 18 },
  action: { fontSize: 12, fontWeight: "800" },
  outline: { borderWidth: 1, borderRadius: 999, minHeight: 44, paddingHorizontal: 14, justifyContent: "center" },
  queue: { gap: 9 },
  queueRow: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", minHeight: 65, gap: 12 },
  draft: { paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, gap: 12 },
  chartCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 10 },
  preview: { gap: 8 },
  chartTitle: { fontSize: 15, fontWeight: "900" },
  valueRow: { gap: 5 },
  track: { height: 8, borderRadius: 5, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5 },
  touch: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center" },
  evidence: { gap: 6, paddingVertical: 6 },
  releaseArea: { gap: 10, marginTop: 4 },
  releaseButton: { alignSelf: "flex-start", borderRadius: 999, minHeight: 44,
    paddingHorizontal: 16, justifyContent: "center" },
});

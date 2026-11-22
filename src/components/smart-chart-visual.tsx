import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type DimensionValue } from "react-native";

import type { VerifiedDataChart, VerifiedDataChartPoint } from "@/api/briefly";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

const PALETTE = ["#AD552B", "#267AA3", "#609369", "#A16AA4", "#B58B26", "#78869F"];
const RING_COUNT = 84;
const RING_POINTS = Array.from({ length: RING_COUNT }, (_, i) => i);
const DIAMETER = 154;
const RADIUS = 57;
const THICKNESS = 17;
const SEGMENT_LENGTH = Math.PI * 2 * RADIUS / RING_COUNT + 0.85;

const copyByLanguage = {
  en: { donut: "Doughnut", bars: "Bars", total: "Total" },
  es: { donut: "Anillo", bars: "Barras", total: "Total" },
  ja: { donut: "ドーナツ", bars: "棒グラフ", total: "合計" },
  "zh-CN": { donut: "环形图", bars: "条形图", total: "合计" },
  "zh-TW": { donut: "環形圖", bars: "長條圖", total: "合計" },
} as const;

function formatted(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function percentage(value: number, total: number) {
  return (total ? 100 * value / total : 0).toLocaleString(undefined,
    { maximumFractionDigits: 1 }) + "%";
}

function trackWidth(value: number, maximum: number): DimensionValue {
  return (Math.max(0, Math.min(100, value / Math.max(maximum, Number.EPSILON) * 100)) + "%") as DimensionValue;
}

function ComparedBars({ chart }: { chart: VerifiedDataChart }) {
  const { colors } = useBrieflyTheme();
  const maximum = Math.max(Number.EPSILON, ...chart.points.map((point) => point.value));
  return (
    <View style={styles.bars}>
      {chart.points.map((point, i) => (
        <View key={point.label + i} style={styles.barRow}>
          <View style={styles.rowTitle}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{point.label}</Text>
            <Text style={[styles.amount, { color: colors.text }]}>{formatted(point.value)}</Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.barFill, {
              backgroundColor: PALETTE[i % PALETTE.length], width: trackWidth(point.value, maximum),
            }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function DonutVisual({ chart }: { chart: VerifiedDataChart }) {
  const { colors } = useBrieflyTheme();
  const { language } = useBrieflyLanguage();
  const copy = copyByLanguage[language] ?? copyByLanguage.en;
  const [styleMode, setStyleMode] = useState<"donut" | "bars">("donut");
  const total = chart.points.reduce((sum, point) => sum + point.value, 0);
  const eligible = chart.points.length >= 2 && chart.points.length <= 6 &&
    chart.points.every((point) => Number.isFinite(point.value) && point.value > 0) && total > 0;
  if (!eligible) return <ComparedBars chart={chart} />;
  const boundaries = chart.points.map((point, i) =>
    chart.points.slice(0, i + 1).reduce((sum, item) => sum + item.value, 0) / total
  );
  return (
    <View style={styles.donutBody}>
      <View style={styles.switchRow}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: styleMode === "donut" }}
          onPress={() => setStyleMode("donut")}
          style={[styles.switchButton, { borderColor: colors.border },
            styleMode === "donut" && { backgroundColor: colors.text }]}>
          <Text style={[styles.switchLabel, { color: styleMode === "donut" ? colors.background : colors.text }]}>
            {copy.donut}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: styleMode === "bars" }}
          onPress={() => setStyleMode("bars")}
          style={[styles.switchButton, { borderColor: colors.border },
            styleMode === "bars" && { backgroundColor: colors.text }]}>
          <Text style={[styles.switchLabel, { color: styleMode === "bars" ? colors.background : colors.text }]}>
            {copy.bars}
          </Text>
        </Pressable>
      </View>
      {styleMode === "bars" ? <ComparedBars chart={chart} /> : (
        <View style={styles.donutLayout}>
          <View style={styles.ring} accessibilityRole="image"
            accessibilityLabel={chart.title + ": " +
              chart.points.map((p) => p.label + " " + percentage(p.value, total)).join(", ")}>
            {RING_POINTS.map((i) => {
              const fraction = (i + 0.5) / RING_COUNT;
              const segmentIndex = Math.max(0, boundaries.findIndex((boundary) => fraction <= boundary));
              const radians = (i + 0.5) * 2 * Math.PI / RING_COUNT - Math.PI / 2;
              return <View key={i} style={{
                position: "absolute", width: SEGMENT_LENGTH, height: THICKNESS,
                left: DIAMETER / 2 + RADIUS * Math.cos(radians) - SEGMENT_LENGTH / 2,
                top: DIAMETER / 2 + RADIUS * Math.sin(radians) - THICKNESS / 2,
                borderRadius: 2, backgroundColor: PALETTE[segmentIndex % PALETTE.length],
                transform: [{ rotate: ((radians * 180 / Math.PI + 90) + "deg") as any }],
              }} />;
            })}
            <View style={[styles.ringCenter, { backgroundColor: colors.surface }]}>
              <Text style={[styles.centerValue, { color: colors.text }]}>{formatted(total)}</Text>
              <Text style={[styles.muted, { color: colors.textMuted }]}>{copy.total}</Text>
            </View>
          </View>
          <View style={styles.donutLegend}>
            {chart.points.map((point, i) => (
              <View key={point.label + i} style={styles.legendRow}>
                <View style={[styles.legendMarker, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
                <View style={styles.legendText}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>{point.label}</Text>
                  <Text style={[styles.muted, { color: colors.textMuted }]}>
                    {formatted(point.value)} · {percentage(point.value, total)}
                    {point.derived ? " *" : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function pairedData(chart: VerifiedDataChart) {
  const groups = new Map<string, VerifiedDataChartPoint[]>();
  for (const point of chart.points) {
    if (!point.group || !point.series) return [];
    const previous = groups.get(point.group) ?? [];
    previous.push(point);
    groups.set(point.group, previous);
  }
  const series = Array.from(new Set(chart.points.map((point) => point.series)));
  if (series.length !== 2 || groups.size < 2 || Array.from(groups.values()).some(
    (row) => row.length !== 2 || !series.every((s) => row.some((p) => p.series === s))
  )) return [];
  return Array.from(groups, ([group, points]) => ({
    group, points: series.map((s) => points.find((point) => point.series === s)!),
  }));
}

function GroupedVisual({ chart }: { chart: VerifiedDataChart }) {
  const { colors } = useBrieflyTheme();
  const rows = pairedData(chart);
  if (!rows.length) return <ComparedBars chart={chart} />;
  const maximum = Math.max(Number.EPSILON, ...chart.points.map((point) => point.value));
  return (
    <View style={styles.bars}>
      <View style={styles.legendHeader}>
        {rows[0].points.map((point, i) => (
          <View key={point.series} style={styles.legendChip}>
            <View style={[styles.legendMarker, { backgroundColor: PALETTE[i] }]} />
            <Text style={[styles.muted, { color: colors.textMuted }]}>{point.series}</Text>
          </View>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row.group} style={styles.groupRow}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{row.group}</Text>
          {row.points.map((point, i) => (
            <View key={point.series} style={styles.pairedBar}>
              <Text style={[styles.pairValue, { color: colors.text }]}>{formatted(point.value)}</Text>
              <View style={[styles.barTrack, { flex: 1, backgroundColor: colors.border }]}>
                <View style={[styles.barFill, {
                  width: trackWidth(point.value, maximum), backgroundColor: PALETTE[i],
                }]} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function DumbbellVisual({ chart }: { chart: VerifiedDataChart }) {
  const { colors } = useBrieflyTheme();
  const rows = pairedData(chart);
  if (!rows.length) return <ComparedBars chart={chart} />;
  const max = Math.max(Number.EPSILON, ...chart.points.map((point) => point.value));
  return (
    <View style={styles.bars}>
      <View style={styles.legendHeader}>
        {rows[0].points.map((point, i) => (
          <View key={point.series} style={styles.legendChip}>
            <View style={[styles.legendMarker, { backgroundColor: PALETTE[i] }]} />
            <Text style={[styles.muted, { color: colors.textMuted }]}>{point.series}</Text>
          </View>
        ))}
      </View>
      {rows.map((row) => {
        const before = row.points[0].value / max * 100;
        const after = row.points[1].value / max * 100;
        return (
          <View key={row.group} style={styles.groupRow}>
            <View style={styles.rowTitle}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{row.group}</Text>
              <Text style={[styles.amount, { color: colors.text }]}>
                {formatted(row.points[0].value)} → {formatted(row.points[1].value)}
              </Text>
            </View>
            <View style={styles.dumbbellTrack}>
              <View style={[styles.axis, { backgroundColor: colors.border }]} />
              <View style={[styles.connector, {
                backgroundColor: colors.textMuted,
                left: (Math.min(before, after) + "%") as DimensionValue,
                width: (Math.abs(after - before) + "%") as DimensionValue,
              }]} />
              {[before, after].map((position, i) => (
                <View key={i} style={[styles.dot, {
                  left: (position + "%") as DimensionValue,
                  backgroundColor: PALETTE[i],
                }]} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function WaterfallVisual({ chart }: { chart: VerifiedDataChart }) {
  const { colors } = useBrieflyTheme();
  const roles = chart.points.map((point) => point.role);
  if (roles.length < 4 || roles[0] !== "start" || roles[roles.length - 1] !== "end" ||
    roles.slice(1, -1).some((role) => role !== "increase" && role !== "decrease")) {
    return <ComparedBars chart={chart} />;
  }
  const steps = chart.points.reduce<{
    running: number;
    steps: Array<(typeof chart.points)[number] & { before: number; after: number }>;
  }>((acc, point) => {
    const before = acc.running;
    const after = point.role === "start" || point.role === "end"
      ? point.value
      : point.role === "increase" ? before + point.value : before - point.value;
    return {
      running: after,
      steps: [...acc.steps, { ...point, before, after }],
    };
  }, { running: 0, steps: [] }).steps;
  const maximum = Math.max(1, ...steps.map((step) => Math.max(step.before, step.after)));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
      <View style={[styles.waterfall, { width: Math.max(310, steps.length * 90) }]}>
        <View style={[styles.waterfallAxis, { backgroundColor: colors.border }]} />
        <View style={styles.waterfallColumns}>
          {steps.map((step, i) => {
            const base = step.role === "start" || step.role === "end" ? 0 :
              Math.min(step.before, step.after);
            return (
              <View key={step.label + i} style={styles.waterfallColumn}>
                <View style={styles.waterfallArea}>
                  <View style={[styles.waterfallBar, {
                    bottom: Math.max(0, base) / maximum * 130,
                    height: Math.max(3, step.value / maximum * 130),
                    backgroundColor: step.role === "start" || step.role === "end" ?
                      colors.accent : step.role === "decrease" ? "#B55D4D" : "#579467",
                  }]} />
                </View>
                <Text style={[styles.amount, { color: colors.text }]}>
                  {step.role === "increase" ? "+" : step.role === "decrease" ? "−" : ""}
                  {formatted(step.value)}
                </Text>
                <Text numberOfLines={3} style={[styles.waterfallLabel, { color: colors.textMuted }]}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

export function SmartChartVisual({ chart }: { chart: VerifiedDataChart }) {
  if (chart.chart_type === "donut" || chart.chart_type === "stacked") {
    return <DonutVisual chart={chart} />;
  }
  if (chart.chart_type === "grouped") return <GroupedVisual chart={chart} />;
  if (chart.chart_type === "dumbbell") return <DumbbellVisual chart={chart} />;
  if (chart.chart_type === "waterfall") return <WaterfallVisual chart={chart} />;
  return null;
}

const styles = StyleSheet.create({
  bars: { gap: 12 },
  barRow: { gap: 6 },
  rowTitle: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  rowLabel: { flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  amount: { fontSize: 12, fontWeight: "900" },
  barTrack: { height: 10, borderRadius: 6, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 6 },
  donutBody: { gap: 12 },
  switchRow: { flexDirection: "row", alignSelf: "flex-start", gap: 6 },
  switchButton: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999,
    minHeight: 44, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  switchLabel: { fontSize: 12, fontWeight: "800" },
  donutLayout: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 },
  ring: { position: "relative", width: DIAMETER, height: DIAMETER },
  ringCenter: { position: "absolute", left: 28, top: 28, width: DIAMETER - 56,
    height: DIAMETER - 56, borderRadius: (DIAMETER - 56) / 2,
    alignItems: "center", justifyContent: "center" },
  centerValue: { fontSize: 19, fontWeight: "900" },
  donutLegend: { flex: 1, minWidth: 118, gap: 9 },
  legendRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  legendMarker: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  legendText: { flex: 1, gap: 3 },
  muted: { fontSize: 11, lineHeight: 16 },
  legendHeader: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  legendChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  groupRow: { gap: 7 },
  pairedBar: { flexDirection: "row", gap: 8, alignItems: "center" },
  pairValue: { width: 42, fontSize: 12, fontWeight: "800", textAlign: "right" },
  dumbbellTrack: { height: 20, marginHorizontal: 6, justifyContent: "center", position: "relative" },
  axis: { height: 2, width: "100%" },
  connector: { height: 3, position: "absolute", top: 8 },
  dot: { position: "absolute", top: 4, width: 12, height: 12,
    borderRadius: 6, transform: [{ translateX: -6 }] },
  waterfall: { paddingVertical: 8 },
  waterfallAxis: { height: 1, position: "absolute", top: 148, left: 0, right: 0 },
  waterfallColumns: { height: 223, flexDirection: "row", alignItems: "flex-end" },
  waterfallColumn: { flex: 1, minWidth: 80, gap: 5, alignItems: "center" },
  waterfallArea: { width: "100%", height: 144, paddingHorizontal: 14, position: "relative" },
  waterfallBar: { position: "absolute", left: "25%", right: "25%", borderRadius: 3 },
  waterfallLabel: { textAlign: "center", fontSize: 11, lineHeight: 15, height: 44 },
});

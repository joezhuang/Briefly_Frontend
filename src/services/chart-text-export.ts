import type { ClusterDataChartStatus, ChartReviewDraft, VerifiedDataChart } from "@/api/briefly";

export type ChartTextFormat = "plain" | "markdown";
export type ChartTextLabels = {
  item: string; value: string; source: string; sources: string;
  forecast: string; proposal: string; target: string; partial: string; derived: string;
  start: string; increase: string; decrease: string; end: string;
};

// A privileged GET can return a private draft with status=ready. Never use
// readyCharts, visibleCards, draft_charts or historical versions for export.
export function publishedChartsForExport(isAdmin: boolean, review: ChartReviewDraft | null,
  status: ClusterDataChartStatus | null): VerifiedDataChart[] {
  if (!isAdmin) return [];
  if (review) return review.published_release_id != null ? review.published_charts : [];
  return status?.published === true && status.status === "ready" ? status.charts : [];
}

const clean = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
const cell = (value: string) => value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");

const safeUrl = (value: string | undefined | null) => /^https?:\/\/[^\s]+$/i.test(value ?? "") ? value! : "";

export function formatChartText(charts: readonly VerifiedDataChart[], options: {
  format: ChartTextFormat; headline: string; labels: ChartTextLabels;
  includeReferences?: boolean; storyUrl?: string | null;
}): string {
  const { format, labels } = options;
  const markdown = format === "markdown";
  const withReferences = options.includeReferences === true;
  const sources: { name: string; url: string }[] = [];
  const sourceRef = (name: string, url: string) => {
    if (!withReferences || (!name && !url)) return "";
    let index = sources.findIndex(s => url ? s.url === url : !s.url && s.name === name);
    if (index === -1) { index = sources.length; sources.push({ name, url }); }
    else if (!sources[index].name && name) sources[index].name = name;
    return "[" + (index + 1) + "]";
  };
  const lines = [clean(options.headline), ""];
  for (const chart of charts) {
    const qualifier = chart.qualifier && chart.qualifier !== "reported" ? labels[chart.qualifier] : "";
    const title = clean(chart.title) + (qualifier ? " (" + qualifier + ")" : "");
    lines.push(markdown ? "### " + title : title);
    if (chart.partial) lines.push(labels.partial);
    const description = clean(chart.description);
    if (description) lines.push(description);
    if (markdown) lines.push("",
      "| " + cell(labels.item) + " | " + cell(labels.value) + " |" + (withReferences ? " " + cell(labels.source) + " |" : ""),
      "| --- | ---: |" + (withReferences ? " --- |" : ""));
    const bars = !markdown && chart.chart_type === "bar" && chart.points.length > 1
      && chart.points.every(p => Number.isFinite(p.value) && p.value >= 0);
    const maximum = bars ? Math.max(...chart.points.map(p => p.value)) : 0;
    for (const point of chart.points) {
      const context = [...new Set([point.group, point.series, point.label].map(clean).filter(Boolean))].join(" / ");
      const role = point.role ? labels[point.role] : "";
      const label = context + (role ? " (" + role + ")" : "");
      // Retain stored precision and units; never recompute verified values.
      const unit = clean(chart.unit);
      const value = String(point.value) + (unit.startsWith("%") ? unit : unit ? " " + unit : "");
      const note = point.derived ? " (" + labels.derived + ")" : "";
      const ref = withReferences ? sourceRef(clean(point.source), safeUrl(point.source_url)) : "";
      if (markdown) lines.push("| " + cell(label) + " | " + cell(value + note) + " |" + (withReferences ? " " + ref + " |" : ""));
      else {
        lines.push("• " + label + ": " + value + note + (ref ? " " + ref : ""));
        if (bars && maximum > 0) lines.push("  " + "█".repeat(Math.round(16 * point.value / maximum)));
      }
    }
    if (withReferences) {
      const relationshipRef = sourceRef("", safeUrl(chart.relationship_source_url));
      if (relationshipRef) lines.push("", labels.source + ": " + relationshipRef);
    }
    lines.push("");
  }
  if (withReferences && sources.length) {
    lines.push(labels.sources);
    sources.forEach((s, i) => lines.push("[" + (i + 1) + "] " + [s.name, s.url].filter(Boolean).join(" — ")));
    lines.push("");
  }
  const storyUrl = withReferences ? safeUrl(options.storyUrl) : "";
  if (storyUrl) lines.push("Briefly: " + storyUrl);
  return lines.join("\n").trim();
}

import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { EventEvidence, EventIntelligence } from "@/api/event-intelligence";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

const copy = {
  en: {
    title: "Global coverage",
    subtitle: "Where reporting on this event comes from",
    reports: "reports",
    sources: "sources",
    countries: "countries",
    languages: "languages",
    byCountry: "By country",
    byLanguage: "Languages",
    other: "Other",
    unspecified: "Unspecified",
  },
  es: {
    title: "Cobertura global",
    subtitle: "De dónde provienen los reportes sobre este evento",
    reports: "reportes",
    sources: "fuentes",
    countries: "países",
    languages: "idiomas",
    byCountry: "Por país",
    byLanguage: "Idiomas",
    other: "Otros",
    unspecified: "Sin especificar",
  },
  ja: {
    title: "世界の報道",
    subtitle: "この出来事をどの国・言語の報道が伝えているか",
    reports: "件の報道",
    sources: "情報源",
    countries: "か国",
    languages: "言語",
    byCountry: "国・地域別",
    byLanguage: "言語",
    other: "その他",
    unspecified: "不明",
  },
  "zh-CN": {
    title: "全球报道",
    subtitle: "这一事件的报道来自哪些国家和语言",
    reports: "条报道",
    sources: "个来源",
    countries: "个国家/地区",
    languages: "种语言",
    byCountry: "按国家/地区",
    byLanguage: "语言",
    other: "其他",
    unspecified: "未标注",
  },
  "zh-TW": {
    title: "全球報導",
    subtitle: "這一事件的報導來自哪些國家和語言",
    reports: "則報導",
    sources: "個來源",
    countries: "個國家/地區",
    languages: "種語言",
    byCountry: "按國家/地區",
    byLanguage: "語言",
    other: "其他",
    unspecified: "未標註",
  },
} as const;

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
  ja: "日本語",
  zh: "中文",
  "zh-cn": "简体中文",
  "zh-tw": "繁體中文",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  ar: "العربية",
  id: "Bahasa Indonesia",
  ms: "Bahasa Melayu",
  vi: "Tiếng Việt",
  th: "ไทย",
  tr: "Türkçe",
  hi: "हिन्दी",
  bn: "বাংলা",
  ru: "Русский",
  pl: "Polski",
  nl: "Nederlands",
};

type BreakdownItem = {
  label: string;
  count: number;
};

function normalizedLanguage(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/_/g, "-")
    .toLowerCase();
}

function languageLabel(value: string | null | undefined, unspecified: string) {
  const normalized = normalizedLanguage(value);
  if (!normalized) return unspecified;
  return LANGUAGE_LABELS[normalized] ?? LANGUAGE_LABELS[normalized.split("-")[0]] ?? String(value).toUpperCase();
}

function aggregate(
  evidence: EventEvidence[],
  selector: (item: EventEvidence) => string,
  otherLabel: string,
  limit = 6,
): BreakdownItem[] {
  const counts = new Map<string, number>();
  evidence.forEach((item) => {
    const label = selector(item).trim();
    if (!label) return;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  const sorted = Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  if (sorted.length <= limit) return sorted;
  const visible = sorted.slice(0, limit);
  const remaining = sorted.slice(limit).reduce((sum, item) => sum + item.count, 0);
  return [...visible, { label: otherLabel, count: remaining }];
}

export function EventCoveragePanel({ intelligence }: { intelligence: EventIntelligence }) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const text = copy[language] ?? copy.en;

  const evidence = useMemo(
    () => (intelligence.evidence ?? []).filter((item) => !item.is_duplicate),
    [intelligence.evidence],
  );

  const countries = useMemo(
    () =>
      aggregate(
        evidence,
        (item) => String(item.country || text.unspecified),
        text.other,
      ),
    [evidence, text.other, text.unspecified],
  );

  const languages = useMemo(
    () =>
      aggregate(
        evidence,
        (item) => languageLabel(item.source_language, text.unspecified),
        text.other,
      ),
    [evidence, text.other, text.unspecified],
  );

  if (!evidence.length) return null;

  const sourceCount = new Set(
    evidence.map((item) => String(item.source || "").trim()).filter(Boolean),
  ).size;
  const countryCount = new Set(
    evidence.map((item) => String(item.country || "").trim()).filter(Boolean),
  ).size;
  const languageCount = new Set(
    evidence.map((item) => normalizedLanguage(item.source_language)).filter(Boolean),
  ).size;

  const stats = [
    `${evidence.length} ${text.reports}`,
    sourceCount ? `${sourceCount} ${text.sources}` : null,
    countryCount ? `${countryCount} ${text.countries}` : null,
    languageCount ? `${languageCount} ${text.languages}` : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <View
      style={[
        styles.container,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{text.title}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {text.subtitle}
        </Text>
        <Text style={[styles.stats, { color: colors.accent }]}>
          {stats.join(" · ")}
        </Text>
      </View>

      {!!countries.length && (
        <CoverageSection title={text.byCountry} items={countries} />
      )}
      {!!languages.length && (
        <CoverageSection title={text.byLanguage} items={languages} />
      )}
    </View>
  );
}

function CoverageSection({
  title,
  items,
}: {
  title: string;
  items: BreakdownItem[];
}) {
  const { colors } = useBrieflyTheme();
  const max = Math.max(1, ...items.map((item) => item.count));

  return (
    <View style={[styles.section, { borderTopColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <View style={styles.rows}>
        {items.map((item) => (
          <View key={item.label} style={styles.row}>
            <View style={styles.rowHeading}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
              <Text style={[styles.rowCount, { color: colors.textMuted }]}>{item.count}</Text>
            </View>
            <View style={[styles.barTrack, { backgroundColor: colors.surfaceMuted }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: colors.accent,
                    width: `${Math.max(8, Math.round((item.count / max) * 100))}%`,
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 20,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 23,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  stats: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
  },
  section: {
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  rows: {
    marginTop: 12,
    gap: 12,
  },
  row: {
    gap: 6,
  },
  rowHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  rowCount: {
    fontSize: 12,
    fontWeight: "800",
  },
  barTrack: {
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },
});

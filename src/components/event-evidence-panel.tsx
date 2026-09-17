import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  getEventIntelligence,
  type EventAssessment,
  type EventClaimObservation,
  type EventContradictionCandidate,
  type EventIntelligence,
} from "@/api/event-intelligence";
import { EventCoveragePanel } from "@/components/event-coverage-panel";
import { EventEvolutionPanel } from "@/components/event-evolution-panel";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

const copy = {
  en: {
    title: "Evidence",
    timeline: "Timeline",
    coverage: "Coverage",
    whatWeKnow: "What we know",
    disputed: "Disputed",
    unknown: "Still unknown",
    sources: "sources",
    languages: "languages",
    countries: "countries",
    corroborated: "Corroborated",
    developing: "Developing",
    singleSource: "Single source",
    conflicted: "Conflicting reports",
    reportedBy: "Reported consistently by",
    numericConflict: "Reports differ on a stated number",
    negationConflict: "Reports directly conflict",
    conflict: "Reports conflict",
  },
  es: {
    title: "Evidencia",
    timeline: "Cronología",
    coverage: "Cobertura",
    whatWeKnow: "Lo que sabemos",
    disputed: "En disputa",
    unknown: "Aún no se sabe",
    sources: "fuentes",
    languages: "idiomas",
    countries: "países",
    corroborated: "Corroborado",
    developing: "En desarrollo",
    singleSource: "Una sola fuente",
    conflicted: "Informes contradictorios",
    reportedBy: "Coincide en",
    numericConflict: "Los informes difieren en una cifra",
    negationConflict: "Los informes se contradicen directamente",
    conflict: "Los informes discrepan",
  },
  ja: {
    title: "根拠",
    timeline: "タイムライン",
    coverage: "報道範囲",
    whatWeKnow: "確認できていること",
    disputed: "食い違い",
    unknown: "まだ不明",
    sources: "情報源",
    languages: "言語",
    countries: "か国",
    corroborated: "複数情報源で一致",
    developing: "確認中",
    singleSource: "単一情報源",
    conflicted: "報道に食い違い",
    reportedBy: "一致している情報源",
    numericConflict: "報道で数値が一致していません",
    negationConflict: "報道内容が直接食い違っています",
    conflict: "報道内容が食い違っています",
  },
  "zh-CN": {
    title: "证据",
    timeline: "时间线",
    coverage: "报道范围",
    whatWeKnow: "目前可确认",
    disputed: "存在争议",
    unknown: "仍不明确",
    sources: "来源",
    languages: "种语言",
    countries: "个国家/地区",
    corroborated: "多源印证",
    developing: "持续确认中",
    singleSource: "单一来源",
    conflicted: "报道存在冲突",
    reportedBy: "一致报道来自",
    numericConflict: "不同报道中的数字不一致",
    negationConflict: "不同报道直接相互矛盾",
    conflict: "不同报道存在冲突",
  },
  "zh-TW": {
    title: "證據",
    timeline: "時間線",
    coverage: "報導範圍",
    whatWeKnow: "目前可確認",
    disputed: "存在爭議",
    unknown: "仍不明確",
    sources: "來源",
    languages: "種語言",
    countries: "個國家/地區",
    corroborated: "多源印證",
    developing: "持續確認中",
    singleSource: "單一來源",
    conflicted: "報導存在衝突",
    reportedBy: "一致報導來自",
    numericConflict: "不同報導中的數字不一致",
    negationConflict: "不同報導直接互相矛盾",
    conflict: "不同報導存在衝突",
  },
} as const;

type EventLens = "evidence" | "timeline" | "coverage";

type CorroboratedClaim = {
  text: string;
  sources: string[];
};

type ConflictCopy = {
  numericConflict: string;
  negationConflict: string;
  conflict: string;
};

function tokenSet(signature: string) {
  return new Set(
    signature
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

function signatureSimilarity(left: string, right: string) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  a.forEach((token) => {
    if (b.has(token)) overlap += 1;
  });
  return overlap / new Set([...a, ...b]).size;
}

function buildCorroboratedClaims(
  assessment: EventAssessment | null | undefined,
): CorroboratedClaim[] {
  const observations = assessment?.claim_observations ?? [];
  const contradictions = assessment?.contradictions ?? [];
  const disputedClaims = new Set(
    contradictions.flatMap((item) =>
      (item.observations ?? []).map((observation) => observation.claim_id),
    ),
  );

  const groups: EventClaimObservation[][] = [];
  observations
    .filter(
      (observation) =>
        observation.text &&
        observation.signature &&
        !disputedClaims.has(observation.claim_id),
    )
    .forEach((observation) => {
      const group = groups.find((candidate) =>
        candidate.some(
          (member) =>
            signatureSimilarity(member.signature, observation.signature) >= 0.5,
        ),
      );
      if (group) group.push(observation);
      else groups.push([observation]);
    });

  return groups
    .map((members) => {
      const sources = Array.from(
        new Set(members.map((member) => member.source).filter(Boolean)),
      );
      const representative = [...members].sort(
        (a, b) => a.text.length - b.text.length,
      )[0];
      return {
        text: representative?.text ?? "",
        sources,
      };
    })
    .filter((group) => group.text && group.sources.length >= 2)
    .sort((a, b) => b.sources.length - a.sources.length)
    .slice(0, 3);
}

function contradictionReason(
  item: EventContradictionCandidate,
  text: ConflictCopy,
) {
  if (item.reason === "numeric_conflict") return text.numericConflict;
  if (item.reason === "negation_conflict") return text.negationConflict;
  return text.conflict;
}

export function EventEvidencePanel({
  eventId,
  uncertainties = [],
}: {
  eventId: string;
  uncertainties?: string[];
}) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const text = copy[language] ?? copy.en;
  const [intelligence, setIntelligence] = useState<EventIntelligence | null>(null);
  const [failed, setFailed] = useState(false);
  const [activeLens, setActiveLens] = useState<EventLens>("evidence");

  useEffect(() => {
    let active = true;
    setFailed(false);
    setIntelligence(null);
    setActiveLens("evidence");

    void getEventIntelligence(eventId, 100)
      .then((result) => {
        if (active) setIntelligence(result);
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          setActiveLens("timeline");
        }
      });

    return () => {
      active = false;
    };
  }, [eventId]);

  const assessment = intelligence?.assessment;
  const corroborated = useMemo(
    () => buildCorroboratedClaims(assessment),
    [assessment],
  );
  const contradictions = (assessment?.contradictions ?? []).slice(0, 3);
  const unknowns = uncertainties.filter(Boolean).slice(0, 4);
  const evidence = useMemo(
    () => (intelligence?.evidence ?? []).filter((item) => !item.is_duplicate),
    [intelligence?.evidence],
  );
  const evidenceStats = useMemo(() => {
    const sources = new Set(
      evidence.map((item) => String(item.source || "").trim()).filter(Boolean),
    ).size;
    const languages = new Set(
      evidence.map((item) => String(item.source_language || "").trim()).filter(Boolean),
    ).size;
    const countries = new Set(
      evidence.map((item) => String(item.country || "").trim()).filter(Boolean),
    ).size;
    return { sources, languages, countries };
  }, [evidence]);

  if (!intelligence && !failed) return null;

  const sourceCount =
    assessment?.corroboration?.unique_source_count ?? evidenceStats.sources;
  const languageCount =
    assessment?.corroboration?.language_count ?? evidenceStats.languages;
  const countryCount =
    assessment?.corroboration?.country_count ?? evidenceStats.countries;
  const stats = [
    sourceCount ? `${sourceCount} ${text.sources}` : null,
    languageCount ? `${languageCount} ${text.languages}` : null,
    countryCount ? `${countryCount} ${text.countries}` : null,
  ].filter((item): item is string => Boolean(item));

  const stateLabel = assessment
    ? assessment.confidence_state === "corroborated"
      ? text.corroborated
      : assessment.confidence_state === "conflicted"
        ? text.conflicted
        : assessment.confidence_state === "single_source"
          ? text.singleSource
          : text.developing
    : null;

  const tabs: Array<{ id: EventLens; label: string; badge?: number }> = [
    {
      id: "evidence",
      label: text.title,
      badge: intelligence ? evidence.length : undefined,
    },
    { id: "timeline", label: text.timeline },
    {
      id: "coverage",
      label: text.coverage,
      badge: evidenceStats.countries || undefined,
    },
  ];

  return (
    <View style={styles.lenses}>
      <View
        style={[
          styles.tabBar,
          { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
        ]}
      >
        {tabs.map((tab) => {
          const selected = activeLens === tab.id;
          const disabled = tab.id !== "timeline" && !intelligence;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => setActiveLens(tab.id)}
              style={({ pressed }) => [
                styles.tab,
                selected && [
                  styles.tabSelected,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ],
                pressed && !disabled && styles.tabPressed,
                disabled && styles.tabDisabled,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.tabLabel,
                  { color: selected ? colors.text : colors.textMuted },
                ]}
              >
                {tab.label}
              </Text>
              {!!tab.badge && (
                <Text style={[styles.tabBadge, { color: colors.accent }]}>
                  {tab.badge}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {activeLens === "evidence" && intelligence && (
        <View
          style={[
            styles.container,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]}>{text.title}</Text>
            {!!stateLabel && (
              <Text style={[styles.state, { color: colors.accent }]}>{stateLabel}</Text>
            )}
          </View>
          {!!stats.length && (
            <Text style={[styles.stats, { color: colors.textMuted }]}>
              {stats.join(" · ")}
            </Text>
          )}

          {!!corroborated.length && (
            <EvidenceSection title={text.whatWeKnow} colors={colors}>
              {corroborated.map((claim, index) => (
                <View key={`${claim.text}-${index}`} style={styles.claimRow}>
                  <Text style={[styles.marker, { color: colors.accent }]}>✓</Text>
                  <View style={styles.claimCopy}>
                    <Text style={[styles.claimText, { color: colors.text }]}>
                      {claim.text}
                    </Text>
                    <Text style={[styles.claimMeta, { color: colors.textMuted }]}>
                      {text.reportedBy} {claim.sources.join(" · ")}
                    </Text>
                  </View>
                </View>
              ))}
            </EvidenceSection>
          )}

          {!!contradictions.length && (
            <EvidenceSection title={text.disputed} colors={colors}>
              {contradictions.map((item) => (
                <View key={item.contradiction_id} style={styles.conflictCard}>
                  <View style={styles.claimRow}>
                    <Text style={[styles.marker, { color: colors.error }]}>!</Text>
                    <Text style={[styles.conflictReason, { color: colors.text }]}>
                      {contradictionReason(item, text)}
                    </Text>
                  </View>
                  {(item.observations ?? []).slice(0, 2).map((observation) => (
                    <View key={observation.claim_id} style={styles.observation}>
                      <Text style={[styles.observationSource, { color: colors.accent }]}>
                        {observation.source}
                      </Text>
                      <Text style={[styles.observationText, { color: colors.textMuted }]}>
                        {observation.text}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </EvidenceSection>
          )}

          {!!unknowns.length && (
            <EvidenceSection title={text.unknown} colors={colors}>
              {unknowns.map((item, index) => (
                <View key={`${item}-${index}`} style={styles.claimRow}>
                  <Text style={[styles.marker, { color: colors.textMuted }]}>?</Text>
                  <Text style={[styles.unknownText, { color: colors.textMuted }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </EvidenceSection>
          )}
        </View>
      )}

      {activeLens === "timeline" && <EventEvolutionPanel eventId={eventId} />}
      {activeLens === "coverage" && intelligence && (
        <EventCoveragePanel intelligence={intelligence} />
      )}
    </View>
  );
}

function EvidenceSection({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useBrieflyTheme>["colors"];
  children: ReactNode;
}) {
  return (
    <View style={[styles.section, { borderTopColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  lenses: {
    marginTop: 24,
  },
  tabBar: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  tabSelected: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabPressed: {
    opacity: 0.72,
  },
  tabDisabled: {
    opacity: 0.4,
  },
  tabLabel: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  tabBadge: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "900",
  },
  container: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  },
  title: {
    fontSize: 23,
    fontWeight: "900",
  },
  state: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    textAlign: "right",
    flexShrink: 1,
  },
  stats: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
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
  sectionBody: {
    marginTop: 12,
    gap: 14,
  },
  claimRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  marker: {
    width: 18,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  claimCopy: {
    flex: 1,
    gap: 4,
  },
  claimText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
  },
  claimMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  conflictCard: {
    gap: 10,
  },
  conflictReason: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
  },
  observation: {
    marginLeft: 28,
    gap: 3,
  },
  observationSource: {
    fontSize: 12,
    fontWeight: "800",
  },
  observationText: {
    fontSize: 14,
    lineHeight: 21,
  },
  unknownText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
  },
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { getEventTimeline, type EventTimelineSnapshot } from "@/api/event-evolution";
import {
  getEventIntelligence,
  type EventDevelopment,
  type EventIntelligence,
} from "@/api/event-intelligence";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

const STORAGE_PREFIX = "briefly.event-evolution.last-seen.v1";

const copy = {
  en: {
    title: "Evolution",
    subtitle: "How this event has changed",
    sinceLastVisit: "Since your last visit",
    changes: "meaningful changes",
    timeline: "Event timeline",
    latest: "Latest",
    updated: "Timeline updated",
    newReports: "new reports",
    newSources: "new sources",
    newLanguages: "new languages",
    headlineShift: "The event headline changed materially",
    meaningfulUpdate: "Meaningful event update",
  },
  es: {
    title: "Evolución",
    subtitle: "Cómo ha cambiado este evento",
    sinceLastVisit: "Desde tu última visita",
    changes: "cambios relevantes",
    timeline: "Cronología del evento",
    latest: "Último",
    updated: "Cronología actualizada",
    newReports: "nuevos reportes",
    newSources: "nuevas fuentes",
    newLanguages: "nuevos idiomas",
    headlineShift: "El titular del evento cambió de forma relevante",
    meaningfulUpdate: "Actualización relevante del evento",
  },
  ja: {
    title: "変化",
    subtitle: "この出来事がどう変わったか",
    sinceLastVisit: "前回以降",
    changes: "件の重要な更新",
    timeline: "出来事のタイムライン",
    latest: "最新",
    updated: "タイムライン更新",
    newReports: "件の新しい報道",
    newSources: "件の新しい情報源",
    newLanguages: "件の新しい言語",
    headlineShift: "出来事の見出しが大きく変化",
    meaningfulUpdate: "重要な更新",
  },
  "zh-CN": {
    title: "进展",
    subtitle: "这一事件发生了哪些变化",
    sinceLastVisit: "自你上次查看后",
    changes: "项重要变化",
    timeline: "事件时间线",
    latest: "最新",
    updated: "时间线更新于",
    newReports: "条新报道",
    newSources: "个新来源",
    newLanguages: "种新增语言",
    headlineShift: "事件标题发生明显变化",
    meaningfulUpdate: "重要事件更新",
  },
  "zh-TW": {
    title: "進展",
    subtitle: "這一事件發生了哪些變化",
    sinceLastVisit: "自你上次查看後",
    changes: "項重要變化",
    timeline: "事件時間線",
    latest: "最新",
    updated: "時間線更新於",
    newReports: "則新報導",
    newSources: "個新來源",
    newLanguages: "種新增語言",
    headlineShift: "事件標題發生明顯變化",
    meaningfulUpdate: "重要事件更新",
  },
} as const;

function parseTime(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(value: string | null | undefined, language: string) {
  const time = parseTime(value);
  if (!time) return null;
  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(time));
}

function developmentDetails(
  development: EventDevelopment,
  text: (typeof copy)["en"],
) {
  const details: string[] = [];
  if (development.new_evidence_count > 0) {
    details.push(`${development.new_evidence_count} ${text.newReports}`);
  }
  if (development.new_unique_source_count > 0) {
    details.push(`${development.new_unique_source_count} ${text.newSources}`);
  }
  if ((development.new_languages ?? []).length > 0) {
    details.push(`${development.new_languages.length} ${text.newLanguages}`);
  }
  if (development.headline_shift) details.push(text.headlineShift);
  return details;
}

export function EventEvolutionPanel({ eventId }: { eventId: string }) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const text = copy[language] ?? copy.en;
  const [timeline, setTimeline] = useState<EventTimelineSnapshot | null>(null);
  const [intelligence, setIntelligence] = useState<EventIntelligence | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const storageKey = `${STORAGE_PREFIX}:${eventId}`;

    const load = async () => {
      const [timelineResult, intelligenceResult, storedResult] = await Promise.allSettled([
        getEventTimeline(eventId),
        getEventIntelligence(eventId, 10),
        AsyncStorage.getItem(storageKey),
      ]);

      if (!active) return;

      const nextTimeline =
        timelineResult.status === "fulfilled" ? timelineResult.value : null;
      const nextIntelligence =
        intelligenceResult.status === "fulfilled" ? intelligenceResult.value : null;
      const stored = storedResult.status === "fulfilled" ? storedResult.value : null;
      const storedTime = stored ? Number(stored) : 0;

      setTimeline(nextTimeline);
      setIntelligence(nextIntelligence);
      setLastSeenAt(Number.isFinite(storedTime) && storedTime > 0 ? storedTime : null);
      setLoaded(true);

      const developmentTimes = (nextIntelligence?.developments ?? [])
        .map((item) => parseTime(item.observed_at))
        .filter((value) => value > 0);
      const latestObservedAt = Math.max(
        0,
        ...developmentTimes,
        parseTime(nextTimeline?.timeline_updated_at),
        parseTime(nextIntelligence?.last_updated_at),
      );
      const marker = latestObservedAt || Date.now();
      void AsyncStorage.setItem(storageKey, String(marker)).catch(() => null);
    };

    void load();
    return () => {
      active = false;
    };
  }, [eventId]);

  const meaningful = useMemo(
    () =>
      (intelligence?.developments ?? [])
        .filter((item) => item.is_meaningful_update)
        .sort((a, b) => parseTime(b.observed_at) - parseTime(a.observed_at)),
    [intelligence],
  );

  const unseen = useMemo(() => {
    if (!lastSeenAt) return [];
    return meaningful.filter((item) => parseTime(item.observed_at) > lastSeenAt);
  }, [lastSeenAt, meaningful]);

  const timelineItems = useMemo(() => {
    const occurred = [
      ...(timeline?.background ?? []),
      ...(timeline?.timeline ?? []),
    ];
    return occurred.slice(-5);
  }, [timeline]);

  if (!loaded || (!timelineItems.length && !meaningful.length)) return null;

  const timelineUpdatedAt = formatDate(timeline?.timeline_updated_at, language);
  const visibleChanges = unseen.slice(0, 3);

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
      </View>

      {!!unseen.length && (
        <View style={[styles.changeCallout, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.changeCount, { color: colors.accent }]}>
            {text.sinceLastVisit}: {unseen.length} {text.changes}
          </Text>
          <View style={styles.changeList}>
            {visibleChanges.map((development) => {
              const details = developmentDetails(development, text);
              const observedAt = formatDate(development.observed_at, language);
              return (
                <View key={development.development_id} style={styles.changeItem}>
                  <Text style={[styles.changeTitle, { color: colors.text }]}>
                    {development.representative_title || text.meaningfulUpdate}
                  </Text>
                  {!!details.length && (
                    <Text style={[styles.changeMeta, { color: colors.textMuted }]}>
                      {details.join(" · ")}
                    </Text>
                  )}
                  {!!observedAt && (
                    <Text style={[styles.changeTime, { color: colors.textMuted }]}>
                      {observedAt}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {!!timelineItems.length && (
        <View style={[styles.timelineSection, { borderTopColor: colors.border }]}>
          <View style={styles.timelineHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {text.timeline}
            </Text>
            {!!timelineUpdatedAt && (
              <Text style={[styles.updated, { color: colors.textMuted }]}>
                {text.updated} {timelineUpdatedAt}
              </Text>
            )}
          </View>

          <View style={styles.timelineList}>
            {timelineItems.map((item, index) => {
              const latest = index === timelineItems.length - 1;
              return (
                <View key={item.id || `${item.time}-${index}`} style={styles.timelineRow}>
                  <View style={styles.rail}>
                    <View
                      style={[
                        styles.dot,
                        {
                          borderColor: latest ? colors.accent : colors.textMuted,
                          backgroundColor: latest ? colors.accent : colors.surface,
                        },
                      ]}
                    />
                    {index < timelineItems.length - 1 && (
                      <View style={[styles.line, { backgroundColor: colors.border }]} />
                    )}
                  </View>
                  <View style={styles.timelineCopy}>
                    <View style={styles.timeRow}>
                      {!!item.time && (
                        <Text style={[styles.time, { color: colors.textMuted }]}>
                          {item.time}
                        </Text>
                      )}
                      {latest && (
                        <Text style={[styles.latest, { color: colors.accent }]}>
                          {text.latest}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.timelineTitle, { color: colors.text }]}>
                      {item.title}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
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
  changeCallout: {
    marginTop: 18,
    padding: 16,
    borderRadius: 14,
    gap: 12,
  },
  changeCount: {
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  changeList: {
    gap: 14,
  },
  changeItem: {
    gap: 3,
  },
  changeTitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
  },
  changeMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  changeTime: {
    fontSize: 11,
    lineHeight: 17,
  },
  timelineSection: {
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  timelineHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  updated: {
    fontSize: 11,
    lineHeight: 17,
  },
  timelineList: {
    marginTop: 14,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
  },
  rail: {
    width: 16,
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    marginTop: 5,
  },
  line: {
    width: 1,
    flex: 1,
    marginVertical: 4,
  },
  timelineCopy: {
    flex: 1,
    paddingBottom: 16,
    gap: 4,
  },
  timeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  time: {
    fontSize: 12,
    fontWeight: "700",
  },
  latest: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  timelineTitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
});

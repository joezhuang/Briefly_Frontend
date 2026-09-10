import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { requestStaleStoryRefresh } from "@/api/briefly";
import { getBrieflyAccessToken } from "@/auth/session";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

const API_BASE_URL = process.env.EXPO_PUBLIC_BRIEFLY_API_URL?.replace(/\/$/, "");

export type EventTimelineItem = {
  id: string;
  time: string | null;
  title: string;
};

type TimelineResponse = {
  event_id: string;
  background?: EventTimelineItem[];
  timeline: EventTimelineItem[];
  upcoming?: EventTimelineItem[];
  count: number;
  synthesis_version: number | null;
  timeline_updated_at?: string | null;
};

const copy = {
  en: {
    button: "How this story developed",
    title: "How this story developed",
    latest: "Latest",
    latestBriefly: "Latest in Briefly",
    background: "Background",
    currentSection: "How this story developed",
    upcoming: "What’s next",
    count: "items",
    live: "Latest stored Briefly timeline",
    current: "View latest Briefly version",
    updated: "Updated",
    refresh: "Generate latest Briefly version",
    refreshing: "Updating story…",
    upgrade: "Upgrade to update this story",
    close: "Close",
  },
  es: {
    button: "Cómo evolucionó esta historia",
    title: "Cómo evolucionó esta historia",
    latest: "Último",
    latestBriefly: "Último en Briefly",
    background: "Antecedentes",
    currentSection: "Cómo evolucionó esta historia",
    upcoming: "Qué sigue",
    count: "elementos",
    live: "Última cronología guardada en Briefly",
    current: "Ver la última versión de Briefly",
    updated: "Actualizado",
    refresh: "Generar la última versión de Briefly",
    refreshing: "Actualizando la historia…",
    upgrade: "Mejorar para actualizar esta historia",
    close: "Cerrar",
  },
  ja: {
    button: "このニュースの経緯",
    title: "このニュースの経緯",
    latest: "最新",
    latestBriefly: "Briefly内の最新",
    background: "背景",
    currentSection: "このニュースの経緯",
    upcoming: "今後の予定",
    count: "件",
    live: "Brieflyに保存された最新の経緯",
    current: "Brieflyの最新記事を見る",
    updated: "更新",
    refresh: "Brieflyの最新記事を生成",
    refreshing: "記事を更新中…",
    upgrade: "Proでこの記事を更新",
    close: "閉じる",
  },
  "zh-CN": {
    button: "事件如何发展",
    title: "事件如何发展",
    latest: "最新",
    latestBriefly: "Briefly 中的最新进展",
    background: "背景",
    currentSection: "事件如何发展",
    upcoming: "接下来",
    count: "项",
    live: "Briefly 已保存的最新时间线",
    current: "查看 Briefly 最新版本",
    updated: "更新时间",
    refresh: "生成 Briefly 最新版本",
    refreshing: "正在更新报道…",
    upgrade: "升级 Pro 以更新这篇报道",
    close: "关闭",
  },
  "zh-TW": {
    button: "事件如何發展",
    title: "事件如何發展",
    latest: "最新",
    latestBriefly: "Briefly 中的最新進展",
    background: "背景",
    currentSection: "事件如何發展",
    upcoming: "接下來",
    count: "項",
    live: "Briefly 已儲存的最新時間線",
    current: "查看 Briefly 最新版本",
    updated: "更新時間",
    refresh: "產生 Briefly 最新版本",
    refreshing: "正在更新報導…",
    upgrade: "升級 Pro 以更新這篇報導",
    close: "關閉",
  },
} as const;

function formatUpdatedAt(value: string | null, language: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function TimelineSection({
  title,
  items,
  colors,
  latestLabel,
  currentLinkLabel,
  liveStoryHref,
  onOpenLiveStory,
  upcoming = false,
}: {
  title: string;
  items: EventTimelineItem[];
  colors: ReturnType<typeof useBrieflyTheme>["colors"];
  latestLabel?: string;
  currentLinkLabel?: string;
  liveStoryHref?: string;
  onOpenLiveStory?: () => void;
  upcoming?: boolean;
}) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {items.map((item, index) => {
        const latest = !upcoming && !!latestLabel && index === items.length - 1;
        const actionable = latest && !!liveStoryHref && !!onOpenLiveStory;
        const content = (
          <>
            <View style={styles.timeRow}>
              {!!item.time && (
                <Text style={[styles.time, { color: colors.textMuted }]}>
                  {item.time}
                </Text>
              )}
              {latest && (
                <Text style={[styles.latest, { color: colors.accent }]}>
                  {latestLabel}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.itemTitle,
                { color: upcoming ? colors.textMuted : colors.text },
              ]}
            >
              {item.title}
            </Text>
            {actionable && !!currentLinkLabel && (
              <Text style={[styles.currentLink, { color: colors.accent }]}>
                {currentLinkLabel} →
              </Text>
            )}
          </>
        );

        return (
          <View key={item.id || `${title}-${index}`} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: latest ? colors.accent : colors.surface,
                    borderColor: latest ? colors.accent : colors.textMuted,
                  },
                ]}
              />
              {index < items.length - 1 && (
                <View style={[styles.line, { backgroundColor: colors.border }]} />
              )}
            </View>
            {actionable ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={currentLinkLabel}
                onPress={onOpenLiveStory}
                style={({ pressed }) => [
                  styles.itemCopy,
                  styles.actionableItem,
                  { borderColor: colors.border },
                  pressed && styles.itemPressed,
                ]}
              >
                {content}
              </Pressable>
            ) : (
              <View style={styles.itemCopy}>{content}</View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function EventTimeline({
  eventId,
  liveContext = false,
  liveStoryHref,
  canonicalStale = false,
  pro = false,
  returnTo = "/",
  onRefreshStarted,
}: {
  eventId: string;
  liveContext?: boolean;
  liveStoryHref?: string;
  canonicalStale?: boolean;
  pro?: boolean;
  returnTo?: string;
  onRefreshStarted?: () => void;
}) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const labels = copy[language] ?? copy.en;
  const [backgroundItems, setBackgroundItems] = useState<EventTimelineItem[]>([]);
  const [items, setItems] = useState<EventTimelineItem[]>([]);
  const [upcomingItems, setUpcomingItems] = useState<EventTimelineItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!API_BASE_URL) {
        if (active) setLoading(false);
        return;
      }

      try {
        const headers: Record<string, string> = {};
        const token = getBrieflyAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(
          `${API_BASE_URL}/api/events/${encodeURIComponent(eventId)}/timeline`,
          { headers },
        );
        if (!response.ok) throw new Error(`Timeline request failed: ${response.status}`);
        const payload = (await response.json()) as TimelineResponse;
        if (active) {
          setBackgroundItems(
            Array.isArray(payload.background) ? payload.background : [],
          );
          setItems(Array.isArray(payload.timeline) ? payload.timeline : []);
          setUpcomingItems(
            Array.isArray(payload.upcoming) ? payload.upcoming : [],
          );
          setUpdatedAt(payload.timeline_updated_at ?? null);
        }
      } catch {
        if (active) {
          setBackgroundItems([]);
          setItems([]);
          setUpcomingItems([]);
          setUpdatedAt(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [eventId]);

  const openLiveStory = () => {
    if (!liveStoryHref) return;
    setOpen(false);
    router.push(liveStoryHref as never);
  };

  const refreshStory = async () => {
    if (!canonicalStale || refreshing) return;
    if (!pro) {
      setOpen(false);
      router.push(
        `/upgrade?returnTo=${encodeURIComponent(returnTo)}` as never,
      );
      return;
    }

    setRefreshing(true);
    try {
      const result = await requestStaleStoryRefresh(eventId, {
        includeDraft: process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true",
      });
      if (result.status === "processing") {
        setOpen(false);
        onRefreshStarted?.();
      }
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  const totalItems =
    backgroundItems.length + items.length + upcomingItems.length;
  if (totalItems < 2) return null;

  const formattedUpdatedAt = formatUpdatedAt(updatedAt, language);

  return (
    <>
      <View style={[styles.triggerWrap, { backgroundColor: colors.surface }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.trigger,
            {
              borderColor: colors.border,
              backgroundColor: colors.surfaceMuted,
              opacity: pressed ? 0.72 : 1,
            },
          ]}
        >
          <View style={styles.triggerCopy}>
            <Text style={[styles.triggerTitle, { color: colors.text }]}>
              {labels.button}
            </Text>
            <Text style={[styles.triggerMeta, { color: colors.textMuted }]}>
              {liveContext ? `${labels.live} · ` : ""}
              {totalItems} {labels.count}
              {liveContext && formattedUpdatedAt
                ? ` · ${labels.updated} ${formattedUpdatedAt}`
                : ""}
            </Text>
          </View>
          <Text style={[styles.triggerArrow, { color: colors.accent }]}>→</Text>
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeadingCopy}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  {labels.title}
                </Text>
                {liveContext && (
                  <Text style={[styles.sheetMeta, { color: colors.textMuted }]}>
                    {labels.live}
                    {formattedUpdatedAt
                      ? ` · ${labels.updated} ${formattedUpdatedAt}`
                      : ""}
                  </Text>
                )}
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Text style={[styles.close, { color: colors.textMuted }]}>×</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.timeline}>
              {backgroundItems.length > 0 && (
                <TimelineSection
                  title={labels.background}
                  items={backgroundItems}
                  colors={colors}
                />
              )}

              {items.length > 0 && (
                <TimelineSection
                  title={labels.currentSection}
                  items={items}
                  colors={colors}
                  latestLabel={liveContext ? labels.latestBriefly : labels.latest}
                  currentLinkLabel={labels.current}
                  liveStoryHref={liveStoryHref}
                  onOpenLiveStory={openLiveStory}
                />
              )}

              {upcomingItems.length > 0 && (
                <TimelineSection
                  title={labels.upcoming}
                  items={upcomingItems}
                  colors={colors}
                  upcoming
                />
              )}
            </ScrollView>

            {canonicalStale && (
              <Pressable
                disabled={refreshing}
                onPress={() => void refreshStory()}
                style={({ pressed }) => [
                  styles.refreshButton,
                  {
                    backgroundColor: colors.accent,
                    opacity: refreshing || pressed ? 0.7 : 1,
                  },
                ]}
              >
                {refreshing && <ActivityIndicator size="small" color={colors.background} />}
                <Text style={[styles.refreshButtonText, { color: colors.background }]}>
                  {refreshing
                    ? labels.refreshing
                    : pro
                      ? labels.refresh
                      : labels.upgrade}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => setOpen(false)}
              style={[styles.closeButton, { backgroundColor: colors.text }]}
            >
              <Text style={[styles.closeButtonText, { color: colors.background }]}>
                {labels.close}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { alignItems: "center", paddingVertical: 8 },
  triggerWrap: { alignItems: "center", paddingTop: 10, paddingHorizontal: 14 },
  trigger: {
    width: "100%",
    maxWidth: 760,
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  triggerCopy: { flex: 1, gap: 2 },
  triggerTitle: { fontSize: 15, fontWeight: "800" },
  triggerMeta: { fontSize: 12 },
  triggerArrow: { fontSize: 20, fontWeight: "800" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.52)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  sheet: {
    width: "100%",
    maxWidth: 680,
    maxHeight: "84%",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  sheetHeadingCopy: { flex: 1, gap: 3 },
  sheetTitle: { fontSize: 25, fontWeight: "900" },
  sheetMeta: { fontSize: 12, fontWeight: "700" },
  close: { fontSize: 30, lineHeight: 30, paddingLeft: 14 },
  timeline: { paddingBottom: 4, gap: 8 },
  sectionBlock: { marginBottom: 8 },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  row: { flexDirection: "row", minHeight: 78 },
  rail: { width: 28, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 5 },
  line: { width: 1, flex: 1, marginTop: 3 },
  itemCopy: { flex: 1, paddingLeft: 10, paddingBottom: 22, gap: 5 },
  actionableItem: {
    marginLeft: 4,
    padding: 12,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  itemPressed: { opacity: 0.65 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  time: { fontSize: 12, fontWeight: "600" },
  latest: { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7 },
  itemTitle: { fontSize: 17, lineHeight: 24, fontWeight: "700" },
  currentLink: { fontSize: 13, fontWeight: "800", marginTop: 3 },
  refreshButton: {
    alignSelf: "stretch",
    minHeight: 46,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
    marginTop: 10,
  },
  refreshButtonText: { fontSize: 13, fontWeight: "900" },
  closeButton: {
    alignSelf: "flex-end",
    marginTop: 14,
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: { fontSize: 13, fontWeight: "800" },
});

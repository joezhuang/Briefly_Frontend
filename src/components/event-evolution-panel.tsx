import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

import {
  getEventTimeline,
  resetEventTimelineOrder,
  saveEventTimelineOrder,
  type EventTimelineItem,
  type EventTimelineSnapshot,
} from "@/api/event-evolution";
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
    adjustOrder: "Adjust order",
    dragHint: "Drag the handle to reorder background and timeline items.",
    saveOrder: "Save order",
    resetOrder: "Reset automatic order",
    cancelOrder: "Cancel",
    savingOrder: "Saving…",
    manualOrder: "Manual order",
    orderError: "Could not save timeline order. Reload and try again.",
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
    adjustOrder: "Ajustar orden",
    dragHint: "Arrastra el control para reordenar antecedentes y cronología.",
    saveOrder: "Guardar orden",
    resetOrder: "Restablecer orden automático",
    cancelOrder: "Cancelar",
    savingOrder: "Guardando…",
    manualOrder: "Orden manual",
    orderError: "No se pudo guardar el orden. Recarga e inténtalo de nuevo.",
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
    adjustOrder: "順序を調整",
    dragHint: "ハンドルをドラッグして背景とタイムラインを並べ替えます。",
    saveOrder: "順序を保存",
    resetOrder: "自動順序に戻す",
    cancelOrder: "キャンセル",
    savingOrder: "保存中…",
    manualOrder: "手動順序",
    orderError: "順序を保存できませんでした。再読み込みしてもう一度お試しください。",
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
    adjustOrder: "调整顺序",
    dragHint: "拖动手柄重新排列背景和时间线项目。",
    saveOrder: "保存顺序",
    resetOrder: "恢复自动顺序",
    cancelOrder: "取消",
    savingOrder: "正在保存…",
    manualOrder: "手动顺序",
    orderError: "无法保存时间线顺序。请重新加载后重试。",
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
    adjustOrder: "調整順序",
    dragHint: "拖曳把手重新排列背景與時間線項目。",
    saveOrder: "儲存順序",
    resetOrder: "恢復自動順序",
    cancelOrder: "取消",
    savingOrder: "正在儲存…",
    manualOrder: "手動順序",
    orderError: "無法儲存時間線順序。請重新載入後重試。",
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

type DevelopmentCopy = {
  newReports: string;
  newSources: string;
  newLanguages: string;
  headlineShift: string;
};

function developmentDetails(
  development: EventDevelopment,
  text: DevelopmentCopy,
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


const ADMIN_TIMELINE_ROW_HEIGHT = 84;

function moveTimelineItem(
  items: EventTimelineItem[],
  fromIndex: number,
  toIndex: number,
) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return items;
  next.splice(toIndex, 0, moved);
  return next;
}

function AdminTimelineDragRow({
  item,
  index,
  count,
  colors,
  onMove,
}: {
  item: EventTimelineItem;
  index: number;
  count: number;
  colors: ReturnType<typeof useBrieflyTheme>["colors"];
  onMove: (fromIndex: number, toIndex: number) => void;
}) {
  const currentIndexRef = useRef(index);
  const startIndexRef = useRef(index);
  const [dragging, setDragging] = useState(false);
  currentIndexRef.current = index;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {
          startIndexRef.current = currentIndexRef.current;
          setDragging(true);
        },
        onPanResponderMove: (_event, gesture) => {
          const target = Math.max(
            0,
            Math.min(
              count - 1,
              startIndexRef.current +
                Math.round(gesture.dy / ADMIN_TIMELINE_ROW_HEIGHT),
            ),
          );
          if (target === currentIndexRef.current) return;
          onMove(currentIndexRef.current, target);
          currentIndexRef.current = target;
        },
        onPanResponderRelease: () => setDragging(false),
        onPanResponderTerminate: () => setDragging(false),
      }),
    [count, onMove],
  );

  return (
    <View
      style={[
        styles.adminOrderRow,
        {
          borderColor: dragging ? colors.accent : colors.border,
          backgroundColor: colors.surface,
          opacity: dragging ? 0.72 : 1,
        },
      ]}
    >
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Drag to reorder timeline item"
        {...responder.panHandlers}
        style={[styles.dragHandle, { borderColor: colors.border }]}
      >
        <Text style={[styles.dragHandleText, { color: colors.accent }]}>☰</Text>
      </View>
      <View style={styles.adminOrderCopy}>
        {!!item.time && (
          <Text style={[styles.time, { color: colors.textMuted }]}>
            {item.time}
          </Text>
        )}
        <Text
          numberOfLines={2}
          style={[styles.timelineTitle, { color: colors.text }]}
        >
          {item.title}
        </Text>
      </View>
    </View>
  );
}

export function EventEvolutionPanel({
  eventId,
  refreshKey,
  adminTextSelectable = false,
}: {
  eventId: string;
  refreshKey?: string | number | null;
  adminTextSelectable?: boolean;
}) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const text = copy[language] ?? copy.en;
  const [timeline, setTimeline] = useState<EventTimelineSnapshot | null>(null);
  const [intelligence, setIntelligence] = useState<EventIntelligence | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [orderEditing, setOrderEditing] = useState(false);
  const [orderDraft, setOrderDraft] = useState<EventTimelineItem[]>([]);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

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
  }, [eventId, refreshKey]);

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

  const orderedOccurredItems = useMemo(() => {
    if ((timeline?.ordered_timeline ?? []).length > 0) {
      return timeline?.ordered_timeline ?? [];
    }
    return [
      ...(timeline?.background ?? []),
      ...(timeline?.timeline ?? []),
    ];
  }, [timeline]);
  const timelineItems = orderEditing
    ? orderDraft
    : orderedOccurredItems.slice(-5);
  const canEditOrder =
    adminTextSelectable &&
    timeline?.timeline_order_editable === true &&
    orderedOccurredItems.length > 1 &&
    orderedOccurredItems.every((item) => !!item.order_key);

  const beginOrderEdit = () => {
    setOrderDraft([...orderedOccurredItems]);
    setOrderError(null);
    setOrderEditing(true);
  };
  const cancelOrderEdit = () => {
    setOrderDraft([]);
    setOrderError(null);
    setOrderEditing(false);
  };
  const moveOrderItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      setOrderDraft((current) =>
        moveTimelineItem(current, fromIndex, toIndex),
      );
    },
    [],
  );
  const reloadTimeline = async () => {
    const refreshed = await getEventTimeline(eventId);
    setTimeline(refreshed);
    return refreshed;
  };
  const saveOrder = async () => {
    const keys = orderDraft
      .map((item) => item.order_key)
      .filter((key): key is string => !!key);
    if (keys.length !== orderDraft.length) return;
    setOrderSaving(true);
    setOrderError(null);
    try {
      await saveEventTimelineOrder(eventId, keys);
      await reloadTimeline();
      setOrderEditing(false);
      setOrderDraft([]);
    } catch {
      setOrderError(text.orderError);
    } finally {
      setOrderSaving(false);
    }
  };
  const resetOrder = async () => {
    setOrderSaving(true);
    setOrderError(null);
    try {
      await resetEventTimelineOrder(eventId);
      await reloadTimeline();
      setOrderEditing(false);
      setOrderDraft([]);
    } catch {
      setOrderError(text.orderError);
    } finally {
      setOrderSaving(false);
    }
  };

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
        <Text selectable={adminTextSelectable} style={[styles.title, { color: colors.text }]}>{text.title}</Text>
        <Text selectable={adminTextSelectable} style={[styles.subtitle, { color: colors.textMuted }]}>
          {text.subtitle}
        </Text>
      </View>

      {!!unseen.length && (
        <View style={[styles.changeCallout, { backgroundColor: colors.surfaceMuted }]}>
          <Text selectable={adminTextSelectable} style={[styles.changeCount, { color: colors.accent }]}>
            {text.sinceLastVisit}: {unseen.length} {text.changes}
          </Text>
          <View style={styles.changeList}>
            {visibleChanges.map((development) => {
              const details = developmentDetails(development, text);
              const observedAt = formatDate(development.observed_at, language);
              return (
                <View key={development.development_id} style={styles.changeItem}>
                  <Text selectable={adminTextSelectable} style={[styles.changeTitle, { color: colors.text }]}>
                    {development.representative_title || text.meaningfulUpdate}
                  </Text>
                  {!!details.length && (
                    <Text selectable={adminTextSelectable} style={[styles.changeMeta, { color: colors.textMuted }]}>
                      {details.join(" · ")}
                    </Text>
                  )}
                  {!!observedAt && (
                    <Text selectable={adminTextSelectable} style={[styles.changeTime, { color: colors.textMuted }]}>
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
            <View style={styles.timelineHeadingCopy}>
              <Text selectable={adminTextSelectable} style={[styles.sectionTitle, { color: colors.text }]}>
                {text.timeline}
              </Text>
              {!!timelineUpdatedAt && (
                <Text selectable={adminTextSelectable} style={[styles.updated, { color: colors.textMuted }]}>
                  {text.updated} {timelineUpdatedAt}
                  {timeline?.timeline_order_manual ? ` · ${text.manualOrder}` : ""}
                </Text>
              )}
            </View>
            {canEditOrder && !orderEditing && (
              <Pressable
                accessibilityRole="button"
                onPress={beginOrderEdit}
                style={[styles.orderAction, { borderColor: colors.border }]}
              >
                <Text style={[styles.orderActionText, { color: colors.accent }]}>
                  {text.adjustOrder}
                </Text>
              </Pressable>
            )}
          </View>

          {orderEditing && (
            <View style={[styles.adminOrderPanel, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.adminOrderHint, { color: colors.textMuted }]}>
                {text.dragHint}
              </Text>
              <View style={styles.adminOrderList}>
                {orderDraft.map((item, index) => (
                  <AdminTimelineDragRow
                    key={item.order_key || item.id}
                    item={item}
                    index={index}
                    count={orderDraft.length}
                    colors={colors}
                    onMove={moveOrderItem}
                  />
                ))}
              </View>
              {!!orderError && (
                <Text style={[styles.adminOrderError, { color: colors.error }]}>
                  {orderError}
                </Text>
              )}
              <View style={styles.adminOrderActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={orderSaving}
                  onPress={() => void saveOrder()}
                  style={[styles.orderPrimaryAction, { backgroundColor: colors.accent }, orderSaving && styles.orderDisabled]}
                >
                  <Text style={[styles.orderPrimaryText, { color: colors.background }]}>
                    {orderSaving ? text.savingOrder : text.saveOrder}
                  </Text>
                </Pressable>
                {timeline?.timeline_order_manual && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={orderSaving}
                    onPress={() => void resetOrder()}
                    style={[styles.orderAction, { borderColor: colors.border }, orderSaving && styles.orderDisabled]}
                  >
                    <Text style={[styles.orderActionText, { color: colors.text }]}>
                      {text.resetOrder}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  disabled={orderSaving}
                  onPress={cancelOrderEdit}
                  style={[styles.orderAction, { borderColor: colors.border }, orderSaving && styles.orderDisabled]}
                >
                  <Text style={[styles.orderActionText, { color: colors.textMuted }]}>
                    {text.cancelOrder}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {!orderEditing && <View style={styles.timelineList}>
            {timelineItems.map((item, index) => {
              const latest = index === timelineItems.length - 1;
              return (
                <View key={item.order_key || item.id || `${item.time}-${index}`} style={styles.timelineRow}>
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
                        <Text selectable={adminTextSelectable} style={[styles.time, { color: colors.textMuted }]}>
                          {item.time}
                        </Text>
                      )}
                      {latest && (
                        <Text style={[styles.latest, { color: colors.accent }]}>
                          {text.latest}
                        </Text>
                      )}
                    </View>
                    <Text selectable={adminTextSelectable} style={[styles.timelineTitle, { color: colors.text }]}>
                      {item.title}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>}
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
  timelineHeadingCopy: { flex: 1, minWidth: 0, gap: 3 },
  orderAction: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  orderActionText: { fontSize: 12, fontWeight: "900" },
  orderPrimaryAction: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  orderPrimaryText: { fontSize: 12, fontWeight: "900" },
  orderDisabled: { opacity: 0.55 },
  adminOrderPanel: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    gap: 10,
  },
  adminOrderHint: { fontSize: 12, lineHeight: 18 },
  adminOrderList: { gap: 8 },
  adminOrderRow: {
    minHeight: ADMIN_TIMELINE_ROW_HEIGHT,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dragHandle: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandleText: { fontSize: 22, fontWeight: "900" },
  adminOrderCopy: { flex: 1, minWidth: 0, gap: 3 },
  adminOrderActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  adminOrderError: { fontSize: 12, lineHeight: 18, fontWeight: "700" },
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

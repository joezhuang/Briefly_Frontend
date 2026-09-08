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
  timeline: EventTimelineItem[];
  count: number;
  synthesis_version: number | null;
};

const copy = {
  en: {
    button: "How this story developed",
    title: "How this story developed",
    latest: "Latest",
    close: "Close",
  },
  es: {
    button: "Cómo evolucionó esta historia",
    title: "Cómo evolucionó esta historia",
    latest: "Último",
    close: "Cerrar",
  },
  ja: {
    button: "このニュースの経緯",
    title: "このニュースの経緯",
    latest: "最新",
    close: "閉じる",
  },
  "zh-CN": {
    button: "事件如何发展",
    title: "事件如何发展",
    latest: "最新",
    close: "关闭",
  },
  "zh-TW": {
    button: "事件如何發展",
    title: "事件如何發展",
    latest: "最新",
    close: "關閉",
  },
} as const;

export function EventTimeline({ eventId }: { eventId: string }) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const labels = copy[language] ?? copy.en;
  const [items, setItems] = useState<EventTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

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
        if (active) setItems(Array.isArray(payload.timeline) ? payload.timeline : []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [eventId]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  if (items.length < 2) return null;

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
              {items.length} developments
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
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {labels.title}
              </Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Text style={[styles.close, { color: colors.textMuted }]}>×</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.timeline}>
              {items.map((item, index) => {
                const latest = index === items.length - 1;
                return (
                  <View key={item.id || `${index}`} style={styles.row}>
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
                    <View style={styles.itemCopy}>
                      <View style={styles.timeRow}>
                        {!!item.time && (
                          <Text style={[styles.time, { color: colors.textMuted }]}>
                            {item.time}
                          </Text>
                        )}
                        {latest && (
                          <Text style={[styles.latest, { color: colors.accent }]}>
                            {labels.latest}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>
                        {item.title}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

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
  triggerTitle: { fontSize: 15, fontWeight: "850" },
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
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  sheetTitle: { fontSize: 25, fontWeight: "900", flex: 1 },
  close: { fontSize: 30, lineHeight: 30, paddingLeft: 14 },
  timeline: { paddingBottom: 4 },
  row: { flexDirection: "row", minHeight: 78 },
  rail: { width: 28, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 5 },
  line: { width: 1, flex: 1, marginTop: 3 },
  itemCopy: { flex: 1, paddingLeft: 10, paddingBottom: 22, gap: 5 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  time: { fontSize: 12, fontWeight: "650" },
  latest: { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7 },
  itemTitle: { fontSize: 17, lineHeight: 24, fontWeight: "700" },
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

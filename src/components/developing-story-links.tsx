import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  getEventIntelligence,
  type DevelopingStoryMember,
} from "@/api/event-intelligence";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

const copy = {
  en: { heading: "Developing story", detail: "Related developments", open: "Read development" },
  es: { heading: "Noticia en desarrollo", detail: "Otros acontecimientos", open: "Leer actualización" },
  ja: { heading: "続報のあるニュース", detail: "関連する動き", open: "記事を読む" },
  "zh-CN": { heading: "持续发展的新闻", detail: "相关进展", open: "阅读进展" },
  "zh-TW": { heading: "持續發展的新聞", detail: "相關進展", open: "閱讀進展" },
} as const;

export function DevelopingStoryLinks({
  eventId,
  members,
}: {
  eventId: string;
  members?: DevelopingStoryMember[];
}) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const labels = copy[language] ?? copy.en;
  const [fetched, setFetched] = useState<DevelopingStoryMember[]>([]);

  useEffect(() => {
    if (members !== undefined) return;
    let active = true;
    getEventIntelligence(eventId, 1)
      .then((value) => {
        if (active) setFetched(value.story_members ?? []);
      })
      .catch(() => {
        if (active) setFetched([]);
      });
    return () => { active = false; };
  }, [eventId, members]);

  const available = members ?? fetched;
  const others = available
    .filter((item) => item.event_id !== eventId)
    .slice(0, 10);
  if (!others.length) return null;

  return (
    <View style={[styles.root, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
      <Text style={[styles.heading, { color: colors.text }]}>
        {labels.heading} · {available.length}
      </Text>
      <Text style={[styles.detail, { color: colors.textMuted }]}>
        {labels.detail}
      </Text>
      {others.map((item) => (
        <Pressable
          key={item.event_id}
          accessibilityRole="link"
          accessibilityLabel={`${labels.open}: ${item.headline}`}
          onPress={() => {
            const id = encodeURIComponent(item.event_id);
            router.push(`/story/event-${id}?eventId=${id}&source=story` as never);
          }}
          style={[styles.item, { borderTopColor: colors.border }]}
        >
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>
            {item.headline}
          </Text>
          <Text style={[styles.arrow, { color: colors.accent }]}>→</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 24,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    gap: 8,
  },
  heading: { fontSize: 16, fontWeight: "800" },
  detail: { fontSize: 12, lineHeight: 18 },
  item: {
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  arrow: { fontSize: 18, fontWeight: "700" },
});

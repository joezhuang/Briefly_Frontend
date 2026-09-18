import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  acknowledgeEventUpdate,
  getFollowedEvents,
  getMeaningfulEventUpdates,
  type FollowedEvent,
  type MeaningfulEventUpdate,
} from "@/api/event-follow";
import { trackProductEvent } from "@/analytics/product-analytics";
import { AppHeader } from "@/components/app-header";
import { ScreenState } from "@/components/screen-state";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import { layout } from "@/theme/tokens";

const copy = {
  en: {
    title: "Following",
    subtitle: "Track events as they evolve. Briefly only surfaces meaningful changes here.",
    updates: "Meaningful updates",
    events: "Followed events",
    noUpdates: "No new meaningful updates.",
    empty: "You are not following any events yet.",
    emptyBody: "Open a story and choose Follow event to track what changes next.",
    sources: "sources",
    newEvidence: "new evidence",
    newSources: "new sources",
    loading: "Loading followed events…",
    unavailable: "Following is temporarily unavailable.",
  },
  es: {
    title: "Siguiendo",
    subtitle: "Sigue los eventos a medida que evolucionan. Briefly solo muestra aquí cambios significativos.",
    updates: "Actualizaciones importantes",
    events: "Eventos seguidos",
    noUpdates: "No hay nuevas actualizaciones importantes.",
    empty: "Aún no sigues ningún evento.",
    emptyBody: "Abre una historia y elige Seguir evento para seguir sus próximos cambios.",
    sources: "fuentes",
    newEvidence: "nuevas evidencias",
    newSources: "nuevas fuentes",
    loading: "Cargando eventos seguidos…",
    unavailable: "La función de seguimiento no está disponible temporalmente.",
  },
  ja: {
    title: "フォロー中",
    subtitle: "出来事の変化を追跡します。ここには重要な更新だけが表示されます。",
    updates: "重要な更新",
    events: "フォロー中のイベント",
    noUpdates: "新しい重要な更新はありません。",
    empty: "まだイベントをフォローしていません。",
    emptyBody: "記事を開き、「イベントをフォロー」を選ぶと今後の変化を追跡できます。",
    sources: "情報源",
    newEvidence: "件の新しい証拠",
    newSources: "件の新しい情報源",
    loading: "フォロー中のイベントを読み込み中…",
    unavailable: "フォロー機能を一時的に利用できません。",
  },
  "zh-CN": {
    title: "关注",
    subtitle: "跟踪事件如何演变。这里只显示有意义的重要变化。",
    updates: "重要更新",
    events: "已关注事件",
    noUpdates: "暂无新的重要更新。",
    empty: "你还没有关注任何事件。",
    emptyBody: "打开一篇报道并选择“关注事件”，即可跟踪后续变化。",
    sources: "来源",
    newEvidence: "条新证据",
    newSources: "个新来源",
    loading: "正在加载已关注事件…",
    unavailable: "关注功能暂时不可用。",
  },
  "zh-TW": {
    title: "關注",
    subtitle: "追蹤事件如何演變。這裡只顯示有意義的重要變化。",
    updates: "重要更新",
    events: "已關注事件",
    noUpdates: "暫無新的重要更新。",
    empty: "你還沒有關注任何事件。",
    emptyBody: "開啟一篇報導並選擇「關注事件」，即可追蹤後續變化。",
    sources: "來源",
    newEvidence: "則新證據",
    newSources: "個新來源",
    loading: "正在載入已關注事件…",
    unavailable: "關注功能暫時無法使用。",
  },
} as const;

function formatDate(value: string | null, language: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function storyHref(eventId: string, source: "following" | "following_update") {
  const params = new URLSearchParams({ eventId, source });
  return `/story/event?${params.toString()}`;
}

export default function FollowingScreen() {
  const { width } = useWindowDimensions();
  const { ready: authReady, user } = useBrieflyAuth();
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const text = copy[language] ?? copy.en;
  const [events, setEvents] = useState<FollowedEvent[]>([]);
  const [updates, setUpdates] = useState<MeaningfulEventUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      router.replace("/sign-in?returnTo=%2Ffollowing" as never);
      return;
    }

    let active = true;

    Promise.all([getFollowedEvents(), getMeaningfulEventUpdates()])
      .then(([followed, meaningful]) => {
        if (!active) return;
        setEvents(followed.events);
        setUpdates(meaningful.updates);
        trackProductEvent("following_view", {
          properties: {
            followed_count: followed.events.length,
            update_count: meaningful.updates.length,
          },
        });
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authReady, user]);

  const openEvent = (
    eventId: string,
    source: "following" | "following_update" = "following",
  ) => {
    router.push(storyHref(eventId, source) as never);
  };

  const openUpdate = (update: MeaningfulEventUpdate) => {
    setUpdates((current) =>
      current.filter((item) => item.development_id !== update.development_id),
    );
    trackProductEvent("event_update_open", {
      eventId: update.event_id,
      properties: {
        update_type: update.update_type,
        new_evidence_count: update.new_evidence_count ?? 0,
        new_unique_source_count: update.new_unique_source_count ?? 0,
      },
    });
    void acknowledgeEventUpdate(update.event_id, update.development_id).catch(() => null);
    openEvent(update.event_id, "following_update");
  };

  if (!authReady || !user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState loading message={text.loading} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.page, width < 480 && styles.pageCompact]}>
          <AppHeader />

          <View style={styles.intro}>
            <Text style={[styles.title, { color: colors.text }]}>{text.title}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {text.subtitle}
            </Text>
          </View>

          {loading ? (
            <ScreenState loading message={text.loading} />
          ) : error ? (
            <ScreenState title={text.unavailable} />
          ) : events.length === 0 ? (
            <ScreenState title={text.empty} message={text.emptyBody} />
          ) : (
            <>
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {text.updates}
                </Text>
                {updates.length === 0 ? (
                  <Text style={[styles.emptyUpdates, { color: colors.textMuted }]}>
                    {text.noUpdates}
                  </Text>
                ) : (
                  updates.map((update) => {
                    const date = formatDate(update.observed_at, language);
                    const evidence = update.new_evidence_count ?? 0;
                    const sources = update.new_unique_source_count ?? 0;
                    return (
                      <Pressable
                        key={`${update.event_id}-${update.development_id}`}
                        onPress={() => openUpdate(update)}
                        style={({ pressed }) => [
                          styles.card,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.surface,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.updateLabel, { color: colors.accent }]}>
                          {update.update_type || text.updates}
                        </Text>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>
                          {update.representative_title || update.title}
                        </Text>
                        <View style={styles.metaRow}>
                          {evidence > 0 && (
                            <Text style={[styles.meta, { color: colors.textMuted }]}>
                              +{evidence} {text.newEvidence}
                            </Text>
                          )}
                          {sources > 0 && (
                            <Text style={[styles.meta, { color: colors.textMuted }]}>
                              +{sources} {text.newSources}
                            </Text>
                          )}
                          {!!date && (
                            <Text style={[styles.meta, { color: colors.textMuted }]}>
                              {date}
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {text.events}
                </Text>
                {events.map((event) => {
                  const date = formatDate(event.last_updated_at, language);
                  return (
                    <Pressable
                      key={event.event_id}
                      onPress={() => openEvent(event.event_id)}
                      style={({ pressed }) => [
                        styles.card,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        {event.title}
                      </Text>
                      <View style={styles.metaRow}>
                        <Text style={[styles.meta, { color: colors.textMuted }]}>
                          {event.article_count ?? 0} {text.sources}
                        </Text>
                        {!!date && (
                          <Text style={[styles.meta, { color: colors.textMuted }]}>
                            {date}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { alignItems: "center" },
  page: {
    width: "100%",
    maxWidth: layout.pageMax,
    paddingHorizontal: layout.pagePadding,
    paddingBottom: 80,
  },
  pageCompact: { paddingHorizontal: layout.pagePaddingCompact },
  intro: { paddingVertical: 28, gap: 8 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: "900" },
  subtitle: { maxWidth: 760, fontSize: 17, lineHeight: 25 },
  section: { gap: 10, marginBottom: 34 },
  sectionTitle: { fontSize: 22, fontWeight: "900", marginBottom: 4 },
  emptyUpdates: { fontSize: 15, lineHeight: 22, paddingVertical: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16, gap: 8 },
  updateLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  cardTitle: { fontSize: 18, lineHeight: 25, fontWeight: "800" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  meta: { fontSize: 12, fontWeight: "600" },
});

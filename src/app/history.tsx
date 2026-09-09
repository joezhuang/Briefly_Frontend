import { Image } from "expo-image";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { ScreenState } from "@/components/screen-state";
import { useBrieflyLanguage } from "@/context/language";
import { useReadingHistory } from "@/context/reading-history";
import { useBrieflyTheme } from "@/context/theme";
import { layout } from "@/theme/tokens";

const copy = {
  en: {
    title: "Reading history",
    subtitle: "Your 10 most recently opened Briefly stories.",
    empty: "No reading history yet",
    emptyBody: "Stories you open will appear here.",
    clear: "Clear history",
    opened: "Opened",
  },
  es: {
    title: "Historial de lectura",
    subtitle: "Tus 10 historias de Briefly abiertas más recientemente.",
    empty: "Aún no hay historial",
    emptyBody: "Las historias que abras aparecerán aquí.",
    clear: "Borrar historial",
    opened: "Abierto",
  },
  ja: {
    title: "閲覧履歴",
    subtitle: "最近開いたBrieflyの記事10件です。",
    empty: "閲覧履歴はまだありません",
    emptyBody: "開いた記事がここに表示されます。",
    clear: "履歴を消去",
    opened: "閲覧",
  },
  "zh-CN": {
    title: "阅读历史",
    subtitle: "最近打开的 10 篇 Briefly 新闻。",
    empty: "还没有阅读历史",
    emptyBody: "你打开的新闻会显示在这里。",
    clear: "清除历史",
    opened: "打开于",
  },
  "zh-TW": {
    title: "閱讀歷史",
    subtitle: "最近開啟的 10 篇 Briefly 新聞。",
    empty: "還沒有閱讀歷史",
    emptyBody: "你開啟的新聞會顯示在這裡。",
    clear: "清除歷史",
    opened: "開啟於",
  },
} as const;

function formatOpenedAt(value: string, language: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function HistoryScreen() {
  const { width } = useWindowDimensions();
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const { items, ready, clearHistory } = useReadingHistory();
  const labels = copy[language] ?? copy.en;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.page, width < 480 && styles.pageCompact]}>
          <AppHeader />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: colors.text }]}>
                {labels.title}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {labels.subtitle}
              </Text>
            </View>

            {items.length > 0 ? (
              <Pressable
                onPress={() => void clearHistory()}
                style={[styles.clearButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.clearText, { color: colors.textMuted }]}>
                  {labels.clear}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {!ready ? (
            <ScreenState loading message={labels.title} />
          ) : items.length === 0 ? (
            <ScreenState title={labels.empty} message={labels.emptyBody} />
          ) : (
            <View style={styles.list}>
              {items.map((item) => (
                <Pressable
                  key={item.event_id}
                  onPress={() => router.push(item.href as never)}
                  style={[
                    styles.row,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  {item.image_url ? (
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.image}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.image,
                        { backgroundColor: colors.imageFallback },
                      ]}
                    />
                  )}

                  <View style={styles.copy}>
                    <Text
                      style={[styles.headline, { color: colors.text }]}
                      numberOfLines={2}
                    >
                      {item.headline}
                    </Text>
                    {!!item.standfirst && (
                      <Text
                        style={[styles.standfirst, { color: colors.textMuted }]}
                        numberOfLines={2}
                      >
                        {item.standfirst}
                      </Text>
                    )}
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {labels.opened} {formatOpenedAt(item.opened_at, language)}
                    </Text>
                  </View>

                  <Text style={[styles.arrow, { color: colors.accent }]}>→</Text>
                </Pressable>
              ))}
            </View>
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
  header: {
    paddingVertical: 28,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 42, lineHeight: 48, fontWeight: "900" },
  subtitle: { marginTop: 8, fontSize: 18, lineHeight: 27 },
  clearButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: { fontSize: 12, fontWeight: "800" },
  list: { gap: 10 },
  row: {
    minHeight: 118,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingRight: 16,
  },
  image: { width: 150, alignSelf: "stretch" },
  copy: { flex: 1, minWidth: 0, paddingVertical: 14, gap: 5 },
  headline: { fontSize: 18, lineHeight: 24, fontWeight: "800" },
  standfirst: { fontSize: 13, lineHeight: 19 },
  meta: { marginTop: 2, fontSize: 11, fontWeight: "600" },
  arrow: { fontSize: 20, fontWeight: "900" },
});

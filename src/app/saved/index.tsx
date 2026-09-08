import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { ScreenState } from "@/components/screen-state";
import { StoryTile } from "@/components/story-tile";
import { useBrieflyLanguage } from "@/context/language";
import { useSavedArticles } from "@/context/saved-articles";
import { useBrieflyTheme } from "@/context/theme";
import { layout } from "@/theme/tokens";

export default function SavedScreen() {
  const { snapshots, ready } = useSavedArticles();
  const { t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.page}>
          <AppHeader />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t.savedStories}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t.savedSubtitle}
            </Text>
          </View>

          {!ready ? (
            <ScreenState loading message={t.loadingSavedStories} />
          ) : snapshots.length === 0 ? (
            <ScreenState
              title={t.nothingSaved}
              message={t.nothingSavedMessage}
            />
          ) : (
            <View style={styles.grid}>
              {snapshots.map((article) => (
                <View key={article.snapshot_id} style={styles.card}>
                  <StoryTile
                    article={article}
                    href={`/saved/${article.snapshot_id}`}
                  />
                </View>
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
  header: { paddingVertical: 28 },
  title: { fontSize: 42, fontWeight: "900" },
  subtitle: {
    marginTop: 8,
    maxWidth: 760,
    fontSize: 18,
    lineHeight: 27,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { minWidth: 0, flexGrow: 1, flexBasis: 300, maxWidth: "100%" },
});

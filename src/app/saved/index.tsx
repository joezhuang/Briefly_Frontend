import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@/components/app-header";
import { ScreenState } from "@/components/screen-state";
import { StoryTile } from "@/components/story-tile";
import { useSavedArticles } from "@/context/saved-articles";
import { colors, layout } from "@/theme/tokens";

export default function SavedScreen() {
  const { snapshots, ready } = useSavedArticles();
  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}><View style={styles.page}><AppHeader /><View style={styles.header}><Text style={styles.title}>Saved stories</Text><Text style={styles.subtitle}>Snapshots stay readable even if Briefly later rebuilds or reclusters the live story.</Text></View>{!ready ? <ScreenState loading message="Loading saved stories…" /> : snapshots.length === 0 ? <ScreenState title="Nothing saved yet" message="Save a story and Briefly will keep an immutable local snapshot of that article version." /> : <View style={styles.grid}>{snapshots.map((article) => <View key={article.snapshot_id} style={styles.card}><StoryTile article={article} href={`/saved/${article.snapshot_id}`} /></View>)}</View>}</View></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, scroll: { alignItems: "center" }, page: { width: "100%", maxWidth: layout.pageMax, paddingHorizontal: layout.pagePadding, paddingBottom: 80 }, header: { paddingVertical: 28 }, title: { fontSize: 42, fontWeight: "900", color: colors.text }, subtitle: { marginTop: 8, maxWidth: 760, fontSize: 18, lineHeight: 27, color: colors.textMuted }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, card: { minWidth: 300, flexGrow: 1, flexBasis: "32%" } });

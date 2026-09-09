import { router } from "expo-router";
import { PropsWithChildren } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useBrieflyTheme } from "@/context/theme";

export function LegalScreen({ title, updated, children }: PropsWithChildren<{ title: string; updated: string }>) {
  const { colors } = useBrieflyTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.back, { color: colors.accent }]}>← Back</Text>
        </Pressable>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.updated, { color: colors.textMuted }]}>Last updated: {updated}</Text>
        </View>
        <View style={styles.document}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function LegalSection({ title, children }: PropsWithChildren<{ title: string }>) {
  const { colors } = useBrieflyTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: "100%", maxWidth: 820, alignSelf: "center", padding: 22, paddingBottom: 48, gap: 18 },
  back: { fontSize: 14, fontWeight: "800" },
  header: { gap: 6 },
  title: { fontSize: 34, fontWeight: "900" },
  updated: { fontSize: 13 },
  document: { gap: 24 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "900" },
  body: { fontSize: 15, lineHeight: 23 },
});

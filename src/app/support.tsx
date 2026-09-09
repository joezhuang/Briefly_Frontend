import { router } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useBrieflyTheme } from "@/context/theme";

const supportEmail = process.env.EXPO_PUBLIC_BRIEFLY_SUPPORT_EMAIL?.trim();

export default function SupportScreen() {
  const { colors } = useBrieflyTheme();

  const email = async (subject: string) => {
    if (!supportEmail) return;
    const url = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}`;
    await Linking.openURL(url);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.back, { color: colors.accent }]}>← Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Contact & Support</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Questions about Briefly, subscriptions, your account, privacy, or a problem in the app.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Email support</Text>
          {supportEmail ? (
            <>
              <Text style={[styles.body, { color: colors.textMuted }]}>{supportEmail}</Text>
              <Pressable onPress={() => void email("Briefly support request")} style={[styles.button, { borderColor: colors.border }]}>
                <Text style={[styles.buttonText, { color: colors.text }]}>Contact support</Text>
              </Pressable>
            </>
          ) : (
            <Text style={[styles.body, { color: colors.textMuted }]}>Support email is not configured yet. Set EXPO_PUBLIC_BRIEFLY_SUPPORT_EMAIL for production builds.</Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Common requests</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>For billing or purchase issues, include the platform you purchased on. For privacy requests, use the subject “Briefly privacy request”. For technical problems, include your device, app version, and what you were doing when the issue occurred.</Text>
          {supportEmail ? (
            <View style={styles.actions}>
              <Pressable onPress={() => void email("Briefly billing support")} style={[styles.button, { borderColor: colors.border }]}>
                <Text style={[styles.buttonText, { color: colors.text }]}>Billing help</Text>
              </Pressable>
              <Pressable onPress={() => void email("Briefly privacy request")} style={[styles.button, { borderColor: colors.border }]}>
                <Text style={[styles.buttonText, { color: colors.text }]}>Privacy request</Text>
              </Pressable>
              <Pressable onPress={() => void email("Briefly problem report")} style={[styles.button, { borderColor: colors.border }]}>
                <Text style={[styles.buttonText, { color: colors.text }]}>Report a problem</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: "100%", maxWidth: 720, alignSelf: "center", padding: 22, paddingBottom: 48, gap: 18 },
  back: { fontSize: 14, fontWeight: "800" },
  header: { gap: 8 },
  title: { fontSize: 34, fontWeight: "900" },
  subtitle: { fontSize: 16, lineHeight: 23 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "900" },
  body: { fontSize: 14, lineHeight: 21 },
  actions: { gap: 10 },
  button: { minHeight: 46, borderWidth: 1, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonText: { fontSize: 14, fontWeight: "800" },
});

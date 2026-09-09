import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { deleteBrieflyAccount } from "@/api/account";
import { syncBrieflyWebSubscription } from "@/api/briefly";
import { clearBrieflyAccessToken } from "@/auth/session";
import { supabase } from "@/auth/supabase";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyTheme } from "@/context/theme";
import { restoreBrieflySubscription } from "@/subscriptions";

export default function AccountScreen() {
  const { user, account, refreshAccount } = useBrieflyAuth();
  const { colors } = useBrieflyTheme();
  const [busy, setBusy] = useState<"restore" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const restore = async () => {
    if (!user) {
      router.push("/sign-in");
      return;
    }

    setBusy("restore");
    setMessage(null);
    try {
      const active =
        Platform.OS === "web"
          ? (await syncBrieflyWebSubscription()).translation_entitled
          : await restoreBrieflySubscription(user.id);

      await refreshAccount().catch(() => null);
      setMessage(
        active
          ? "Your Briefly Pro purchase has been restored."
          : "No active Briefly Pro purchase was found for this account.",
      );
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Restore failed.");
    } finally {
      setBusy(null);
    }
  };

  const performDelete = async () => {
    setBusy("delete");
    setMessage(null);
    try {
      await deleteBrieflyAccount();
      clearBrieflyAccessToken();
      if (supabase) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => null);
      }
      router.replace("/");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Account deletion failed.");
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () => {
    const warning =
      "This permanently deletes your Briefly account. This cannot be undone. Your store subscription is managed separately by Apple, Google, or Stripe and may need to be cancelled there.";

    if (Platform.OS === "web") {
      if (window.confirm(warning)) void performDelete();
      return;
    }

    Alert.alert("Delete Briefly account?", warning, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete account", style: "destructive", onPress: () => void performDelete() },
    ]);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.back, { color: colors.accent }]}>← Back</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Account</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Manage your Briefly account and purchases.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>SIGNED IN AS</Text>
          <Text style={[styles.value, { color: colors.text }]}>{user?.email ?? "Not signed in"}</Text>
          {account?.translation_entitled ? (
            <Text style={[styles.pro, { color: colors.accent }]}>Briefly Pro active</Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Restore purchases</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>Restore an existing Briefly Pro entitlement associated with this account. No purchase is made.</Text>
          <Pressable
            disabled={busy !== null}
            onPress={() => void restore()}
            style={[styles.button, { borderColor: colors.border }, busy !== null && styles.disabled]}
          >
            {busy === "restore" ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.text }]}>Restore purchases</Text>
            )}
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Delete account</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>Permanently delete your Briefly account and associated Briefly profile data. Deleting the account does not automatically cancel a subscription billed by Apple, Google, or Stripe.</Text>
          <Pressable
            disabled={!user || busy !== null}
            onPress={confirmDelete}
            style={[styles.dangerButton, { borderColor: "#c83b3b" }, (!user || busy !== null) && styles.disabled]}
          >
            {busy === "delete" ? (
              <ActivityIndicator color="#c83b3b" />
            ) : (
              <Text style={styles.dangerText}>Delete account</Text>
            )}
          </Pressable>
        </View>

        {message ? <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: "100%", maxWidth: 720, alignSelf: "center", padding: 22, gap: 18 },
  header: { gap: 8, marginBottom: 4 },
  back: { fontSize: 14, fontWeight: "800" },
  title: { fontSize: 34, fontWeight: "900" },
  subtitle: { fontSize: 16, lineHeight: 23 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, gap: 10 },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  value: { fontSize: 16, fontWeight: "700" },
  pro: { fontSize: 13, fontWeight: "900" },
  sectionTitle: { fontSize: 18, fontWeight: "900" },
  body: { fontSize: 14, lineHeight: 21 },
  button: { minHeight: 46, borderWidth: 1, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 4 },
  buttonText: { fontSize: 14, fontWeight: "800" },
  dangerButton: { minHeight: 46, borderWidth: 1, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 4 },
  dangerText: { color: "#c83b3b", fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  message: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});

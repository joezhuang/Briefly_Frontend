import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  deleteBrieflyAccount,
  syncBrieflyNativeSubscription,
} from "@/api/account";
import {
  createBrieflyWebPortal,
  getBrieflySubscriptionStatus,
  syncBrieflyWebSubscription,
  type BrieflySubscriptionStatus,
} from "@/api/briefly";
import { clearBrieflyAccessToken } from "@/auth/session";
import { supabase } from "@/auth/supabase";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyTheme } from "@/context/theme";
import { restoreBrieflySubscription } from "@/subscriptions";

const APPLE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";
const GOOGLE_PLAY_SUBSCRIPTIONS_URL =
  "https://play.google.com/store/account/subscriptions?package=com.hybridgalaxy.briefly";
const WEB_RETURN_URL =
  process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL?.replace(/\/$/, "") ||
  "https://briefly-news-analysis.vercel.app";

type ProPlatform = "app_store" | "play_store" | "stripe" | null;

function providerLabel(platform: ProPlatform) {
  if (platform === "stripe") return "Web";
  if (platform === "app_store") return "App Store";
  if (platform === "play_store") return "Google Play";
  return "Unknown";
}

function lifecycleLabel(status: BrieflySubscriptionStatus | null) {
  switch (status?.lifecycle_state) {
    case "trialing":
      return "Trial active";
    case "active":
      return "Active";
    case "canceling":
      return "Cancelled";
    case "grace_period":
      return "Payment issue — grace period";
    case "past_due":
      return "Payment issue";
    case "expired":
      return "Expired";
    default:
      return "Free";
  }
}

function formatLifecycleDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export default function AccountScreen() {
  const { user, account, refreshAccount, signOut } = useBrieflyAuth();
  const { colors } = useBrieflyTheme();
  const [busy, setBusy] = useState<
    "manage" | "restore" | "delete" | "signout" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<BrieflySubscriptionStatus | null>(null);
  const subscriptionIsPro =
    subscriptionStatus?.is_pro ?? account?.translation_entitled === true;

  useEffect(() => {
    if (!user) {
      setSubscriptionStatus(null);
      return;
    }

    let active = true;
    void getBrieflySubscriptionStatus()
      .then((status) => {
        if (active) setSubscriptionStatus(status);
      })
      .catch(() => {
        if (active) setSubscriptionStatus(null);
      });

    return () => {
      active = false;
    };
  }, [account?.translation_entitled, user]);

  const notify = (title: string, body: string) => {
    if (Platform.OS === "web") {
      setMessage(body);
      return;
    }
    Alert.alert(title, body);
  };

  const handleSignOut = async () => {
    if (!user || busy !== null) return;

    setBusy("signout");
    setMessage(null);
    try {
      await signOut();
      router.replace("/");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Sign out failed.");
    } finally {
      setBusy(null);
    }
  };

  const manageSubscription = async () => {
    if (!user) {
      router.push("/sign-in");
      return;
    }

    setBusy("manage");
    setMessage(null);
    try {
      let platform: ProPlatform;

      if (Platform.OS === "web") {
        platform =
          ((account as { briefly_pro_platform?: ProPlatform } | null)
            ?.briefly_pro_platform ?? null);
      } else {
        const result = await syncBrieflyNativeSubscription();
        platform = result.briefly_pro_platform;
        await refreshAccount().catch(() => null);
      }

      if (!platform) {
        notify(
          "No active subscription",
          "No active Briefly Pro billing source was found for this account.",
        );
        return;
      }

      if (platform === "stripe") {
        const portal = await createBrieflyWebPortal(`${WEB_RETURN_URL}/account`);
        await Linking.openURL(portal.portal_url);
        return;
      }

      if (platform === "app_store") {
        if (Platform.OS !== "ios") {
          notify(
            "Purchased through Apple",
            "Your Briefly Pro subscription was purchased through Apple. Manage or cancel it using the Apple Account/App Store associated with that purchase.",
          );
          return;
        }
        await Linking.openURL(APPLE_SUBSCRIPTIONS_URL);
        return;
      }

      if (platform === "play_store") {
        if (Platform.OS !== "android") {
          notify(
            "Purchased through Google Play",
            "Your Briefly Pro subscription was purchased through Google Play. Manage or cancel it in Google Play using the Google Account associated with that purchase.",
          );
          return;
        }
        await Linking.openURL(GOOGLE_PLAY_SUBSCRIPTIONS_URL);
      }
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to open subscription management.",
      );
    } finally {
      setBusy(null);
    }
  };

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
      {
        text: "Delete account",
        style: "destructive",
        onPress: () => void performDelete(),
      },
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
          {subscriptionIsPro ? (
            <Text style={[styles.pro, { color: colors.accent }]}>Briefly Pro active</Text>
          ) : null}
        </View>

        {subscriptionIsPro ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Manage subscription</Text>

            <View style={styles.subscriptionSummary}>
              <Text style={[styles.subscriptionState, { color: colors.text }]}>
                {lifecycleLabel(subscriptionStatus)}
              </Text>
              {subscriptionStatus?.provider ? (
                <Text style={[styles.subscriptionMeta, { color: colors.textMuted }]}>
                  {providerLabel(subscriptionStatus.provider)}
                  {subscriptionStatus.plan
                    ? ` · ${subscriptionStatus.plan === "yearly" ? "Yearly" : subscriptionStatus.plan === "monthly" ? "Monthly" : subscriptionStatus.plan}`
                    : ""}
                </Text>
              ) : null}

              {subscriptionStatus?.renews_at ? (
                <Text style={[styles.subscriptionMeta, { color: colors.textMuted }]}>
                  Renews {formatLifecycleDate(subscriptionStatus.renews_at)}
                </Text>
              ) : null}

              {subscriptionStatus?.lifecycle_state === "canceling" &&
              subscriptionStatus.access_until ? (
                <Text style={[styles.subscriptionMeta, { color: colors.textMuted }]}>
                  Access until {formatLifecycleDate(subscriptionStatus.access_until)}
                </Text>
              ) : null}

              {subscriptionStatus?.lifecycle_state === "grace_period" &&
              subscriptionStatus.access_until ? (
                <Text style={[styles.subscriptionMeta, { color: colors.textMuted }]}>
                  Grace period until {formatLifecycleDate(subscriptionStatus.access_until)}
                </Text>
              ) : null}
            </View>

            <Text style={[styles.body, { color: colors.textMuted }]}>Manage billing, renewal, or cancellation through the provider where your Briefly Pro subscription was purchased.</Text>
            <Pressable disabled={busy !== null} onPress={() => void manageSubscription()} style={[styles.button, { borderColor: colors.border }, busy !== null && styles.disabled]}>
              {busy === "manage" ? <ActivityIndicator color={colors.text} /> : <Text style={[styles.buttonText, { color: colors.text }]}>Manage subscription</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Briefly Pro</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              {subscriptionStatus?.lifecycle_state === "expired"
                ? "Your previous Briefly Pro subscription has expired. You can subscribe again at any time."
                : "View Briefly Pro features, current monthly and yearly prices, and available offers."}
            </Text>
            <Pressable
              disabled={!user || busy !== null}
              onPress={() => router.push("/upgrade?returnTo=/account")}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.accent },
                (!user || busy !== null) && styles.disabled,
              ]}
            >
              <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                View Briefly Pro plans
              </Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account access</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>Sign out of Briefly on this device.</Text>
          <Pressable disabled={!user || busy !== null} onPress={() => void handleSignOut()} style={[styles.button, { borderColor: colors.border }, (!user || busy !== null) && styles.disabled]}>
            {busy === "signout" ? <ActivityIndicator color={colors.text} /> : <Text style={[styles.buttonText, { color: colors.text }]}>Sign out</Text>}
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Restore purchases</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>Restore an existing Briefly Pro entitlement associated with this account. No purchase is made.</Text>
          <Pressable disabled={busy !== null} onPress={() => void restore()} style={[styles.button, { borderColor: colors.border }, busy !== null && styles.disabled]}>
            {busy === "restore" ? <ActivityIndicator color={colors.text} /> : <Text style={[styles.buttonText, { color: colors.text }]}>Restore purchases</Text>}
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Delete account</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>Permanently delete your Briefly account and associated Briefly profile data. Deleting the account does not automatically cancel a subscription billed by Apple, Google, or Stripe.</Text>
          <Pressable disabled={!user || busy !== null} onPress={confirmDelete} style={[styles.dangerButton, { borderColor: "#c83b3b" }, (!user || busy !== null) && styles.disabled]}>
            {busy === "delete" ? <ActivityIndicator color="#c83b3b" /> : <Text style={styles.dangerText}>Delete account</Text>}
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
  subscriptionSummary: { gap: 3, marginBottom: 2 },
  subscriptionState: { fontSize: 16, fontWeight: "900" },
  subscriptionMeta: { fontSize: 13, lineHeight: 19, fontWeight: "600" },
  body: { fontSize: 14, lineHeight: 21 },
  button: { minHeight: 46, borderWidth: 1, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 4 },
  buttonText: { fontSize: 14, fontWeight: "800" },
  primaryButton: { minHeight: 46, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 4 },
  primaryButtonText: { fontSize: 14, fontWeight: "900" },
  dangerButton: { minHeight: 46, borderWidth: 1, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 4 },
  dangerText: { color: "#c83b3b", fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  message: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});

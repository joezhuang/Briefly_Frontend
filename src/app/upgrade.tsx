import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import {
  beginBrieflySubscription,
  restoreBrieflySubscription,
  type BrieflyPlan,
} from "@/subscriptions";

export default function UpgradeScreen() {
  const { user, account, refreshAccount } = useBrieflyAuth();
  const { t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  const [busy, setBusy] = useState<BrieflyPlan | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.replace("/sign-in");
    }
  }, [user]);

  if (!user) return null;

  const purchase = async (plan: BrieflyPlan) => {
    setBusy(plan);
    setError(null);

    try {
      const active = await beginBrieflySubscription(plan, user.id);
      if (active) {
        await refreshAccount();
        router.replace("/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.purchaseFailed);
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy("restore");
    setError(null);

    try {
      const active = await restoreBrieflySubscription(user.id);
      if (active) {
        await refreshAccount();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.purchaseFailed);
    } finally {
      setBusy(null);
    }
  };

  const isPro = account?.translation_entitled === true;

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.card}>
        <Text style={[styles.brand, { color: colors.accent }]}>BRIEFLY</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          {t.upgradeTitle}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {isPro ? t.alreadyPro : t.upgradeSubtitle}
        </Text>

        {!isPro ? (
          <>
            <View style={styles.features}>
              <Text style={[styles.feature, { color: colors.text }]}>
                ✓ {t.proTranslationFeature}
              </Text>
              <Text style={[styles.feature, { color: colors.text }]}>
                ✓ {t.proFutureFeature}
              </Text>
            </View>

            <View
              style={[
                styles.trialBadge,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.trialText, { color: colors.accent }]}>
                {t.trialIncluded}
              </Text>
            </View>
          <>
            <Pressable
              disabled={busy !== null}
              onPress={() => void purchase("monthly")}
              style={[
                styles.plan,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
                busy !== null && styles.disabled,
              ]}
            >
              <Text style={[styles.planTitle, { color: colors.text }]}>
                {t.monthly}
              </Text>
              <Text style={[styles.actionText, { color: colors.accent }]}>
                {busy === "monthly" ? "…" : t.chooseMonthly}
              </Text>
            </Pressable>

            <Pressable
              disabled={busy !== null}
              onPress={() => void purchase("yearly")}
              style={[
                styles.plan,
                {
                  borderColor: colors.text,
                  backgroundColor: colors.text,
                },
                busy !== null && styles.disabled,
              ]}
            >
              <Text style={[styles.planTitle, { color: colors.background }]}>
                {t.yearly}
              </Text>
              <Text style={[styles.actionText, { color: colors.background }]}>
                {busy === "yearly" ? "…" : t.chooseYearly}
              </Text>
            </Pressable>
          </>
        ) : null}

        <Pressable
          disabled={busy !== null}
          onPress={() => void restore()}
          style={[
            styles.secondary,
            { borderColor: colors.border },
            busy !== null && styles.disabled,
          ]}
        >
          {busy === "restore" ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={[styles.secondaryText, { color: colors.text }]}>
              {Platform.OS === "web"
                ? t.manageSubscription
                : t.restorePurchases}
            </Text>
          )}
        </Pressable>

        {!isPro ? (
          <Text style={[styles.finePrint, { color: colors.textMuted }]}>
            {t.cancelTrial}
          </Text>
        ) : null}

        {!!error && (
          <Text style={[styles.error, { color: colors.error }]}>
            {error}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    gap: 16,
  },
  brand: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2.2,
  },
  title: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 27,
    marginBottom: 4,
  },
  features: {
    gap: 10,
    marginVertical: 4,
  },
  feature: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  trialBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  trialText: {
    fontSize: 13,
    fontWeight: "800",
  },
  plan: {
    minHeight: 86,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: "center",
    gap: 6,
  },
  planTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "800",
  },
  secondary: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "800",
  },
  finePrint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
  disabled: {
    opacity: 0.55,
  },
});

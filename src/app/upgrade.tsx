import { router, useLocalSearchParams } from "expo-router";
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

import {
  confirmBrieflyWebCheckout,
  syncBrieflyWebSubscription,
} from "@/api/briefly";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import {
  beginBrieflySubscription,
  restoreBrieflySubscription,
  type BrieflyPlan,
} from "@/subscriptions";

const proCopy = {
  en: {
    subtitle: "Unlock two-host podcast analysis for Briefly stories.",
    feature: "Deeply two-host podcast analysis from the authoritative English article",
  },
  es: {
    subtitle: "Desbloquea análisis en pódcast con dos presentadores para las noticias de Briefly.",
    feature: "Análisis de Deeply con dos presentadores a partir del artículo original en inglés",
  },
  ja: {
    subtitle: "Brieflyの記事を2人ホストのポッドキャスト分析でさらに深く理解できます。",
    feature: "権威ある英語記事を基にしたDeeplyの2人ホスト分析",
  },
  "zh-CN": {
    subtitle: "解锁 Briefly 新闻的双主持人播客分析。",
    feature: "由 Deeply 根据权威英文原文生成双主持人播客分析",
  },
  "zh-TW": {
    subtitle: "解鎖 Briefly 新聞的雙主持人 Podcast 分析。",
    feature: "由 Deeply 根據權威英文原文產生雙主持人 Podcast 分析",
  },
} as const;

export default function UpgradeScreen() {
  const { user, account, refreshAccount } = useBrieflyAuth();
  const { payment, session_id: sessionId } = useLocalSearchParams<{
    payment?: string;
    session_id?: string;
  }>();
  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const currentProCopy = proCopy[language] ?? proCopy.en;

  const [busy, setBusy] = useState<BrieflyPlan | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeSynced, setStripeSynced] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace("/sign-in");
    }
  }, [user]);

  useEffect(() => {
    if (!user || Platform.OS !== "web" || stripeSynced) return;

    let active = true;

    void syncBrieflyWebSubscription()
      .then(async (result) => {
        if (!active) return;
        setStripeSynced(true);
        if (result.translation_entitled) {
          await refreshAccount().catch(() => null);
        }
      })
      .catch(() => {
        if (active) setStripeSynced(true);
      });

    return () => {
      active = false;
    };
  }, [refreshAccount, stripeSynced, user]);

  useEffect(() => {
    if (!user || payment !== "success") return;

    let active = true;

    const confirm = async () => {
      if (sessionId) {
        try {
          const confirmation = await confirmBrieflyWebCheckout(sessionId);
          if (confirmation.translation_entitled) {
            await refreshAccount().catch(() => null);
            if (active) router.replace("/");
            return;
          }
        } catch {
          // Fall through to Stripe reconciliation below.
        }
      }

      const synced = await syncBrieflyWebSubscription().catch(() => null);
      if (synced?.translation_entitled) {
        await refreshAccount().catch(() => null);
        if (active) router.replace("/");
        return;
      }

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const next = await refreshAccount().catch(() => null);
        if (!active) return;
        if (next?.translation_entitled) {
          router.replace("/");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    };

    void confirm();

    return () => {
      active = false;
    };
  }, [payment, refreshAccount, sessionId, t.purchaseFailed, user]);

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
      if (active) await refreshAccount();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.purchaseFailed);
    } finally {
      setBusy(null);
    }
  };

  // Legacy API field; it now represents Briefly Pro account state. Experimental
  // localization is free and does not consult this flag.
  const isPro = account?.translation_entitled === true;
  const confirmingPayment = payment === "success" && !isPro;

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
          {isPro ? t.alreadyPro : currentProCopy.subtitle}
        </Text>

        {confirmingPayment ? (
          <View style={styles.confirming}>
            <ActivityIndicator color={colors.text} />
            <Text style={[styles.confirmingText, { color: colors.textMuted }]}>
              {t.confirmingSubscription}
            </Text>
          </View>
        ) : null}

        {!isPro ? (
          <>
            <View style={styles.features}>
              <Text style={[styles.feature, { color: colors.text }]}>
                ✓ {currentProCopy.feature}
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

            <Pressable
              disabled={busy !== null || confirmingPayment}
              onPress={() => void purchase("monthly")}
              style={[
                styles.plan,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
                (busy !== null || confirmingPayment) && styles.disabled,
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
              disabled={busy !== null || confirmingPayment}
              onPress={() => void purchase("yearly")}
              style={[
                styles.plan,
                {
                  borderColor: colors.text,
                  backgroundColor: colors.text,
                },
                (busy !== null || confirmingPayment) && styles.disabled,
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
          disabled={busy !== null || confirmingPayment}
          onPress={() => void restore()}
          style={[
            styles.secondary,
            { borderColor: colors.border },
            (busy !== null || confirmingPayment) && styles.disabled,
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
          <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
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
  confirming: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  confirmingText: {
    fontSize: 14,
    lineHeight: 20,
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

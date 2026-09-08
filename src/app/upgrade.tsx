import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
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
    subtitle: "Go beyond reading. Listen to deeper analysis and keep important stories up to date as they develop.",
    included: "Included with Briefly Pro",
    features: [
      {
        title: "Two-host Podcast Analysis",
        body: "Turn a Briefly story into a Deeply two-host analysis, grounded in the authoritative English article and delivered in your selected language.",
      },
      {
        title: "Update developing stories",
        body: "When newer source evidence appears, Briefly can rebuild an existing story into a fresh canonical version instead of leaving you with an outdated article.",
      },
      {
        title: "Follow saved stories forward",
        body: "Use the event timeline to move from the version you saved to the latest Briefly update when a story continues to develop.",
      },
      {
        title: "Pro access across Briefly",
        body: "Your Briefly Pro status unlocks Pro features on supported platforms and lets you manage or restore your subscription from your account.",
      },
    ],
  },
  es: {
    subtitle: "Ve más allá de leer: escucha análisis más profundos y mantén al día las historias importantes a medida que evolucionan.",
    included: "Incluido con Briefly Pro",
    features: [
      {
        title: "Análisis en pódcast con dos presentadores",
        body: "Convierte una historia de Briefly en un análisis de Deeply con dos presentadores, basado en el artículo original en inglés y generado en el idioma que hayas elegido.",
      },
      {
        title: "Actualiza historias en desarrollo",
        body: "Cuando aparece evidencia más reciente, Briefly puede reconstruir una historia existente como una nueva versión canónica en lugar de dejarte con un artículo desactualizado.",
      },
      {
        title: "Sigue la evolución de tus historias guardadas",
        body: "Usa la cronología del evento para pasar de la versión que guardaste a la actualización más reciente de Briefly cuando la historia siga desarrollándose.",
      },
      {
        title: "Acceso Pro en Briefly",
        body: "Tu estado Briefly Pro desbloquea las funciones Pro en las plataformas compatibles y te permite gestionar o restaurar la suscripción desde tu cuenta.",
      },
    ],
  },
  ja: {
    subtitle: "読むだけで終わらず、より深い音声分析を聴き、重要なニュースのその後も追いかけられます。",
    included: "Briefly Pro に含まれる機能",
    features: [
      {
        title: "2人ホストのPodcast分析",
        body: "Brieflyの記事を、権威ある英語版を事実の基盤としたDeeplyの2人ホスト分析に変換し、選択した言語で聴けます。",
      },
      {
        title: "進展したニュースを更新",
        body: "より新しい情報源が見つかった場合、古い記事のままにせず、Brieflyが最新の根拠から新しい正規版を生成できます。",
      },
      {
        title: "保存したニュースの続報を追跡",
        body: "イベントのタイムラインから、保存した時点の記事と、その後に更新されたBrieflyの最新版をつなげて確認できます。",
      },
      {
        title: "Briefly全体でProアクセス",
        body: "Briefly Proの状態により、対応プラットフォームのPro機能を利用でき、アカウントから購読の管理や復元もできます。",
      },
    ],
  },
  "zh-CN": {
    subtitle: "不只是阅读。收听更深入的分析，并在重要事件持续发展时保持更新。",
    included: "Briefly Pro 包含",
    features: [
      {
        title: "双主持人播客分析",
        body: "把 Briefly 新闻转成 Deeply 双主持人深度分析，以权威英文文章作为事实来源，并用你选择的语言生成。",
      },
      {
        title: "更新持续发展的新闻",
        body: "当出现更新的来源证据时，Briefly 可以重新生成新的权威文章版本，而不是让你停留在已经过时的报道上。",
      },
      {
        title: "继续追踪已保存的新闻",
        body: "通过事件时间线，从你当时保存的版本直接查看 Briefly 后续整理出的最新进展。",
      },
      {
        title: "Briefly 全平台 Pro 权益",
        body: "你的 Briefly Pro 状态可解锁受支持平台上的 Pro 功能，并可从账户管理或恢复订阅。",
      },
    ],
  },
  "zh-TW": {
    subtitle: "不只是閱讀。收聽更深入的分析，並在重要事件持續發展時保持更新。",
    included: "Briefly Pro 包含",
    features: [
      {
        title: "雙主持人 Podcast 分析",
        body: "把 Briefly 新聞轉成 Deeply 雙主持人深度分析，以權威英文文章作為事實來源，並用你選擇的語言產生。",
      },
      {
        title: "更新持續發展的新聞",
        body: "當出現更新的來源證據時，Briefly 可以重新產生新的權威文章版本，而不是讓你停留在已經過時的報導上。",
      },
      {
        title: "繼續追蹤已儲存的新聞",
        body: "透過事件時間線，從你當時儲存的版本直接查看 Briefly 後續整理出的最新進展。",
      },
      {
        title: "Briefly 全平台 Pro 權益",
        body: "你的 Briefly Pro 狀態可解鎖支援平台上的 Pro 功能，並可從帳戶管理或恢復訂閱。",
      },
    ],
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
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={[styles.brand, { color: colors.accent }]}>BRIEFLY PRO</Text>
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
              <View style={styles.featuresSection}>
                <Text style={[styles.featuresHeading, { color: colors.text }]}>
                  {currentProCopy.included}
                </Text>
                <View style={styles.features}>
                  {currentProCopy.features.map((feature) => (
                    <View
                      key={feature.title}
                      style={[
                        styles.featureCard,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <View
                        style={[styles.check, { backgroundColor: colors.accent }]}
                      >
                        <Text style={[styles.checkText, { color: colors.background }]}>✓</Text>
                      </View>
                      <View style={styles.featureCopy}>
                        <Text style={[styles.featureTitle, { color: colors.text }]}>
                          {feature.title}
                        </Text>
                        <Text style={[styles.featureBody, { color: colors.textMuted }]}>
                          {feature.body}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    paddingVertical: 34,
  },
  card: {
    width: "100%",
    maxWidth: 620,
    gap: 16,
  },
  brand: {
    fontSize: 13,
    fontWeight: "900",
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
  featuresSection: {
    gap: 12,
    marginVertical: 4,
  },
  featuresHeading: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "900",
  },
  features: {
    gap: 10,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkText: {
    fontSize: 13,
    fontWeight: "900",
  },
  featureCopy: {
    flex: 1,
    gap: 3,
  },
  featureTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  featureBody: {
    fontSize: 13,
    lineHeight: 19,
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

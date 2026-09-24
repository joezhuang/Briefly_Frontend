import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import {
  flushProductAnalytics,
  trackProductEvent,
} from "@/analytics/product-analytics";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyAppConfig } from "@/context/app-config";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import { safeReturnTo } from "@/navigation/return-to";
import {
  beginBrieflySubscription,
  getBrieflyPlanPrices,
  redeemBrieflyOfferCode,
  restoreBrieflySubscription,
  type BrieflyPlan,
  type BrieflyPlanPrices,
} from "@/subscriptions";

function purchaseSourceLabel(
  platform: "stripe" | "app_store" | "play_store" | null | undefined,
) {
  if (platform === "stripe") return "the web";
  if (platform === "app_store") return "the App Store";
  if (platform === "play_store") return "Google Play";
  return "another platform";
}

function revenueCatAccountOwnershipMessage(error: unknown) {
  if (
    (Platform.OS !== "ios" && Platform.OS !== "android") ||
    !error ||
    typeof error !== "object"
  ) {
    return null;
  }

  const candidate = error as {
    code?: unknown;
    readableErrorCode?: unknown;
    readable_error_code?: unknown;
    message?: unknown;
    underlyingErrorMessage?: unknown;
    underlying_error_message?: unknown;
  };
  const details = [
    candidate.code,
    candidate.readableErrorCode,
    candidate.readable_error_code,
    candidate.message,
    candidate.underlyingErrorMessage,
    candidate.underlying_error_message,
  ]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value))
    .join(" ")
    .toUpperCase();

  const store = Platform.OS === "ios" ? "App Store" : "Google Play";

  if (
    details.includes("RECEIPT_ALREADY_IN_USE") ||
    details.includes("ANOTHER ACTIVE SUBSCRIBER") ||
    (details.includes("RECEIPT") && details.includes("ANOTHER SUBSCRIBER"))
  ) {
    return (
      `This ${store} purchase is linked to another Briefly account. ` +
      `Sign in to the Briefly account that owns it, or use a different ${store} account to subscribe.`
    );
  }

  if (
    details.includes("PRODUCT_ALREADY_PURCHASED") ||
    details.includes("ITEM_ALREADY_OWNED") ||
    details.includes("PRODUCT ALREADY PURCHASED") ||
    details.includes("ITEM ALREADY OWNED")
  ) {
    return (
      `This ${store} account already owns this subscription. Try Restore Purchases. ` +
      "If it belongs to another Briefly account, sign in to that Briefly account " +
      `or use a different ${store} account.`
    );
  }

  return null;
}

function subscriptionErrorMessage(error: unknown, fallback: string) {
  return (
    revenueCatAccountOwnershipMessage(error) ||
    (error instanceof Error ? error.message : fallback)
  );
}

const proCopy = {
  en: {
    subtitle: "Go beyond reading. Listen to deeper analysis and update important stories when you choose.",
    included: "Included with Briefly Pro",
    features: [
      {
        title: "Two-host Podcast Analysis",
        body: "Turn a Briefly story into a Deeply two-host analysis, grounded in the authoritative English article and delivered in your selected language.",
      },
      {
        title: "Generate the latest story version",
        body: "When newer source evidence exists, use the event timeline to explicitly ask Briefly to generate a fresh canonical version. Normal story reading never triggers this paid update automatically.",
      },
      {
        title: "Follow saved stories forward",
        body: "Use the event timeline to move from the version you saved to newer Briefly developments, then generate a fresh version when you decide it is worth updating.",
      },
      {
        title: "Pro access across Briefly",
        body: "Your Briefly Pro status unlocks Pro features on supported platforms and lets you manage or restore your subscription from your account.",
      },
    ],
  },
  es: {
    subtitle: "Ve más allá de leer: escucha análisis más profundos y actualiza las historias importantes cuando tú lo decidas.",
    included: "Incluido con Briefly Pro",
    features: [
      {
        title: "Análisis en pódcast con dos presentadores",
        body: "Convierte una historia de Briefly en un análisis de Deeply con dos presentadores, basado en el artículo original en inglés y generado en el idioma que hayas elegido.",
      },
      {
        title: "Genera la versión más reciente",
        body: "Cuando haya evidencia más reciente, usa la cronología del evento para pedir explícitamente a Briefly una nueva versión canónica. Leer una historia normalmente nunca activa esta actualización de pago automáticamente.",
      },
      {
        title: "Sigue la evolución de tus historias guardadas",
        body: "Usa la cronología para pasar de la versión guardada a novedades posteriores de Briefly y genera una nueva versión solo cuando decidas que merece la pena.",
      },
      {
        title: "Acceso Pro en Briefly",
        body: "Tu estado Briefly Pro desbloquea las funciones Pro en las plataformas compatibles y te permite gestionar o restaurar la suscripción desde tu cuenta.",
      },
    ],
  },
  ja: {
    subtitle: "読むだけで終わらず、より深い音声分析を聴き、必要なときだけ重要なニュースを更新できます。",
    included: "Briefly Pro に含まれる機能",
    features: [
      {
        title: "2人ホストのPodcast分析",
        body: "Brieflyの記事を、権威ある英語版を事実の基盤としたDeeplyの2人ホスト分析に変換し、選択した言語で聴けます。",
      },
      {
        title: "最新の記事版を生成",
        body: "より新しい情報源がある場合、イベントのタイムラインから明示的に最新の正規版生成を依頼できます。通常の記事閲覧だけでは有料更新は自動実行されません。",
      },
      {
        title: "保存したニュースの続報を追跡",
        body: "タイムラインで保存時点からその後の動きを確認し、更新する価値があると判断したときだけ新しい版を生成できます。",
      },
      {
        title: "Briefly全体でProアクセス",
        body: "Briefly Proの状態により、対応プラットフォームのPro機能を利用でき、アカウントから購読の管理や復元もできます。",
      },
    ],
  },
  "zh-CN": {
    subtitle: "不只是阅读。收听更深入的分析，并在你需要时主动更新重要事件。",
    included: "Briefly Pro 包含",
    features: [
      {
        title: "双主持人播客分析",
        body: "把 Briefly 新闻转成 Deeply 双主持人深度分析，以权威英文文章作为事实来源，并用你选择的语言生成。",
      },
      {
        title: "主动生成最新报道版本",
        body: "当出现更新的来源证据时，可从事件时间线明确请求 Briefly 生成新的权威版本。普通点击和阅读新闻不会自动触发这项付费更新。",
      },
      {
        title: "继续追踪已保存的新闻",
        body: "通过事件时间线查看保存之后的新进展，并仅在你认为值得更新时主动生成新的 Briefly 版本。",
      },
      {
        title: "Briefly 全平台 Pro 权益",
        body: "你的 Briefly Pro 状态可解锁受支持平台上的 Pro 功能，并可从账户管理或恢复订阅。",
      },
    ],
  },
  "zh-TW": {
    subtitle: "不只是閱讀。收聽更深入的分析，並在你需要時主動更新重要事件。",
    included: "Briefly Pro 包含",
    features: [
      {
        title: "雙主持人 Podcast 分析",
        body: "把 Briefly 新聞轉成 Deeply 雙主持人深度分析，以權威英文文章作為事實來源，並用你選擇的語言產生。",
      },
      {
        title: "主動產生最新報導版本",
        body: "當出現更新的來源證據時，可從事件時間線明確要求 Briefly 產生新的權威版本。一般點擊和閱讀新聞不會自動觸發這項付費更新。",
      },
      {
        title: "繼續追蹤已儲存的新聞",
        body: "透過事件時間線查看儲存之後的新進展，並只在你認為值得更新時主動產生新的 Briefly 版本。",
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
  const {
    payment,
    plan: paymentPlan,
    session_id: sessionId,
    returnTo,
  } = useLocalSearchParams<{
    payment?: string;
    plan?: string;
    session_id?: string;
    returnTo?: string | string[];
  }>();
  const { language, t } = useBrieflyLanguage();
  const { config: appConfig } = useBrieflyAppConfig();
  const { colors } = useBrieflyTheme();
  const currentProCopy = proCopy[language] ?? proCopy.en;
  const returnPath = safeReturnTo(returnTo);

  const [busy, setBusy] = useState<BrieflyPlan | "restore" | "redeem" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeSynced, setStripeSynced] = useState(false);
  const upgradeViewTrackedRef = useRef(false);
  const webPurchaseTrackedRef = useRef(false);
  const webCancelTrackedRef = useRef(false);
  const [planPrices, setPlanPrices] = useState<BrieflyPlanPrices>({
    monthly: null,
    yearly: null,
  });

  useEffect(() => {
    if (!user) {
      router.replace(
        `/sign-in?returnTo=${encodeURIComponent(returnPath)}` as never,
      );
    }
  }, [returnPath, user]);

  useEffect(() => {
    if (!user || upgradeViewTrackedRef.current) return;
    upgradeViewTrackedRef.current = true;

    trackProductEvent("subscription_upgrade_view", {
      properties: {
        surface: "upgrade",
        provider:
          Platform.OS === "web"
            ? "stripe"
            : Platform.OS === "ios"
              ? "app_store"
              : "play_store",
      },
    });
  }, [user]);

  useEffect(() => {
    if (
      !user ||
      Platform.OS !== "web" ||
      payment !== "cancel" ||
      webCancelTrackedRef.current
    ) {
      return;
    }

    webCancelTrackedRef.current = true;
    trackProductEvent("subscription_checkout_cancel", {
      properties: {
        plan:
          paymentPlan === "monthly" || paymentPlan === "yearly"
            ? paymentPlan
            : "unknown",
        provider: "stripe",
      },
    });
    void flushProductAnalytics();
  }, [payment, paymentPlan, user]);

  useEffect(() => {
    if (!user) return;

    let active = true;
    const offeringIdentifier =
      appConfig?.promotion_enabled
        ? appConfig.native_revenuecat_offering_id
        : null;

    void getBrieflyPlanPrices(user.id, offeringIdentifier)
      .then((prices) => {
        if (active) setPlanPrices(prices);
      })
      .catch(() => {
        if (active) {
          setPlanPrices({ monthly: null, yearly: null });
        }
      });

    return () => {
      active = false;
    };
  }, [
    appConfig?.native_revenuecat_offering_id,
    appConfig?.promotion_enabled,
    user,
  ]);

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
            if (active && !webPurchaseTrackedRef.current) {
              webPurchaseTrackedRef.current = true;
              trackProductEvent("subscription_purchase_complete", {
                properties: {
                  plan:
                    paymentPlan === "monthly" || paymentPlan === "yearly"
                      ? paymentPlan
                      : "unknown",
                  provider: "stripe",
                  promotion: appConfig?.promotion_enabled === true,
                },
              });
              await flushProductAnalytics().catch(() => undefined);
            }
            if (active) router.replace(returnPath as never);
            return;
          }
        } catch {
          // Fall through to Stripe reconciliation below.
        }
      }

      const synced = await syncBrieflyWebSubscription().catch(() => null);
      if (synced?.translation_entitled) {
        await refreshAccount().catch(() => null);
        if (active && !webPurchaseTrackedRef.current) {
          webPurchaseTrackedRef.current = true;
          trackProductEvent("subscription_purchase_complete", {
            properties: {
              plan:
                paymentPlan === "monthly" || paymentPlan === "yearly"
                  ? paymentPlan
                  : "unknown",
              provider: "stripe",
              promotion: appConfig?.promotion_enabled === true,
            },
          });
          await flushProductAnalytics().catch(() => undefined);
        }
        if (active) router.replace(returnPath as never);
        return;
      }

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const next = await refreshAccount().catch(() => null);
        if (!active) return;
        if (next?.translation_entitled) {
          if (!webPurchaseTrackedRef.current) {
            webPurchaseTrackedRef.current = true;
            trackProductEvent("subscription_purchase_complete", {
              properties: {
                plan:
                  paymentPlan === "monthly" || paymentPlan === "yearly"
                    ? paymentPlan
                    : "unknown",
                provider: "stripe",
                promotion: appConfig?.promotion_enabled === true,
              },
            });
            await flushProductAnalytics().catch(() => undefined);
          }
          router.replace(returnPath as never);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    };

    void confirm();

    return () => {
      active = false;
    };
  }, [
    appConfig?.promotion_enabled,
    payment,
    paymentPlan,
    refreshAccount,
    returnPath,
    sessionId,
    t.purchaseFailed,
    user,
  ]);

  if (!user) return null;

  const purchase = async (plan: BrieflyPlan) => {
    setBusy(plan);
    setError(null);

    trackProductEvent("subscription_plan_select", {
      properties: {
        plan,
        provider:
          Platform.OS === "web"
            ? "stripe"
            : Platform.OS === "ios"
              ? "app_store"
              : "play_store",
        promotion: appConfig?.promotion_enabled === true,
      },
    });

    try {
      const latestAccount = await refreshAccount().catch(() => null);
      if (latestAccount?.translation_entitled) {
        const source = purchaseSourceLabel(
          latestAccount.briefly_pro_platform,
        );
        setError(
          `Briefly Pro is already active through ${source}. Another subscription was not started.`,
        );
        return;
      }

      const active = await beginBrieflySubscription(
        plan,
        user.id,
        appConfig?.promotion_enabled
          ? appConfig.native_revenuecat_offering_id
          : null,
      );
      if (active) {
        await refreshAccount();
        router.replace(returnPath as never);
      }
    } catch (err: unknown) {
      setError(subscriptionErrorMessage(err, t.purchaseFailed));
    } finally {
      setBusy(null);
    }
  };

  const redeemOfferCode = async () => {
    setBusy("redeem");
    setError(null);

    try {
      const active = await redeemBrieflyOfferCode(user.id);
      if (active) {
        trackProductEvent("subscription_purchase_complete", {
          properties: {
            plan: "offer_code",
            provider: "app_store",
            promotion: true,
          },
        });
        await refreshAccount();
      }
    } catch (err: unknown) {
      setError(subscriptionErrorMessage(err, t.purchaseFailed));
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy("restore");
    setError(null);

    try {
      if (Platform.OS !== "web") {
        trackProductEvent("subscription_restore_start", {
          properties: {
            provider: Platform.OS === "ios" ? "app_store" : "play_store",
            surface: "upgrade",
          },
        });
      }

      const active = await restoreBrieflySubscription(user.id);
      if (Platform.OS !== "web") {
        trackProductEvent("subscription_restore_complete", {
          properties: {
            provider: Platform.OS === "ios" ? "app_store" : "play_store",
            surface: "upgrade",
            active,
          },
        });
      }
      if (active) await refreshAccount();
    } catch (err: unknown) {
      setError(subscriptionErrorMessage(err, t.purchaseFailed));
    } finally {
      setBusy(null);
    }
  };

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
              {appConfig?.promotion_enabled &&
                (!!appConfig.promotion_title || !!appConfig.promotion_message) && (
                  <View
                    style={[
                      styles.promotionCard,
                      { backgroundColor: colors.surface, borderColor: colors.accent },
                    ]}
                  >
                    {!!appConfig.promotion_title && (
                      <Text style={[styles.promotionTitle, { color: colors.text }]}>
                        {appConfig.promotion_title}
                      </Text>
                    )}
                    {!!appConfig.promotion_message && (
                      <Text style={[styles.promotionMessage, { color: colors.textMuted }]}>
                        {appConfig.promotion_message}
                      </Text>
                    )}
                  </View>
                )}

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
                <View style={styles.planHeader}>
                  <Text style={[styles.planTitle, { color: colors.text }]}>
                    {t.monthly}
                  </Text>
                  {planPrices.monthly ? (
                    <Text style={[styles.planPrice, { color: colors.text }]}>
                      {planPrices.monthly}
                      <Text style={[styles.planPeriod, { color: colors.textMuted }]}>
                        {" / month"}
                      </Text>
                    </Text>
                  ) : null}
                </View>
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
                <View style={styles.planHeader}>
                  <Text style={[styles.planTitle, { color: colors.background }]}>
                    {t.yearly}
                  </Text>
                  {planPrices.yearly ? (
                    <Text style={[styles.planPrice, { color: colors.background }]}>
                      {planPrices.yearly}
                      <Text
                        style={[
                          styles.planPeriod,
                          { color: colors.background, opacity: 0.75 },
                        ]}
                      >
                        {" / year"}
                      </Text>
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.actionText, { color: colors.background }]}>
                  {busy === "yearly" ? "…" : t.chooseYearly}
                </Text>
              </Pressable>

              {Platform.OS === "ios" &&
                appConfig?.ios_offer_code_redemption_enabled && (
                  <Pressable
                    disabled={busy !== null || confirmingPayment}
                    onPress={() => void redeemOfferCode()}
                    style={[
                      styles.secondary,
                      { borderColor: colors.border },
                      (busy !== null || confirmingPayment) && styles.disabled,
                    ]}
                  >
                    {busy === "redeem" ? (
                      <ActivityIndicator color={colors.text} />
                    ) : (
                      <Text style={[styles.secondaryText, { color: colors.text }]}>
                        Redeem offer code
                      </Text>
                    )}
                  </Pressable>
                )}

              {Platform.OS === "android" &&
                appConfig?.android_promo_code_hint_enabled && (
                  <Text style={[styles.promotionHint, { color: colors.textMuted }]}>
                    Have a Google Play promo code? Choose a plan, then use the
                    redemption option in the Google Play payment flow when available.
                  </Text>
                )}

              {Platform.OS === "web" &&
                appConfig?.web_promotion_codes_enabled && (
                  <Text style={[styles.promotionHint, { color: colors.textMuted }]}>
                    Have a promo code? Choose a plan and enter it in Stripe Checkout.
                  </Text>
                )}
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

          <View style={styles.legalLinks}>
            <Pressable onPress={() => router.push("/legal/terms")}>
              <Text style={[styles.legalLink, { color: colors.accent }]}>Terms of Use</Text>
            </Pressable>
            <Text style={[styles.legalDivider, { color: colors.textMuted }]}>·</Text>
            <Pressable onPress={() => router.push("/legal/privacy")}>
              <Text style={[styles.legalLink, { color: colors.accent }]}>Privacy Policy</Text>
            </Pressable>
          </View>

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
  promotionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  promotionTitle: { fontSize: 18, lineHeight: 24, fontWeight: "900" },
  promotionMessage: { fontSize: 14, lineHeight: 21 },
  promotionHint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
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
  planHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  planTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  planPrice: {
    fontSize: 20,
    fontWeight: "900",
  },
  planPeriod: {
    fontSize: 12,
    fontWeight: "700",
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
  legalLinks: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  legalLink: {
    fontSize: 12,
    fontWeight: "800",
  },
  legalDivider: {
    fontSize: 12,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
  disabled: {
    opacity: 0.55,
  },
});

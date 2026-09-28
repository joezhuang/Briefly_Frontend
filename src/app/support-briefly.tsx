import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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

import { confirmBrieflyWebSupportCheckout } from "@/api/briefly";
import {
  flushProductAnalytics,
  trackProductEvent,
} from "@/analytics/product-analytics";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyAppConfig } from "@/context/app-config";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import {
  beginBrieflySupportPurchase,
  getBrieflySupportPrices,
  type BrieflySupportPrices,
  type BrieflySupportProduct,
} from "@/subscriptions";

const EMPTY_PRICES: BrieflySupportPrices = {
  tip_small: null,
  tip_medium: null,
  tip_large: null,
  pass_1m: null,
};

const DEFAULT_SUPPORT_TITLE = "Support Briefly";
const DEFAULT_SUPPORT_MESSAGE =
  "Help Briefly stay independent with a one-time contribution, or choose a one-month Supporter Pass.";

const supportCopy = {
  en: {
    back: "Back",
    title: DEFAULT_SUPPORT_TITLE,
    subtitle: DEFAULT_SUPPORT_MESSAGE,
    unavailableTitle: "Support options are currently unavailable",
    unavailableBody:
      "Briefly support purchases are not enabled on this platform right now.",
    smallTitle: "Small support",
    smallBody:
      "A simple one-time contribution. It does not change your Pro access.",
    mediumTitle: "Extra support",
    mediumBody: "A larger one-time contribution to help fund Briefly.",
    largeTitle: "Generous support",
    largeBody: "For readers who want to contribute a little more.",
    passTitle: "1-month Supporter Pass",
    passBody:
      "One payment for one month of Briefly Pro. It does not auto-renew.",
    getPass: "Get Supporter Pass",
    support: "Support Briefly",
    alreadyPro:
      "You already have Briefly Pro, so Supporter Pass is hidden. You can still make a one-time contribution.",
    terms:
      "One-time contributions do not unlock Pro. Supporter Pass is a fixed-duration Pro purchase and does not auto-renew.",
    cancelled: "Payment cancelled. No charge was made.",
    thanksPro: "Thank you. Your one-month Briefly Pro access is active.",
    thanks: "Thank you for supporting Briefly.",
    confirmFailed: "Unable to confirm this support payment.",
    purchaseFailed: "Support purchase failed.",
  },
  es: {
    back: "Atrás",
    title: "Apoya a Briefly",
    subtitle:
      "Ayuda a Briefly a mantenerse independiente con una contribución única o elige un Pase de Colaborador de un mes.",
    unavailableTitle: "Las opciones de apoyo no están disponibles ahora",
    unavailableBody:
      "Las compras para apoyar a Briefly no están habilitadas en esta plataforma en este momento.",
    smallTitle: "Apoyo pequeño",
    smallBody:
      "Una contribución única sencilla. No cambia tu acceso a Pro.",
    mediumTitle: "Apoyo extra",
    mediumBody: "Una contribución única mayor para ayudar a financiar Briefly.",
    largeTitle: "Apoyo generoso",
    largeBody: "Para lectores que quieren contribuir un poco más.",
    passTitle: "Pase de Colaborador de 1 mes",
    passBody:
      "Un pago por un mes de Briefly Pro. No se renueva automáticamente.",
    getPass: "Obtener Pase de Colaborador",
    support: "Apoyar a Briefly",
    alreadyPro:
      "Ya tienes Briefly Pro, por lo que el Pase de Colaborador está oculto. Aún puedes hacer una contribución única.",
    terms:
      "Las contribuciones únicas no desbloquean Pro. El Pase de Colaborador ofrece Pro por un periodo fijo y no se renueva automáticamente.",
    cancelled: "Pago cancelado. No se realizó ningún cargo.",
    thanksPro: "Gracias. Tu acceso a Briefly Pro por un mes está activo.",
    thanks: "Gracias por apoyar a Briefly.",
    confirmFailed: "No se pudo confirmar este pago de apoyo.",
    purchaseFailed: "La compra de apoyo falló.",
  },
  ja: {
    back: "戻る",
    title: "Brieflyを応援",
    subtitle:
      "一度限りの支援、または1か月のサポーターパスで、Brieflyの独立した運営を支援できます。",
    unavailableTitle: "現在、支援オプションは利用できません",
    unavailableBody:
      "このプラットフォームでは現在、Brieflyへの支援購入は有効になっていません。",
    smallTitle: "少額の支援",
    smallBody: "一度限りの支援です。Proアクセスは変更されません。",
    mediumTitle: "追加の支援",
    mediumBody: "Brieflyの運営を支えるための、より大きな一度限りの支援です。",
    largeTitle: "手厚い支援",
    largeBody: "もう少し多く支援したい読者向けです。",
    passTitle: "1か月サポーターパス",
    passBody: "1回の支払いでBriefly Proを1か月利用できます。自動更新はありません。",
    getPass: "サポーターパスを入手",
    support: "Brieflyを応援",
    alreadyPro:
      "すでにBriefly Proをご利用中のため、サポーターパスは非表示です。一度限りの支援は引き続き可能です。",
    terms:
      "一度限りの支援ではProは有効になりません。サポーターパスは期間限定のPro購入で、自動更新はありません。",
    cancelled: "支払いはキャンセルされました。請求は発生していません。",
    thanksPro: "ありがとうございます。1か月のBriefly Proアクセスが有効になりました。",
    thanks: "Brieflyをご支援いただきありがとうございます。",
    confirmFailed: "この支払いを確認できませんでした。",
    purchaseFailed: "支援の購入に失敗しました。",
  },
  "zh-CN": {
    back: "返回",
    title: "支持 Briefly",
    subtitle:
      "通过一次性支持，或选择一个月的支持者通行证，帮助 Briefly 保持独立运营。",
    unavailableTitle: "支持选项目前不可用",
    unavailableBody: "当前平台暂未启用 Briefly 支持购买。",
    smallTitle: "小额支持",
    smallBody: "一次性支持，不会改变你的 Pro 权益。",
    mediumTitle: "额外支持",
    mediumBody: "更高金额的一次性支持，帮助 Briefly 持续运营。",
    largeTitle: "慷慨支持",
    largeBody: "适合希望多支持一些的读者。",
    passTitle: "1 个月支持者通行证",
    passBody: "一次付款即可获得一个月 Briefly Pro，不会自动续费。",
    getPass: "获取支持者通行证",
    support: "支持 Briefly",
    alreadyPro:
      "你已经拥有 Briefly Pro，因此支持者通行证已隐藏。你仍然可以进行一次性支持。",
    terms:
      "一次性支持不会解锁 Pro。支持者通行证是固定期限的 Pro 购买，不会自动续费。",
    cancelled: "付款已取消，没有产生费用。",
    thanksPro: "谢谢支持。你的一个月 Briefly Pro 权益已生效。",
    thanks: "感谢你支持 Briefly。",
    confirmFailed: "无法确认这笔支持付款。",
    purchaseFailed: "支持购买失败。",
  },
  "zh-TW": {
    back: "返回",
    title: "支持 Briefly",
    subtitle:
      "透過一次性支持，或選擇一個月的支持者通行證，幫助 Briefly 保持獨立營運。",
    unavailableTitle: "支持選項目前無法使用",
    unavailableBody: "目前此平台尚未啟用 Briefly 支持購買。",
    smallTitle: "小額支持",
    smallBody: "一次性支持，不會改變你的 Pro 權益。",
    mediumTitle: "額外支持",
    mediumBody: "較高金額的一次性支持，幫助 Briefly 持續營運。",
    largeTitle: "慷慨支持",
    largeBody: "適合希望多支持一些的讀者。",
    passTitle: "1 個月支持者通行證",
    passBody: "一次付款即可獲得一個月 Briefly Pro，不會自動續費。",
    getPass: "取得支持者通行證",
    support: "支持 Briefly",
    alreadyPro:
      "你已經擁有 Briefly Pro，因此支持者通行證已隱藏。你仍然可以進行一次性支持。",
    terms:
      "一次性支持不會解鎖 Pro。支持者通行證是固定期限的 Pro 購買，不會自動續費。",
    cancelled: "付款已取消，沒有產生費用。",
    thanksPro: "謝謝支持。你的一個月 Briefly Pro 權益已生效。",
    thanks: "感謝你支持 Briefly。",
    confirmFailed: "無法確認這筆支持付款。",
    purchaseFailed: "支持購買失敗。",
  },
} as const;

function localizedRuntimeCopy(
  configured: string | null | undefined,
  englishDefault: string,
  localizedDefault: string,
) {
  const value = String(configured || "").trim();
  return !value || value === englishDefault ? localizedDefault : value;
}


function platformEnabled(config: ReturnType<typeof useBrieflyAppConfig>["config"]) {
  if (!config?.support_enabled) return false;
  if (Platform.OS === "web") return config.support_web_enabled;
  if (Platform.OS === "ios") return config.support_ios_enabled;
  if (Platform.OS === "android") return config.support_android_enabled;
  return false;
}

export default function SupportScreen() {
  const {
    payment,
    product,
    session_id: sessionId,
  } = useLocalSearchParams<{
    payment?: string;
    product?: BrieflySupportProduct;
    session_id?: string;
  }>();
  const { user, account, refreshAccount } = useBrieflyAuth();
  const { config } = useBrieflyAppConfig();
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const text = supportCopy[language] ?? supportCopy.en;
  const [prices, setPrices] = useState<BrieflySupportPrices>(EMPTY_PRICES);
  const [busy, setBusy] = useState<BrieflySupportProduct | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const confirmedRef = useRef(false);

  const available = platformEnabled(config);
  const tipsEnabled = available && config?.support_tip_enabled === true;
  const passEnabled =
    available &&
    config?.supporter_pass_enabled === true &&
    account?.translation_entitled !== true;

  const products = useMemo(
    () =>
      [
        tipsEnabled && {
          id: "tip_small" as const,
          title: text.smallTitle,
          body: text.smallBody,
        },
        tipsEnabled && {
          id: "tip_medium" as const,
          title: text.mediumTitle,
          body: text.mediumBody,
        },
        tipsEnabled && {
          id: "tip_large" as const,
          title: text.largeTitle,
          body: text.largeBody,
        },
        passEnabled && {
          id: "pass_1m" as const,
          title: text.passTitle,
          body: text.passBody,
        },
      ].filter(Boolean) as {
        id: BrieflySupportProduct;
        title: string;
        body: string;
      }[],
    [passEnabled, text, tipsEnabled],
  );

  useEffect(() => {
    if (!user) {
      router.replace("/sign-in?returnTo=%2Fsupport-briefly");
      return;
    }
    if (!available) return;

    let active = true;
    void getBrieflySupportPrices(user.id, config?.native_support_offering_id)
      .then((next) => {
        if (active) setPrices(next);
      })
      .catch(() => {
        if (active) setPrices(EMPTY_PRICES);
      });
    return () => {
      active = false;
    };
  }, [available, config?.native_support_offering_id, user]);

  useEffect(() => {
    if (
      !user ||
      Platform.OS !== "web" ||
      payment !== "success" ||
      !sessionId ||
      confirmedRef.current
    ) {
      return;
    }
    confirmedRef.current = true;
    setBusy(product ?? null);
    void confirmBrieflyWebSupportCheckout(sessionId)
      .then(async (result) => {
        if (result.translation_entitled) {
          await refreshAccount().catch(() => null);
        }
        trackProductEvent("support_purchase_complete", {
          properties: {
            product: product ?? "unknown",
            provider: "stripe",
            pro_granted: result.translation_entitled,
          },
        });
        await flushProductAnalytics().catch(() => undefined);
        setMessage(
          result.translation_entitled ? text.thanksPro : text.thanks,
        );
      })
      .catch((error: unknown) => {
        setMessage(
          error instanceof Error
            ? error.message
            : text.confirmFailed,
        );
      })
      .finally(() => setBusy(null));
  }, [payment, product, refreshAccount, sessionId, text, user]);

  const purchase = async (selected: BrieflySupportProduct) => {
    if (!user || busy) return;
    setBusy(selected);
    setMessage(null);
    try {
      const result = await beginBrieflySupportPurchase(
        selected,
        user.id,
        config?.native_support_offering_id,
      );
      if (!result) return;
      if (selected === "pass_1m" && result.translation_entitled) {
        await refreshAccount().catch(() => null);
        setMessage(text.thanksPro);
      } else if (selected !== "pass_1m") {
        setMessage(text.thanks);
      }
    } catch (error: unknown) {
      setMessage(
        error instanceof Error ? error.message : text.purchaseFailed,
      );
    } finally {
      if (Platform.OS !== "web") setBusy(null);
    }
  };

  if (!user) return null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.back, { color: colors.accent }]}>← {text.back}</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {localizedRuntimeCopy(
              config?.support_title,
              DEFAULT_SUPPORT_TITLE,
              text.title,
            )}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {localizedRuntimeCopy(
              config?.support_message,
              DEFAULT_SUPPORT_MESSAGE,
              text.subtitle,
            )}
          </Text>
        </View>

        {!available ? (
          <View
            style={[
              styles.card,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {text.unavailableTitle}
            </Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              {text.unavailableBody}
            </Text>
          </View>
        ) : (
          products.map((item) => (
            <View
              key={item.id}
              style={[
                styles.card,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <View style={styles.cardHeading}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {item.title}
                </Text>
                {prices[item.id] ? (
                  <Text style={[styles.price, { color: colors.accent }]}>
                    {prices[item.id]}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.body, { color: colors.textMuted }]}>
                {item.body}
              </Text>
              <Pressable
                disabled={busy !== null || !prices[item.id]}
                onPress={() => void purchase(item.id)}
                style={[
                  styles.button,
                  { backgroundColor: colors.accent },
                  (busy !== null || !prices[item.id]) && styles.disabled,
                ]}
              >
                {busy === item.id ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text
                    style={[styles.buttonText, { color: colors.background }]}
                  >
                    {item.id === "pass_1m" ? text.getPass : text.support}
                  </Text>
                )}
              </Pressable>
            </View>
          ))
        )}

        {account?.translation_entitled && config?.supporter_pass_enabled ? (
          <Text style={[styles.note, { color: colors.textMuted }]}>
            {text.alreadyPro}
          </Text>
        ) : null}

        <Text style={[styles.note, { color: colors.textMuted }]}>
          {text.terms}
        </Text>
        {payment === "cancel" ? (
          <Text style={[styles.note, { color: colors.textMuted }]}>
            {text.cancelled}
          </Text>
        ) : null}
        {message ? (
          <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    padding: 22,
    gap: 16,
  },
  back: { fontSize: 14, fontWeight: "800" },
  header: { gap: 8, marginVertical: 8 },
  title: { fontSize: 34, fontWeight: "900" },
  subtitle: { fontSize: 16, lineHeight: 23 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  cardHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "baseline",
  },
  cardTitle: { fontSize: 18, fontWeight: "900", flex: 1 },
  price: { fontSize: 17, fontWeight: "900" },
  body: { fontSize: 14, lineHeight: 21 },
  button: {
    minHeight: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonText: { fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  note: { fontSize: 13, lineHeight: 19 },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
  },
});

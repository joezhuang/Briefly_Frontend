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
  const { colors } = useBrieflyTheme();
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
          title: "Small support",
          body: "A simple one-time contribution. It does not change your Pro access.",
        },
        tipsEnabled && {
          id: "tip_medium" as const,
          title: "Extra support",
          body: "A larger one-time contribution to help fund Briefly.",
        },
        tipsEnabled && {
          id: "tip_large" as const,
          title: "Generous support",
          body: "For readers who want to contribute a little more.",
        },
        passEnabled && {
          id: "pass_1m" as const,
          title: "1-month Supporter Pass",
          body: "One payment for one month of Briefly Pro. It does not auto-renew.",
        },
      ].filter(Boolean) as Array<{
        id: BrieflySupportProduct;
        title: string;
        body: string;
      }>,
    [passEnabled, tipsEnabled],
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
          result.translation_entitled
            ? "Thank you. Your one-month Briefly Pro access is active."
            : "Thank you for supporting Briefly.",
        );
      })
      .catch((error: unknown) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to confirm this support payment.",
        );
      })
      .finally(() => setBusy(null));
  }, [payment, product, refreshAccount, sessionId, user]);

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
        setMessage("Thank you. Your one-month Briefly Pro access is active.");
      } else if (selected !== "pass_1m") {
        setMessage("Thank you for supporting Briefly.");
      }
    } catch (error: unknown) {
      setMessage(
        error instanceof Error ? error.message : "Support purchase failed.",
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
          <Text style={[styles.back, { color: colors.accent }]}>← Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {config?.support_title || "Support Briefly"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {config?.support_message ||
              "Help Briefly stay independent with a one-time contribution, or choose a one-month Supporter Pass."}
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
              Support options are currently unavailable
            </Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              Briefly support purchases are not enabled on this platform right now.
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
                    {item.id === "pass_1m"
                      ? "Get Supporter Pass"
                      : "Support Briefly"}
                  </Text>
                )}
              </Pressable>
            </View>
          ))
        )}

        {account?.translation_entitled && config?.supporter_pass_enabled ? (
          <Text style={[styles.note, { color: colors.textMuted }]}>
            You already have Briefly Pro, so Supporter Pass is hidden. You can
            still make a one-time contribution.
          </Text>
        ) : null}

        <Text style={[styles.note, { color: colors.textMuted }]}>
          One-time contributions do not unlock Pro. Supporter Pass is a
          fixed-duration Pro purchase and does not auto-renew.
        </Text>
        {payment === "cancel" ? (
          <Text style={[styles.note, { color: colors.textMuted }]}>
            Payment cancelled. No charge was made.
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

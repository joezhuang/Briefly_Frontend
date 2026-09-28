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
import { trackProductEvent } from "@/analytics/product-analytics";
import { clearBrieflyAccessToken } from "@/auth/session";
import { supabase } from "@/auth/supabase";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyAppConfig } from "@/context/app-config";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import {
  disconnectBrieflySubscriptionUser,
  manageBrieflyNativeSubscription,
  restoreBrieflySubscription,
} from "@/subscriptions";

const WEB_RETURN_URL =
  process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL?.replace(/\/$/, "") ||
  "https://briefly-news-analysis.vercel.app";

type ProPlatform = "app_store" | "play_store" | "stripe" | null;

const DEFAULT_SUPPORT_TITLE = "Support Briefly";

const accountCopy = {
  en: {
    back: "Back", title: "Account",
    subtitle: "Manage your Briefly profile, Pro access, support, and account controls.",
    signedInAs: "SIGNED IN AS", notSignedIn: "Not signed in", free: "FREE",
    providerWeb: "Web", providerUnknown: "Unknown",
    trialing: "Trial active", active: "Active", canceling: "Cancelled",
    gracePeriod: "Payment issue — grace period", pastDue: "Payment issue", expired: "Expired", freeLifecycle: "Free",
    yearly: "Yearly", monthly: "Monthly", renews: "Renews", accessUntil: "Access until", graceUntil: "Grace period until",
    manageSubscription: "Manage subscription",
    manageSubscriptionBody: "Manage billing, renewal, or cancellation through the provider where your Briefly Pro subscription was purchased.",
    expiredPro: "Your previous Briefly Pro subscription has expired. You can subscribe again at any time.",
    viewPro: "View Briefly Pro features, current monthly and yearly prices, and available offers.",
    viewPlans: "View Briefly Pro plans",
    supportTitle: DEFAULT_SUPPORT_TITLE,
    supportBody: "Make a one-time contribution, or choose a one-month Supporter Pass with no automatic renewal.",
    supportOptions: "View support options",
    accountAccess: "Account access", signOutBody: "Sign out of Briefly on this device.", signOut: "Sign out",
    restorePurchases: "Restore purchases",
    restoreBody: "Restore an existing Briefly Pro entitlement associated with this account. No purchase is made.",
    deleteAccount: "Delete account",
    deleteBody: "Permanently delete Briefly-owned account data and access. If your sign-in is shared with Deeply, Deeply account data is preserved. Deleting Briefly does not automatically cancel a subscription billed by Apple, Google, or Stripe.",
    deleteTitle: "Delete Briefly account?",
    deleteWarning: "This permanently deletes your Briefly data and Briefly access. If this sign-in is also used by Deeply, your Deeply account and Deeply data are kept. Your store subscription is managed separately by Apple, Google, or Stripe and may need to be cancelled there.",
    cancel: "Cancel", signOutFailed: "Sign out failed.",
    noActiveTitle: "No active subscription", noActiveBody: "No active Briefly Pro billing source was found for this account.",
    appleTitle: "Purchased through Apple",
    appleBody: "Your Briefly Pro subscription was purchased through Apple. Manage or cancel it using the Apple Account/App Store associated with that purchase.",
    googleTitle: "Purchased through Google Play",
    googleBody: "Your Briefly Pro subscription was purchased through Google Play. Manage or cancel it in Google Play using the Google Account associated with that purchase.",
    manageFailed: "Unable to open subscription management.",
    restoreSuccess: "Your Briefly Pro purchase has been restored.",
    restoreNone: "No active Briefly Pro purchase was found for this account.",
    restoreFailed: "Restore failed.", deleteFailed: "Account deletion failed.",
  },
  es: {
    back: "Atrás", title: "Cuenta",
    subtitle: "Gestiona tu perfil de Briefly, acceso Pro, apoyo y controles de cuenta.",
    signedInAs: "SESIÓN INICIADA COMO", notSignedIn: "Sin sesión iniciada", free: "GRATIS",
    providerWeb: "Web", providerUnknown: "Desconocido",
    trialing: "Prueba activa", active: "Activo", canceling: "Cancelado",
    gracePeriod: "Problema de pago — periodo de gracia", pastDue: "Problema de pago", expired: "Caducado", freeLifecycle: "Gratis",
    yearly: "Anual", monthly: "Mensual", renews: "Renueva", accessUntil: "Acceso hasta", graceUntil: "Periodo de gracia hasta",
    manageSubscription: "Gestionar suscripción",
    manageSubscriptionBody: "Gestiona la facturación, renovación o cancelación con el proveedor donde compraste Briefly Pro.",
    expiredPro: "Tu suscripción anterior a Briefly Pro ha caducado. Puedes volver a suscribirte cuando quieras.",
    viewPro: "Consulta las funciones de Briefly Pro, los precios mensuales y anuales actuales y las ofertas disponibles.",
    viewPlans: "Ver planes de Briefly Pro",
    supportTitle: "Apoya a Briefly",
    supportBody: "Haz una contribución única o elige un Pase de Colaborador de un mes sin renovación automática.",
    supportOptions: "Ver opciones de apoyo",
    accountAccess: "Acceso a la cuenta", signOutBody: "Cierra sesión de Briefly en este dispositivo.", signOut: "Cerrar sesión",
    restorePurchases: "Restaurar compras",
    restoreBody: "Restaura un acceso Briefly Pro existente asociado a esta cuenta. No se realizará ninguna compra.",
    deleteAccount: "Eliminar cuenta",
    deleteBody: "Elimina permanentemente los datos y el acceso de Briefly. Si este inicio de sesión también se usa con Deeply, los datos de Deeply se conservan. Eliminar Briefly no cancela automáticamente una suscripción facturada por Apple, Google o Stripe.",
    deleteTitle: "¿Eliminar la cuenta de Briefly?",
    deleteWarning: "Esto elimina permanentemente tus datos y acceso de Briefly. Si este inicio de sesión también se usa con Deeply, tu cuenta y datos de Deeply se conservan. La suscripción de la tienda se gestiona por separado mediante Apple, Google o Stripe y quizá debas cancelarla allí.",
    cancel: "Cancelar", signOutFailed: "No se pudo cerrar la sesión.",
    noActiveTitle: "No hay una suscripción activa", noActiveBody: "No se encontró una fuente de facturación activa de Briefly Pro para esta cuenta.",
    appleTitle: "Comprado mediante Apple", appleBody: "Tu suscripción a Briefly Pro se compró mediante Apple. Gestiónala o cancélala con la cuenta de Apple/App Store asociada a esa compra.",
    googleTitle: "Comprado mediante Google Play", googleBody: "Tu suscripción a Briefly Pro se compró mediante Google Play. Gestiónala o cancélala en Google Play con la cuenta de Google asociada a esa compra.",
    manageFailed: "No se pudo abrir la gestión de la suscripción.",
    restoreSuccess: "Tu compra de Briefly Pro se ha restaurado.", restoreNone: "No se encontró una compra activa de Briefly Pro para esta cuenta.",
    restoreFailed: "No se pudo restaurar la compra.", deleteFailed: "No se pudo eliminar la cuenta.",
  },
  ja: {
    back: "戻る", title: "アカウント",
    subtitle: "Brieflyのプロフィール、Proアクセス、支援、アカウント操作を管理します。",
    signedInAs: "ログイン中", notSignedIn: "未ログイン", free: "無料",
    providerWeb: "Web", providerUnknown: "不明",
    trialing: "無料トライアル中", active: "有効", canceling: "解約済み",
    gracePeriod: "支払いの問題 — 猶予期間", pastDue: "支払いの問題", expired: "期限切れ", freeLifecycle: "無料",
    yearly: "年額", monthly: "月額", renews: "更新日", accessUntil: "利用期限", graceUntil: "猶予期間",
    manageSubscription: "サブスクリプションを管理",
    manageSubscriptionBody: "Briefly Proを購入したプロバイダーで、請求、更新、解約を管理できます。",
    expiredPro: "以前のBriefly Proサブスクリプションは期限切れです。いつでも再登録できます。",
    viewPro: "Briefly Proの機能、現在の月額・年額料金、利用可能なオファーを確認できます。",
    viewPlans: "Briefly Proプランを見る",
    supportTitle: "Brieflyを応援",
    supportBody: "一度限りの支援、または自動更新のない1か月サポーターパスを選べます。",
    supportOptions: "支援オプションを見る",
    accountAccess: "アカウントアクセス", signOutBody: "この端末でBrieflyからログアウトします。", signOut: "ログアウト",
    restorePurchases: "購入を復元",
    restoreBody: "このアカウントに関連付けられた既存のBriefly Pro権利を復元します。新しい購入は行われません。",
    deleteAccount: "アカウントを削除",
    deleteBody: "Brieflyが保有するアカウントデータとアクセスを完全に削除します。同じログインをDeeplyでも使用している場合、Deeplyのアカウントとデータは保持されます。Brieflyを削除しても、Apple、Google、Stripe経由のサブスクリプションは自動的に解約されません。",
    deleteTitle: "Brieflyアカウントを削除しますか？",
    deleteWarning: "Brieflyのデータとアクセスは完全に削除されます。同じログインをDeeplyでも使用している場合、Deeplyのアカウントとデータは保持されます。ストアのサブスクリプションはApple、Google、Stripeで別途管理されており、そちらで解約が必要な場合があります。",
    cancel: "キャンセル", signOutFailed: "ログアウトできませんでした。",
    noActiveTitle: "有効なサブスクリプションがありません", noActiveBody: "このアカウントに有効なBriefly Proの請求元が見つかりませんでした。",
    appleTitle: "Appleで購入", appleBody: "Briefly ProはApple経由で購入されています。購入に使用したApple Account/App Storeで管理または解約してください。",
    googleTitle: "Google Playで購入", googleBody: "Briefly ProはGoogle Play経由で購入されています。購入に使用したGoogleアカウントでGoogle Playから管理または解約してください。",
    manageFailed: "サブスクリプション管理を開けませんでした。",
    restoreSuccess: "Briefly Proの購入を復元しました。", restoreNone: "このアカウントに有効なBriefly Proの購入が見つかりませんでした。",
    restoreFailed: "購入を復元できませんでした。", deleteFailed: "アカウントを削除できませんでした。",
  },
  "zh-CN": {
    back: "返回", title: "账户",
    subtitle: "管理你的 Briefly 资料、Pro 权益、支持和账户操作。",
    signedInAs: "当前登录账户", notSignedIn: "未登录", free: "免费",
    providerWeb: "网页", providerUnknown: "未知",
    trialing: "试用中", active: "有效", canceling: "已取消",
    gracePeriod: "付款问题 — 宽限期", pastDue: "付款问题", expired: "已过期", freeLifecycle: "免费",
    yearly: "年付", monthly: "月付", renews: "续费", accessUntil: "可使用至", graceUntil: "宽限期至",
    manageSubscription: "管理订阅",
    manageSubscriptionBody: "请通过购买 Briefly Pro 时使用的服务商管理付款、续费或取消。",
    expiredPro: "你之前的 Briefly Pro 订阅已过期，可随时重新订阅。",
    viewPro: "查看 Briefly Pro 功能、当前月付和年付价格以及可用优惠。",
    viewPlans: "查看 Briefly Pro 方案",
    supportTitle: "支持 Briefly", supportBody: "可进行一次性支持，或选择不会自动续费的一个月支持者通行证。", supportOptions: "查看支持选项",
    accountAccess: "账户访问", signOutBody: "在此设备上退出 Briefly。", signOut: "退出登录",
    restorePurchases: "恢复购买", restoreBody: "恢复与此账户关联的现有 Briefly Pro 权益，不会产生新的购买。",
    deleteAccount: "删除账户",
    deleteBody: "永久删除由 Briefly 持有的账户数据和访问权限。如果同一登录也用于 Deeply，Deeply 账户和数据会保留。删除 Briefly 不会自动取消由 Apple、Google 或 Stripe 计费的订阅。",
    deleteTitle: "删除 Briefly 账户？",
    deleteWarning: "这将永久删除你的 Briefly 数据和访问权限。如果同一登录也用于 Deeply，Deeply 账户和数据会保留。商店订阅由 Apple、Google 或 Stripe 单独管理，可能仍需在对应平台取消。",
    cancel: "取消", signOutFailed: "退出登录失败。",
    noActiveTitle: "没有有效订阅", noActiveBody: "未找到此账户有效的 Briefly Pro 计费来源。",
    appleTitle: "通过 Apple 购买", appleBody: "你的 Briefly Pro 订阅是通过 Apple 购买的。请使用与该购买关联的 Apple Account/App Store 管理或取消。",
    googleTitle: "通过 Google Play 购买", googleBody: "你的 Briefly Pro 订阅是通过 Google Play 购买的。请使用与该购买关联的 Google 账户在 Google Play 中管理或取消。",
    manageFailed: "无法打开订阅管理。", restoreSuccess: "已恢复你的 Briefly Pro 购买。", restoreNone: "未找到此账户有效的 Briefly Pro 购买。",
    restoreFailed: "恢复购买失败。", deleteFailed: "删除账户失败。",
  },
  "zh-TW": {
    back: "返回", title: "帳戶",
    subtitle: "管理你的 Briefly 資料、Pro 權益、支持與帳戶操作。",
    signedInAs: "目前登入帳戶", notSignedIn: "未登入", free: "免費",
    providerWeb: "網頁", providerUnknown: "未知",
    trialing: "試用中", active: "有效", canceling: "已取消",
    gracePeriod: "付款問題 — 寬限期", pastDue: "付款問題", expired: "已過期", freeLifecycle: "免費",
    yearly: "年繳", monthly: "月繳", renews: "續費", accessUntil: "可使用至", graceUntil: "寬限期至",
    manageSubscription: "管理訂閱",
    manageSubscriptionBody: "請透過購買 Briefly Pro 時使用的服務商管理付款、續費或取消。",
    expiredPro: "你先前的 Briefly Pro 訂閱已過期，可隨時重新訂閱。",
    viewPro: "查看 Briefly Pro 功能、目前月繳和年繳價格以及可用優惠。",
    viewPlans: "查看 Briefly Pro 方案",
    supportTitle: "支持 Briefly", supportBody: "可進行一次性支持，或選擇不會自動續費的一個月支持者通行證。", supportOptions: "查看支持選項",
    accountAccess: "帳戶存取", signOutBody: "在此裝置上登出 Briefly。", signOut: "登出",
    restorePurchases: "恢復購買", restoreBody: "恢復與此帳戶關聯的現有 Briefly Pro 權益，不會產生新的購買。",
    deleteAccount: "刪除帳戶",
    deleteBody: "永久刪除由 Briefly 持有的帳戶資料與存取權。如果同一登入也用於 Deeply，Deeply 帳戶與資料會保留。刪除 Briefly 不會自動取消由 Apple、Google 或 Stripe 計費的訂閱。",
    deleteTitle: "刪除 Briefly 帳戶？",
    deleteWarning: "這將永久刪除你的 Briefly 資料與存取權。如果同一登入也用於 Deeply，Deeply 帳戶與資料會保留。商店訂閱由 Apple、Google 或 Stripe 分開管理，可能仍需在對應平台取消。",
    cancel: "取消", signOutFailed: "登出失敗。",
    noActiveTitle: "沒有有效訂閱", noActiveBody: "找不到此帳戶有效的 Briefly Pro 計費來源。",
    appleTitle: "透過 Apple 購買", appleBody: "你的 Briefly Pro 訂閱是透過 Apple 購買的。請使用與該購買關聯的 Apple Account/App Store 管理或取消。",
    googleTitle: "透過 Google Play 購買", googleBody: "你的 Briefly Pro 訂閱是透過 Google Play 購買的。請使用與該購買關聯的 Google 帳戶在 Google Play 中管理或取消。",
    manageFailed: "無法開啟訂閱管理。", restoreSuccess: "已恢復你的 Briefly Pro 購買。", restoreNone: "找不到此帳戶有效的 Briefly Pro 購買。",
    restoreFailed: "恢復購買失敗。", deleteFailed: "刪除帳戶失敗。",
  },
} as const;

function localizedSupportTitle(configured: string | null | undefined, localizedDefault: string) {
  const value = String(configured || "").trim();
  return !value || value === DEFAULT_SUPPORT_TITLE ? localizedDefault : value;
}


function providerLabel(platform: ProPlatform, text: (typeof accountCopy)["en"]) {
  if (platform === "stripe") return text.providerWeb;
  if (platform === "app_store") return "App Store";
  if (platform === "play_store") return "Google Play";
  return text.providerUnknown;
}

function lifecycleLabel(status: BrieflySubscriptionStatus | null, text: (typeof accountCopy)["en"]) {
  switch (status?.lifecycle_state) {
    case "trialing": return text.trialing;
    case "active": return text.active;
    case "canceling": return text.canceling;
    case "grace_period": return text.gracePeriod;
    case "past_due": return text.pastDue;
    case "expired": return text.expired;
    default: return text.freeLifecycle;
  }
}

function formatLifecycleDate(value: string | null | undefined, language: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export default function AccountScreen() {
  const { user, account, refreshAccount, signOut } = useBrieflyAuth();
  const { config: appConfig } = useBrieflyAppConfig();
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const text = accountCopy[language] ?? accountCopy.en;
  const supportAvailable =
    appConfig?.support_enabled === true &&
    (Platform.OS === "web"
      ? appConfig.support_web_enabled
      : Platform.OS === "ios"
        ? appConfig.support_ios_enabled
        : appConfig.support_android_enabled);
  const [busy, setBusy] = useState<
    "manage" | "restore" | "delete" | "signout" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [subscriptionSnapshot, setSubscriptionSnapshot] = useState<{
    userId: string;
    status: BrieflySubscriptionStatus;
  } | null>(null);
  const subscriptionStatus =
    user && subscriptionSnapshot?.userId === user.id
      ? subscriptionSnapshot.status
      : null;
  const subscriptionIsPro = user
    ? (subscriptionStatus?.is_pro ?? account?.translation_entitled === true)
    : false;

  useEffect(() => {
    if (!user) return;

    let active = true;
    const userId = user.id;

    void getBrieflySubscriptionStatus()
      .then((status) => {
        if (active) {
          setSubscriptionSnapshot({ userId, status });
        }
      })
      .catch(() => {
        // Keep the account-level entitlement as the fallback if lifecycle
        // details are temporarily unavailable.
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
      setMessage(error instanceof Error ? error.message : text.signOutFailed);
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
        notify(text.noActiveTitle, text.noActiveBody);
        return;
      }

      if (platform === "stripe") {
        const portal = await createBrieflyWebPortal(`${WEB_RETURN_URL}/account`);
        await Linking.openURL(portal.portal_url);
        trackProductEvent("subscription_manage_open", {
          properties: { provider: "stripe", surface: "account" },
        });
        return;
      }

      if (platform === "app_store") {
        if (Platform.OS !== "ios") {
          notify(text.appleTitle, text.appleBody);
          return;
        }
        await manageBrieflyNativeSubscription(user.id);
        trackProductEvent("subscription_manage_open", {
          properties: { provider: "app_store", surface: "account" },
        });
        return;
      }

      if (platform === "play_store") {
        if (Platform.OS !== "android") {
          notify(text.googleTitle, text.googleBody);
          return;
        }
        await manageBrieflyNativeSubscription(user.id);
        trackProductEvent("subscription_manage_open", {
          properties: { provider: "play_store", surface: "account" },
        });
      }
    } catch (error: unknown) {
      setMessage(
        error instanceof Error ? error.message : text.manageFailed,
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
    const provider =
      Platform.OS === "web"
        ? "stripe"
        : Platform.OS === "ios"
          ? "app_store"
          : "play_store";
    trackProductEvent("subscription_restore_start", {
      properties: { provider, surface: "account" },
    });

    try {
      const active =
        Platform.OS === "web"
          ? (await syncBrieflyWebSubscription()).translation_entitled
          : await restoreBrieflySubscription(user.id);

      trackProductEvent("subscription_restore_complete", {
        properties: { provider, surface: "account", active },
      });
      await refreshAccount().catch(() => null);
      setMessage(active ? text.restoreSuccess : text.restoreNone);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : text.restoreFailed);
    } finally {
      setBusy(null);
    }
  };

  const performDelete = async () => {
    setBusy("delete");
    setMessage(null);
    try {
      await deleteBrieflyAccount();
      if (Platform.OS === "ios" || Platform.OS === "android") {
        await disconnectBrieflySubscriptionUser().catch(() => null);
      }
      clearBrieflyAccessToken();
      if (supabase) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => null);
      }
      router.replace("/");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : text.deleteFailed);
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () => {
    const warning = text.deleteWarning;

    if (Platform.OS === "web") {
      if (window.confirm(warning)) void performDelete();
      return;
    }

    Alert.alert(text.deleteTitle, warning, [
      { text: text.cancel, style: "cancel" },
      {
        text: text.deleteAccount,
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
            <Text style={[styles.back, { color: colors.accent }]}>← {text.back}</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{text.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {text.subtitle}
          </Text>
          <View style={[styles.identityRow, { borderBottomColor: colors.border }]}>
            <View style={styles.identityCopy}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{text.signedInAs}</Text>
              <Text style={[styles.value, { color: colors.text }]}>{user?.email ?? text.notSignedIn}</Text>
            </View>
            <Text
              style={[
                styles.accountStatus,
                { color: subscriptionIsPro ? colors.accent : colors.textMuted },
              ]}
            >
              {subscriptionIsPro ? "PRO" : text.free}
            </Text>
          </View>
        </View>

        {subscriptionIsPro ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{text.manageSubscription}</Text>

            <View style={styles.subscriptionSummary}>
              <Text style={[styles.subscriptionState, { color: colors.text }]}>
                {lifecycleLabel(subscriptionStatus, text)}
              </Text>
              {subscriptionStatus?.provider ? (
                <Text style={[styles.subscriptionMeta, { color: colors.textMuted }]}>
                  {providerLabel(subscriptionStatus.provider, text)}
                  {subscriptionStatus.plan
                    ? ` · ${subscriptionStatus.plan === "yearly" ? text.yearly : subscriptionStatus.plan === "monthly" ? text.monthly : subscriptionStatus.plan}`
                    : ""}
                </Text>
              ) : null}

              {subscriptionStatus?.renews_at ? (
                <Text style={[styles.subscriptionMeta, { color: colors.textMuted }]}>
                  {text.renews} {formatLifecycleDate(subscriptionStatus.renews_at, language)}
                </Text>
              ) : null}

              {subscriptionStatus?.lifecycle_state === "canceling" &&
              subscriptionStatus.access_until ? (
                <Text style={[styles.subscriptionMeta, { color: colors.textMuted }]}>
                  {text.accessUntil} {formatLifecycleDate(subscriptionStatus.access_until, language)}
                </Text>
              ) : null}

              {subscriptionStatus?.lifecycle_state === "grace_period" &&
              subscriptionStatus.access_until ? (
                <Text style={[styles.subscriptionMeta, { color: colors.textMuted }]}>
                  {text.graceUntil} {formatLifecycleDate(subscriptionStatus.access_until, language)}
                </Text>
              ) : null}
            </View>

            <Text style={[styles.body, { color: colors.textMuted }]}>{text.manageSubscriptionBody}</Text>
            <Pressable disabled={busy !== null} onPress={() => void manageSubscription()} style={[styles.button, { borderColor: colors.border }, busy !== null && styles.disabled]}>
              {busy === "manage" ? <ActivityIndicator color={colors.text} /> : <Text style={[styles.buttonText, { color: colors.text }]}>{text.manageSubscription}</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Briefly Pro</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              {subscriptionStatus?.lifecycle_state === "expired"
                ? text.expiredPro
                : text.viewPro}
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
                {text.viewPlans}
              </Text>
            </Pressable>
          </View>
        )}

        {supportAvailable ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {localizedSupportTitle(appConfig?.support_title, text.supportTitle)}
            </Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              {text.supportBody}
            </Text>
            <Pressable
              disabled={!user || busy !== null}
              onPress={() => router.push("/support-briefly")}
              style={[
                styles.button,
                { borderColor: colors.border },
                (!user || busy !== null) && styles.disabled,
              ]}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>
                {text.supportOptions}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{text.accountAccess}</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>{text.signOutBody}</Text>
          <Pressable disabled={!user || busy !== null} onPress={() => void handleSignOut()} style={[styles.button, { borderColor: colors.border }, (!user || busy !== null) && styles.disabled]}>
            {busy === "signout" ? <ActivityIndicator color={colors.text} /> : <Text style={[styles.buttonText, { color: colors.text }]}>{text.signOut}</Text>}
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{text.restorePurchases}</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>{text.restoreBody}</Text>
          <Pressable disabled={busy !== null} onPress={() => void restore()} style={[styles.button, { borderColor: colors.border }, busy !== null && styles.disabled]}>
            {busy === "restore" ? <ActivityIndicator color={colors.text} /> : <Text style={[styles.buttonText, { color: colors.text }]}>{text.restorePurchases}</Text>}
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{text.deleteAccount}</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>{text.deleteBody}</Text>
          <Pressable disabled={!user || busy !== null} onPress={confirmDelete} style={[styles.dangerButton, { borderColor: "#c83b3b" }, (!user || busy !== null) && styles.disabled]}>
            {busy === "delete" ? <ActivityIndicator color="#c83b3b" /> : <Text style={styles.dangerText}>{text.deleteAccount}</Text>}
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
  identityRow: { minHeight: 64, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  identityCopy: { flex: 1, gap: 4 },
  accountStatus: { fontSize: 11, fontWeight: "900", letterSpacing: 0.9 },
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

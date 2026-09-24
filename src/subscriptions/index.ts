import { Linking, Platform } from "react-native";
import Purchases from "react-native-purchases";

import {
  getBrieflyPurchaseEligibility,
  syncBrieflyNativeSubscription,
} from "@/api/account";

export type BrieflyPlan = "monthly" | "yearly";

export type BrieflyPlanPrices = {
  monthly: string | null;
  yearly: string | null;
};

let purchasesConfigured = false;
let configuredUserId: string | null = null;

function apiKey() {
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
  }
  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim();
  }
  return undefined;
}

function entitlementIdentifier() {
  return (
    process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() ||
    "briefly_pro"
  );
}

function purchaseSourceLabel(
  platform: "stripe" | "app_store" | "play_store" | null,
) {
  if (platform === "stripe") return "the web";
  if (platform === "app_store") return "the App Store";
  if (platform === "play_store") return "Google Play";
  return "another platform";
}

function packageIdentifier(plan: BrieflyPlan) {
  if (plan === "monthly") {
    return (
      process.env.EXPO_PUBLIC_REVENUECAT_MONTHLY_PACKAGE_ID?.trim() ||
      "$rc_monthly"
    );
  }

  return (
    process.env.EXPO_PUBLIC_REVENUECAT_YEARLY_PACKAGE_ID?.trim() ||
    "$rc_annual"
  );
}

async function ensureConfigured(userId: string) {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw new Error("RevenueCat native purchases are only available on iOS and Android.");
  }

  const key = apiKey();
  if (!key) {
    throw new Error("RevenueCat is not configured for this platform.");
  }

  if (purchasesConfigured && configuredUserId === userId) return;

  if (!purchasesConfigured) {
    console.info(
      `[Briefly RevenueCat] configure platform=${Platform.OS} user=${userId}`,
    );
    Purchases.configure({
      apiKey: key,
      appUserID: userId,
    });
    purchasesConfigured = true;
    configuredUserId = userId;
    return;
  }

  console.info(`[Briefly RevenueCat] logIn user=${userId}`);
  await Purchases.logIn(userId);
  configuredUserId = userId;
}

function hasBrieflyPro(customerInfo: {
  entitlements: { active: Record<string, unknown> };
}) {
  return Boolean(
    customerInfo.entitlements.active[entitlementIdentifier()],
  );
}

function activeEntitlementIds(customerInfo: {
  entitlements: { active: Record<string, unknown> };
}) {
  return Object.keys(customerInfo.entitlements.active || {});
}

async function syncPurchaseStateWithBackend(active: boolean) {
  // RevenueCat webhooks remain the durable source of truth. Always reconcile
  // signed-in native state, including a negative entitlement, so stale backend
  // Pro flags are revoked after expiry or transfer.
  try {
    console.info(
      `[Briefly RevenueCat] syncing entitlement state with backend active=${active}`,
    );
    const result = await syncBrieflyNativeSubscription();
    console.info(
      `[Briefly RevenueCat] backend sync success entitled=${result.translation_entitled} platform=${result.briefly_pro_platform ?? "none"}`,
    );
  } catch (error) {
    // Do not turn a completed App Store / Play Store purchase into a purchase
    // failure. The webhook may still reconcile it, but keep the failure visible.
    console.error("[Briefly RevenueCat] backend sync failed", error);
  }
}

export function isRevenueCatPurchaseCancelled(error: unknown) {
  if (!error || typeof error !== "object") return false;
  return Boolean(
    "userCancelled" in error &&
      (error as { userCancelled?: boolean }).userCancelled === true,
  );
}

export async function getBrieflySubscriptionStatus(userId: string) {
  await ensureConfigured(userId);
  const customerInfo = await Purchases.getCustomerInfo();
  const active = hasBrieflyPro(customerInfo);
  console.info(
    `[Briefly RevenueCat] status user=${userId} active=${active} entitlements=${activeEntitlementIds(customerInfo).join(",") || "none"}`,
  );
  await syncPurchaseStateWithBackend(active);
  return active;
}

export async function getBrieflyPlanPrices(
  userId: string,
  offeringIdentifier?: string | null,
): Promise<BrieflyPlanPrices> {
  await ensureConfigured(userId);

  const offerings = await Purchases.getOfferings();
  const requestedOffering = offeringIdentifier?.trim() || null;
  const offering = requestedOffering
    ? offerings.all[requestedOffering]
    : offerings.current;

  if (!offering) {
    return { monthly: null, yearly: null };
  }

  const priceFor = (plan: BrieflyPlan) => {
    const identifier = packageIdentifier(plan);
    const selected = offering.availablePackages.find(
      (item) => item.identifier === identifier,
    );
    return selected?.product?.priceString ?? null;
  };

  return {
    monthly: priceFor("monthly"),
    yearly: priceFor("yearly"),
  };
}

export async function beginBrieflySubscription(
  plan: BrieflyPlan,
  userId: string,
  offeringIdentifier?: string | null,
) {
  const eligibility = await getBrieflyPurchaseEligibility();
  if (!eligibility.can_purchase) {
    const source = purchaseSourceLabel(eligibility.briefly_pro_platform);
    throw new Error(
      `Briefly Pro is already active through ${source}. Another subscription was not started.`,
    );
  }

  await ensureConfigured(userId);

  const offerings = await Purchases.getOfferings();
  const requestedOffering = offeringIdentifier?.trim() || null;
  const offering = requestedOffering
    ? offerings.all[requestedOffering]
    : offerings.current;
  if (!offering) {
    throw new Error(
      requestedOffering
        ? `RevenueCat offering ${requestedOffering} is not available.`
        : "No Briefly subscription offering is available.",
    );
  }

  const identifier = packageIdentifier(plan);
  const selected = offering.availablePackages.find(
    (item) => item.identifier === identifier,
  );

  console.info(
    `[Briefly RevenueCat] purchase requested user=${userId} plan=${plan} offering=${offering.identifier} package=${identifier} available=${offering.availablePackages.map((item) => item.identifier).join(",") || "none"}`,
  );

  if (!selected) {
    throw new Error(
      `RevenueCat package ${identifier} is not available in the current offering.`,
    );
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(selected);
    const active = hasBrieflyPro(customerInfo);
    console.info(
      `[Briefly RevenueCat] purchase completed user=${userId} plan=${plan} active=${active} entitlements=${activeEntitlementIds(customerInfo).join(",") || "none"}`,
    );
    await syncPurchaseStateWithBackend(active);
    return active;
  } catch (error: unknown) {
    if (isRevenueCatPurchaseCancelled(error)) {
      console.info(
        `[Briefly RevenueCat] purchase cancelled user=${userId} plan=${plan}`,
      );
      return false;
    }
    console.error(
      `[Briefly RevenueCat] purchase failed user=${userId} plan=${plan}`,
      error,
    );
    throw error;
  }
}

export async function redeemBrieflyOfferCode(userId: string) {
  await ensureConfigured(userId);
  if (Platform.OS !== "ios") {
    throw new Error("Offer-code redemption is only available on iOS.");
  }

  console.info(`[Briefly RevenueCat] presenting iOS offer-code redemption user=${userId}`);
  await Purchases.presentCodeRedemptionSheet();
  const { customerInfo } = await Purchases.syncPurchasesForResult();
  const active = hasBrieflyPro(customerInfo);
  await syncPurchaseStateWithBackend(active);
  return active;
}

export async function restoreBrieflySubscription(userId: string) {
  await ensureConfigured(userId);
  console.info(`[Briefly RevenueCat] restore requested user=${userId}`);
  const customerInfo = await Purchases.restorePurchases();
  const active = hasBrieflyPro(customerInfo);
  console.info(
    `[Briefly RevenueCat] restore completed user=${userId} active=${active} entitlements=${activeEntitlementIds(customerInfo).join(",") || "none"}`,
  );
  await syncPurchaseStateWithBackend(active);
  return active;
}

export async function manageBrieflyNativeSubscription(userId: string) {
  await ensureConfigured(userId);

  const customerInfo = await Purchases.getCustomerInfo();
  if (!hasBrieflyPro(customerInfo)) {
    throw new Error("No active Briefly Pro store subscription was found.");
  }

  if (Platform.OS === "ios") {
    // Present StoreKit's native management sheet. This is important for
    // TestFlight/sandbox purchases, which may not appear on the generic
    // production App Store subscriptions URL.
    await Purchases.showManageSubscriptions();
    return;
  }

  const managementURL = customerInfo.managementURL;
  if (!managementURL) {
    throw new Error(
      "Google Play did not provide a subscription management link for this purchase.",
    );
  }

  await Linking.openURL(managementURL);
}

export async function disconnectBrieflySubscriptionUser() {
  if (
    (Platform.OS !== "ios" && Platform.OS !== "android") ||
    !purchasesConfigured ||
    configuredUserId === null
  ) {
    return;
  }

  console.info(
    `[Briefly RevenueCat] logOut user=${configuredUserId} platform=${Platform.OS}`,
  );
  await Purchases.logOut();
  configuredUserId = null;
}

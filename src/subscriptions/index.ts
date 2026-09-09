import { Platform } from "react-native";
import Purchases from "react-native-purchases";

export type BrieflyPlan = "monthly" | "yearly";

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

  if (configuredUserId === userId) return;

  if (configuredUserId === null) {
    Purchases.configure({
      apiKey: key,
      appUserID: userId,
    });
  } else {
    await Purchases.logIn(userId);
  }

  configuredUserId = userId;
}

function hasBrieflyPro(customerInfo: {
  entitlements: { active: Record<string, unknown> };
}) {
  return Boolean(
    customerInfo.entitlements.active[entitlementIdentifier()],
  );
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
  return hasBrieflyPro(customerInfo);
}

export async function beginBrieflySubscription(
  plan: BrieflyPlan,
  userId: string,
) {
  await ensureConfigured(userId);

  const offerings = await Purchases.getOfferings();
  const offering = offerings.current;
  if (!offering) {
    throw new Error("No Briefly subscription offering is available.");
  }

  const identifier = packageIdentifier(plan);
  const selected = offering.availablePackages.find(
    (item) => item.identifier === identifier,
  );

  if (!selected) {
    throw new Error(
      `RevenueCat package ${identifier} is not available in the current offering.`,
    );
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(selected);
    return hasBrieflyPro(customerInfo);
  } catch (error: unknown) {
    if (isRevenueCatPurchaseCancelled(error)) return false;
    throw error;
  }
}

export async function restoreBrieflySubscription(userId: string) {
  await ensureConfigured(userId);
  const customerInfo = await Purchases.restorePurchases();
  return hasBrieflyPro(customerInfo);
}

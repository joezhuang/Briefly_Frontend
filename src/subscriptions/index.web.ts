import {
  createBrieflyWebCheckout,
  createBrieflyWebPortal,
  getBrieflyWebPrices,
  type BrieflyWebPrice,
} from "@/api/briefly";
import {
  flushProductAnalytics,
  trackProductEvent,
} from "@/analytics/product-analytics";

export type BrieflyPlan = "monthly" | "yearly";

export type BrieflyPlanPrices = {
  monthly: string | null;
  yearly: string | null;
};

function formatWebPrice(price: BrieflyWebPrice) {
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: price.currency,
    });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
    return formatter.format(price.unit_amount / 10 ** fractionDigits);
  } catch {
    return `${price.currency} ${price.unit_amount}`;
  }
}

export async function getBrieflySubscriptionStatus(_userId: string) {
  // Native RevenueCat state is not used by the web build.
  return false;
}

export async function getBrieflyPlanPrices(
  _userId: string,
  _offeringIdentifier?: string | null,
): Promise<BrieflyPlanPrices> {
  const prices = await getBrieflyWebPrices();
  return {
    monthly: formatWebPrice(prices.monthly),
    yearly: formatWebPrice(prices.yearly),
  };
}

export async function beginBrieflySubscription(
  plan: BrieflyPlan,
  _userId: string,
  _offeringIdentifier?: string | null,
) {
  const origin = window.location.origin;
  const result = await createBrieflyWebCheckout(
    plan,
    `${origin}/upgrade?payment=success&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
    `${origin}/upgrade?payment=cancel&plan=${plan}`,
  );

  trackProductEvent("subscription_checkout_start", {
    properties: { plan, provider: "stripe" },
  });
  await flushProductAnalytics().catch(() => undefined);
  window.location.assign(result.checkout_url);
  return false;
}

export async function redeemBrieflyOfferCode(_userId: string) {
  throw new Error("Web promotion codes are redeemed in Stripe Checkout.");
}

export async function restoreBrieflySubscription(_userId: string) {
  const origin = window.location.origin;
  const result = await createBrieflyWebPortal(`${origin}/upgrade`);
  trackProductEvent("subscription_manage_open", {
    properties: { provider: "stripe", surface: "upgrade" },
  });
  await flushProductAnalytics().catch(() => undefined);
  window.location.assign(result.portal_url);
  return false;
}

export async function manageBrieflyNativeSubscription(_userId: string) {
  throw new Error("Native subscription management is unavailable on web.");
}

export async function disconnectBrieflySubscriptionUser() {
  // Native RevenueCat identity is not used by the web build.
}

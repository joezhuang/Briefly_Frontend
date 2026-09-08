import {
  createBrieflyWebCheckout,
  createBrieflyWebPortal,
} from "@/api/briefly";

export type BrieflyPlan = "monthly" | "yearly";

export async function beginBrieflySubscription(
  plan: BrieflyPlan,
  _userId: string,
) {
  const origin = window.location.origin;
  const result = await createBrieflyWebCheckout(
    plan,
    `${origin}/upgrade?payment=success`,
    `${origin}/upgrade?payment=cancel`,
  );

  window.location.assign(result.checkout_url);
  return false;
}

export async function restoreBrieflySubscription(_userId: string) {
  const origin = window.location.origin;
  const result = await createBrieflyWebPortal(`${origin}/upgrade`);
  window.location.assign(result.portal_url);
  return false;
}

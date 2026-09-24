import {
  deleteBrieflyJson,
  getBrieflyJson,
  postBrieflyJson,
} from "@/api/briefly";

export function getBrieflyPurchaseEligibility() {
  return getBrieflyJson<{
    can_purchase: boolean;
    translation_entitled: boolean;
    briefly_pro_platform: "stripe" | "app_store" | "play_store" | null;
  }>("/api/subscriptions/purchase-eligibility");
}

export function syncBrieflyNativeSubscription() {
  return postBrieflyJson<{
    status: "synced";
    translation_entitled: boolean;
    briefly_pro_platform: "app_store" | "play_store" | "stripe" | null;
  }>("/api/subscriptions/native/sync", {});
}

export function deleteBrieflyAccount() {
  return deleteBrieflyJson<{
    deleted: true;
    identity_deleted: boolean;
    shared_identity_preserved: boolean;
  }>("/api/account");
}

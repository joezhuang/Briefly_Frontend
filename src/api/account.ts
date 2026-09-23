import { getBrieflyAccessToken } from "@/auth/session";
import { captureApiError } from "@/monitoring/error-monitoring";

const API_BASE_URL = process.env.EXPO_PUBLIC_BRIEFLY_API_URL?.replace(/\/$/, "");

function requireApiBaseUrl() {
  if (!API_BASE_URL) throw new Error("Missing EXPO_PUBLIC_BRIEFLY_API_URL");
  return API_BASE_URL;
}

function requireAccessToken() {
  const accessToken = getBrieflyAccessToken();
  if (!accessToken) throw new Error("You must be signed in.");
  return accessToken;
}

export async function getBrieflyPurchaseEligibility() {
  let response: Response;
  try {
    response = await fetch(
      `${requireApiBaseUrl()}/api/subscriptions/purchase-eligibility`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${requireAccessToken()}`,
        },
      },
    );
  } catch (error) {
    captureApiError({
      route: "/api/subscriptions/purchase-eligibility",
      method: "GET",
      error,
    });
    throw error;
  }

  if (response.status >= 500) {
    captureApiError({
      route: "/api/subscriptions/purchase-eligibility",
      method: "GET",
      statusCode: response.status,
    });
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Purchase eligibility check failed (${response.status}): ${message || response.statusText}`,
    );
  }

  return response.json() as Promise<{
    can_purchase: boolean;
    translation_entitled: boolean;
    briefly_pro_platform: "stripe" | "app_store" | "play_store" | null;
  }>;
}


export async function syncBrieflyNativeSubscription() {
  let response: Response;
  try {
    response = await fetch(
      `${requireApiBaseUrl()}/api/subscriptions/native/sync`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${requireAccessToken()}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      },
    );
  } catch (error) {
    captureApiError({
      route: "/api/subscriptions/native/sync",
      method: "POST",
      error,
    });
    throw error;
  }
  if (response.status >= 500) {
    captureApiError({
      route: "/api/subscriptions/native/sync",
      method: "POST",
      statusCode: response.status,
    });
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Subscription sync failed (${response.status}): ${message || response.statusText}`,
    );
  }

  return response.json() as Promise<{
    status: "synced";
    translation_entitled: boolean;
    briefly_pro_platform: "app_store" | "play_store" | "stripe" | null;
  }>;
}

export async function deleteBrieflyAccount() {
  let response: Response;
  try {
    response = await fetch(`${requireApiBaseUrl()}/api/account`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${requireAccessToken()}`,
      },
    });
  } catch (error) {
    captureApiError({ route: "/api/account", method: "DELETE", error });
    throw error;
  }
  if (response.status >= 500) {
    captureApiError({
      route: "/api/account",
      method: "DELETE",
      statusCode: response.status,
    });
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Account deletion failed (${response.status}): ${message || response.statusText}`,
    );
  }

  return response.json() as Promise<{ deleted: true }>;
}

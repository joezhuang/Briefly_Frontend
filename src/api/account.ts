import { getBrieflyAccessToken } from "@/auth/session";

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

export async function syncBrieflyNativeSubscription() {
  const response = await fetch(
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
  const response = await fetch(`${requireApiBaseUrl()}/api/account`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${requireAccessToken()}`,
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Account deletion failed (${response.status}): ${message || response.statusText}`,
    );
  }

  return response.json() as Promise<{ deleted: true }>;
}

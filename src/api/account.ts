import { getBrieflyAccessToken } from "@/auth/session";

const API_BASE_URL = process.env.EXPO_PUBLIC_BRIEFLY_API_URL?.replace(/\/$/, "");

export async function deleteBrieflyAccount() {
  if (!API_BASE_URL) throw new Error("Missing EXPO_PUBLIC_BRIEFLY_API_URL");

  const accessToken = getBrieflyAccessToken();
  if (!accessToken) throw new Error("You must be signed in to delete your account.");

  const response = await fetch(`${API_BASE_URL}/api/account`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

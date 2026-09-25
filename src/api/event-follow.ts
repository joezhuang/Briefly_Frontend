import {
  clearBrieflyAccessToken,
  getBrieflyAccessToken,
  setBrieflyAccessToken,
} from "@/auth/session";
import { supabase } from "@/auth/supabase";
import { captureApiError } from "@/monitoring/error-monitoring";
import { getBrieflyRolloutHeaders } from "@/rollouts/identity";

const API_BASE_URL = process.env.EXPO_PUBLIC_BRIEFLY_API_URL?.replace(/\/$/, "");

function requireApiBaseUrl() {
  if (!API_BASE_URL) throw new Error("Missing EXPO_PUBLIC_BRIEFLY_API_URL");
  return API_BASE_URL;
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const send = async (token: string | null) => {
    const method = String(init.method ?? "GET").toUpperCase();
    try {
      const response = await fetch(`${requireApiBaseUrl()}${path}`, {
        ...init,
        headers: {
          ...(await getBrieflyRolloutHeaders()),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(init.headers ?? {}),
        },
      });
      if (response.status >= 500) {
        captureApiError({ route: path, method, statusCode: response.status });
      }
      return response;
    } catch (error) {
      captureApiError({ route: path, method, error });
      throw error;
    }
  };

  let token = getBrieflyAccessToken();
  let response = await send(token);

  if (response.status === 401 && supabase) {
    const { data, error } = await supabase.auth.refreshSession();
    token = !error ? data.session?.access_token ?? null : null;
    setBrieflyAccessToken(token);
    if (token) response = await send(token);
    else clearBrieflyAccessToken();
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Briefly API request failed (${response.status}): ${message || response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

export type EventFollowState = {
  event_id: string;
  following: boolean;
};

export type EventFollowAction = {
  event_id: string;
  status: "following" | "unfollowed";
};

export type FollowedEvent = {
  event_id: string;
  title: string;
  article_count: number;
  last_updated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  ranking_score: number | null;
  confidence_state: string | null;
  confidence_score: number | null;
};

export type MeaningfulEventUpdate = {
  development_id: number;
  event_id: string;
  title: string;
  observed_at: string | null;
  update_type: string | null;
  new_evidence_count: number | null;
  new_unique_source_count: number | null;
  new_languages: string[] | null;
  update_velocity_per_hour: number | null;
  reasons: unknown;
  representative_title: string | null;
  acknowledged: boolean;
};

export function getEventFollowState(eventId: string) {
  return requestJson<EventFollowState>(
    `/api/events/${encodeURIComponent(eventId)}/follow`,
  );
}

export function followEvent(eventId: string) {
  return requestJson<EventFollowAction>(
    `/api/events/${encodeURIComponent(eventId)}/follow`,
    { method: "POST" },
  );
}

export function unfollowEvent(eventId: string) {
  return requestJson<EventFollowAction>(
    `/api/events/${encodeURIComponent(eventId)}/follow`,
    { method: "DELETE" },
  );
}

export function getFollowedEvents() {
  return requestJson<{ events: FollowedEvent[]; count: number }>(
    "/api/events/followed",
  );
}

export function getMeaningfulEventUpdates(options?: {
  includeAcknowledged?: boolean;
  limit?: number;
}) {
  const params = new URLSearchParams({
    include_acknowledged: String(options?.includeAcknowledged ?? false),
    limit: String(options?.limit ?? 50),
  });
  return requestJson<{
    updates: MeaningfulEventUpdate[];
    count: number;
    meaningful_only: boolean;
  }>(`/api/events/updates?${params.toString()}`);
}

export function acknowledgeEventUpdate(eventId: string, developmentId: number) {
  return requestJson<{
    status: "acknowledged";
    event_id: string;
    development_id: number;
  }>("/api/events/updates/acknowledge", {
    method: "POST",
    body: JSON.stringify({ event_id: eventId, development_id: developmentId }),
  });
}

import { captureApiError } from "@/monitoring/error-monitoring";

const API_BASE_URL = process.env.EXPO_PUBLIC_BRIEFLY_API_URL?.replace(/\/$/, "");

export type EventTimelineItem = {
  id: string;
  time: string | null;
  title: string;
};

export type EventTimelineSnapshot = {
  event_id: string;
  background?: EventTimelineItem[];
  timeline: EventTimelineItem[];
  upcoming?: EventTimelineItem[];
  count: number;
  synthesis_version: number | null;
  timeline_updated_at?: string | null;
};

function requireApiBaseUrl() {
  if (!API_BASE_URL) throw new Error("Missing EXPO_PUBLIC_BRIEFLY_API_URL");
  return API_BASE_URL;
}

export async function getEventTimeline(
  eventId: string,
): Promise<EventTimelineSnapshot> {
  const route = `/api/events/${encodeURIComponent(eventId)}/timeline`;
  let response: Response;
  try {
    response = await fetch(`${requireApiBaseUrl()}${route}`);
  } catch (error) {
    captureApiError({ route, method: "GET", error });
    throw error;
  }
  if (response.status >= 500) {
    captureApiError({ route, method: "GET", statusCode: response.status });
  }
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Briefly event timeline request failed (${response.status}): ${message || response.statusText}`,
    );
  }
  return response.json() as Promise<EventTimelineSnapshot>;
}

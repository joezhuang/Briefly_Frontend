import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

import { getBrieflyAccessToken } from "@/auth/session";

const API_BASE_URL = process.env.EXPO_PUBLIC_BRIEFLY_API_URL?.replace(/\/$/, "");
const FLUSH_DELAY_MS = 1500;
const FLUSH_BATCH_SIZE = 10;
const MAX_QUEUE_SIZE = 100;

export type ProductAnalyticsEventName =
  | "feed_view"
  | "story_open"
  | "story_save"
  | "story_unsave"
  | "story_share"
  | "event_follow"
  | "event_unfollow"
  | "following_view"
  | "event_update_open"
  | "event_lens_select"
  | "podcast_action";

type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

type QueuedAnalyticsEvent = {
  event_name: ProductAnalyticsEventName;
  session_id: string;
  event_id?: string | null;
  article_version_id?: number | null;
  platform: "web" | "ios" | "android" | "unknown";
  app_version?: string | null;
  properties: AnalyticsProperties;
  occurred_at: string;
};

const sessionId = Crypto.randomUUID();
const appVersion = Constants.expoConfig?.version ?? null;
const platform: QueuedAnalyticsEvent["platform"] =
  Platform.OS === "web" || Platform.OS === "ios" || Platform.OS === "android"
    ? Platform.OS
    : "unknown";

let queue: QueuedAnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushPromise: Promise<void> | null = null;

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushProductAnalytics();
  }, FLUSH_DELAY_MS);
}

export function trackProductEvent(
  eventName: ProductAnalyticsEventName,
  options?: {
    eventId?: string | null;
    articleVersionId?: number | null;
    properties?: AnalyticsProperties;
  },
) {
  if (!API_BASE_URL) return;

  queue.push({
    event_name: eventName,
    session_id: sessionId,
    event_id: options?.eventId ?? null,
    article_version_id: options?.articleVersionId ?? null,
    platform,
    app_version: appVersion,
    properties: options?.properties ?? {},
    occurred_at: new Date().toISOString(),
  });

  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
  }

  if (queue.length >= FLUSH_BATCH_SIZE) {
    void flushProductAnalytics();
    return;
  }

  scheduleFlush();
}

export async function flushProductAnalytics() {
  if (!API_BASE_URL || queue.length === 0) return;
  if (flushPromise) return flushPromise;

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const batch = queue.splice(0, FLUSH_BATCH_SIZE);
  flushPromise = (async () => {
    try {
      const token = getBrieflyAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/analytics/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ events: batch }),
      });

      if (!response.ok) {
        throw new Error(`Analytics request failed (${response.status})`);
      }
    } catch {
      queue = [...batch, ...queue].slice(0, MAX_QUEUE_SIZE);
    } finally {
      flushPromise = null;
      if (queue.length > 0) scheduleFlush();
    }
  })();

  return flushPromise;
}

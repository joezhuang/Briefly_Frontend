import { getBrieflyAccessToken } from "@/auth/session";
import { brieflyRuntimeRelease } from "@/release/runtime-release";
import { telemetrySessionId } from "@/telemetry/session";

const API_BASE_URL = process.env.EXPO_PUBLIC_BRIEFLY_API_URL?.replace(/\/$/, "");
const FLUSH_DELAY_MS = 1500;
const FLUSH_BATCH_SIZE = 10;
const MAX_QUEUE_SIZE = 100;
const MAX_RETRY_DELAY_MS = 60_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProductAnalyticsEventName =
  | "session_start"
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
  | "source_open"
  | "podcast_action"
  | "community_panel_load"
  | "community_contribution_start"
  | "community_contribution_create"
  | "community_contribution_withdraw"
  | "community_contribution_report"
  | "community_reaction"
  | "community_source_open"
  | "subscription_upgrade_view"
  | "subscription_plan_select"
  | "subscription_checkout_start"
  | "subscription_checkout_cancel"
  | "subscription_purchase_complete"
  | "subscription_restore_start"
  | "subscription_restore_complete"
  | "subscription_manage_open";

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

const appVersion = brieflyRuntimeRelease.telemetryVersion;
const platform: QueuedAnalyticsEvent["platform"] =
  brieflyRuntimeRelease.platform;

let queue: QueuedAnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushPromise: Promise<void> | null = null;
let consecutiveFailures = 0;

function normalizeEventId(value: string | null | undefined) {
  const candidate = String(value ?? "").trim();
  return UUID_PATTERN.test(candidate) ? candidate : null;
}

function nextFlushDelay() {
  if (consecutiveFailures === 0) return FLUSH_DELAY_MS;
  return Math.min(
    MAX_RETRY_DELAY_MS,
    FLUSH_DELAY_MS * 2 ** Math.min(consecutiveFailures, 6),
  );
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushProductAnalytics();
  }, nextFlushDelay());
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

  // Product analytics must always be fail-open: telemetry is never allowed to
  // interrupt navigation, mutations, reading history, or other user actions.
  try {
    queue.push({
      event_name: eventName,
      session_id: telemetrySessionId,
      event_id: normalizeEventId(options?.eventId),
      article_version_id: options?.articleVersionId ?? null,
      platform,
      app_version: appVersion,
      properties: options?.properties ?? {},
      occurred_at: new Date().toISOString(),
    });

    if (queue.length > MAX_QUEUE_SIZE) {
      queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
    }

    if (queue.length >= FLUSH_BATCH_SIZE && consecutiveFailures === 0) {
      void flushProductAnalytics();
      return;
    }

    scheduleFlush();
  } catch {
    // Deliberately ignore analytics failures.
  }
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
      consecutiveFailures = 0;
    } catch {
      consecutiveFailures += 1;
      queue = [...batch, ...queue].slice(0, MAX_QUEUE_SIZE);
    } finally {
      flushPromise = null;
      if (queue.length > 0) scheduleFlush();
    }
  })();

  return flushPromise;
}

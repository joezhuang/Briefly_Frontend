import {
  clearBrieflyAccessToken,
  getBrieflyAccessToken,
  setBrieflyAccessToken,
} from "@/auth/session";
import { supabase } from "@/auth/supabase";
import { captureApiError } from "@/monitoring/error-monitoring";
import type { CanonicalArticle } from "@/models/article";

const API_BASE_URL = process.env.EXPO_PUBLIC_BRIEFLY_API_URL?.replace(/\/$/, "");

let refreshPromise: Promise<string | null> | null = null;

async function refreshBrieflyAccessToken() {
  const client = supabase;
  if (!client) {
    clearBrieflyAccessToken();
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = client.auth
      .refreshSession()
      .then(({ data, error }) => {
        if (error || !data.session?.access_token) {
          clearBrieflyAccessToken();
          void client.auth.signOut({ scope: "local" }).catch(() => null);
          return null;
        }

        setBrieflyAccessToken(data.session.access_token);
        return data.session.access_token;
      })
      .catch(() => {
        clearBrieflyAccessToken();
        void client.auth.signOut({ scope: "local" }).catch(() => null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function requireApiBaseUrl() {
  if (!API_BASE_URL) throw new Error("Missing EXPO_PUBLIC_BRIEFLY_API_URL");
  return API_BASE_URL;
}

function requestHeaders(options?: { includeAuth?: boolean }) {
  const headers: Record<string, string> = {};
  const accessToken = getBrieflyAccessToken();

  if (options?.includeAuth !== false && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function monitoredFetch(path: string, init?: RequestInit) {
  const method = String(init?.method ?? "GET").toUpperCase();
  try {
    const response = await fetch(`${requireApiBaseUrl()}${path}`, init);
    if (response.status >= 500) {
      captureApiError({ route: path, method, statusCode: response.status });
    }
    return response;
  } catch (error) {
    captureApiError({ route: path, method, error });
    throw error;
  }
}

function isPublicContentPath(path: string) {
  return (
    path.startsWith("/api/app-config") ||
    path.startsWith("/api/article-feed") ||
    path.startsWith("/api/articles") ||
    path.startsWith("/api/community/events/") ||
    path.startsWith("/api/lazy-articles") ||
    path.startsWith("/api/event-timeline") ||
    path.startsWith("/api/location") ||
    path.startsWith("/api/article-search") ||
    path.startsWith("/api/search") ||
    /^\/api\/events\/[^/?]+\/(?:timeline|intelligence)(?:\?|$)/.test(path)
  );
}

async function getJson<T>(path: string): Promise<T> {
  const accessToken = getBrieflyAccessToken();
  let response = await monitoredFetch(path, {
    headers: requestHeaders(),
  });

  if (response.status === 401 && accessToken) {
    const refreshedToken = await refreshBrieflyAccessToken();

    if (refreshedToken) {
      response = await monitoredFetch(path, {
        headers: requestHeaders(),
      });
    } else if (isPublicContentPath(path)) {
      response = await monitoredFetch(path, {
        headers: requestHeaders({ includeAuth: false }),
      });
    }
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Briefly API request failed (${response.status}): ${message || response.statusText}`,
    );
  }
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const request = () =>
    monitoredFetch(path, {
      method: "POST",
      headers: {
        ...requestHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

  const accessToken = getBrieflyAccessToken();
  let response = await request();

  if (response.status === 401 && accessToken) {
    const refreshedToken = await refreshBrieflyAccessToken();
    if (refreshedToken) {
      response = await request();
    }
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Briefly API request failed (${response.status}): ${message || response.statusText}`,
    );
  }
  return response.json() as Promise<T>;
}

async function deleteJson<T>(path: string): Promise<T> {
  const request = () =>
    monitoredFetch(path, {
      method: "DELETE",
      headers: requestHeaders(),
    });

  const accessToken = getBrieflyAccessToken();
  let response = await request();

  if (response.status === 401 && accessToken) {
    const refreshedToken = await refreshBrieflyAccessToken();
    if (refreshedToken) {
      response = await request();
    }
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Briefly API request failed (${response.status}): ${message || response.statusText}`,
    );
  }
  return response.json() as Promise<T>;
}

export function getBrieflyJson<T>(path: string): Promise<T> {
  return getJson<T>(path);
}

export function postBrieflyJson<T>(path: string, body: unknown): Promise<T> {
  return postJson<T>(path, body);
}

export function deleteBrieflyJson<T>(path: string): Promise<T> {
  return deleteJson<T>(path);
}

function articleQuery(options?: { includeDraft?: boolean; language?: string }) {
  return new URLSearchParams({
    language: options?.language ?? "en",
    include_draft: String(options?.includeDraft ?? false),
  }).toString();
}

export function getCanonicalArticleBySlug(
  slug: string,
  options?: { includeDraft?: boolean; language?: string },
) {
  return getJson<CanonicalArticle>(
    `/api/articles/slug/${encodeURIComponent(slug)}?${articleQuery(options)}`,
  );
}

export function getCanonicalArticleByEventId(
  eventId: string,
  options?: { includeDraft?: boolean; language?: string },
) {
  return getJson<CanonicalArticle>(
    `/api/articles/event/${encodeURIComponent(eventId)}?${articleQuery(options)}`,
  );
}

export function getLazyCanonicalArticleByEventId(
  eventId: string,
  options?: {
    includeDraft?: boolean;
    language?: string;
    prepare?: boolean;
  },
) {
  const params = new URLSearchParams({
    language: options?.language ?? "en",
    include_draft: String(options?.includeDraft ?? false),
    prepare: String(options?.prepare ?? true),
  });
  return getJson<CanonicalArticle>(
    `/api/lazy-articles/event/${encodeURIComponent(eventId)}?${params.toString()}`,
  );
}

export type BriefRepairStatus = {
  article_version_id: number;
  event_id: string;
  missing_sections: ("what_happened" | "why_it_matters" | "what_next")[];
  attempted: boolean;
  status: "processing" | "succeeded" | "failed" | null;
  available: boolean;
  repaired_article_version_id: number | null;
};

export type BriefRepairResult = {
  status: "succeeded" | "not_needed";
  source_article_version_id?: number;
  article_version_id: number;
  event_id?: string;
  repaired_sections?: ("what_happened" | "why_it_matters" | "what_next")[];
  missing_sections?: string[];
};

export function getBriefRepairStatus(articleVersionId: number) {
  return getJson<BriefRepairStatus>(
    `/api/articles/version/${encodeURIComponent(String(articleVersionId))}/brief-repair`,
  );
}

export function requestBriefRepair(articleVersionId: number) {
  return postJson<BriefRepairResult>(
    `/api/articles/version/${encodeURIComponent(String(articleVersionId))}/brief-repair`,
    {},
  );
}

export type StaleStoryRefreshStatus = {
  status: "not_generated" | "processing" | "ready" | "failed" | "disabled";
  event_id: string;
  canonical_stale: boolean;
  article_version_id: number | null;
};

export function requestStaleStoryRefresh(
  eventId: string,
  options?: { includeDraft?: boolean },
) {
  const params = new URLSearchParams({
    include_draft: String(options?.includeDraft ?? false),
  });
  return postJson<StaleStoryRefreshStatus>(
    `/api/lazy-articles/event/${encodeURIComponent(eventId)}/refresh?${params.toString()}`,
    {},
  );
}

export function getExperimentalArticleByEventId(
  eventId: string,
  options?: { includeDraft?: boolean; language?: string },
) {
  return getJson<CanonicalArticle>(
    `/api/articles/event/${encodeURIComponent(eventId)}/experimental?${articleQuery(options)}`,
  );
}

export function getCanonicalArticleByVersionId(
  articleVersionId: number,
  options?: { includeDraft?: boolean },
) {
  const params = new URLSearchParams({
    include_draft: String(options?.includeDraft ?? false),
  });
  return getJson<CanonicalArticle>(
    `/api/articles/version/${encodeURIComponent(String(articleVersionId))}?${params}`,
  );
}

export type CardTranslation = {
  event_id: string;
  language: string;
  headline: string;
  summary: string;
  cached: boolean;
  source_hash: string;
};

export function requestCardTranslation(
  eventId: string,
  language: string,
  articleVersionId?: number | null,
  sourceHeadline?: string,
  sourceSummary?: string,
) {
  return postJson<CardTranslation>("/api/card-translations", {
    event_id: eventId,
    language,
    article_version_id: articleVersionId ?? null,
    source_headline: sourceHeadline ?? null,
    source_summary: sourceSummary ?? null,
  });
}

export type CommunityContributionType =
  | "perspective"
  | "reason"
  | "evidence"
  | "question"
  | "correction";

export type CommunityReportReason =
  | "misleading"
  | "abusive"
  | "spam"
  | "off_topic"
  | "other";

export type CommunityContribution = {
  contribution_id: number;
  event_id: string;
  contribution_type: CommunityContributionType;
  body: string;
  source_url: string | null;
  created_at: string;
  updated_at: string;
  is_mine: boolean;
  up_count: number;
  down_count: number;
  my_reaction: "up" | "down" | null;
};

export type EventCommunity = {
  event_id: string;
  contributions: CommunityContribution[];
  count: number;
  by_type: Partial<Record<CommunityContributionType, number>>;
};

export function getEventCommunity(
  eventId: string,
  options?: {
    contributionType?: CommunityContributionType;
    limit?: number;
    offset?: number;
  },
) {
  const params = new URLSearchParams({
    limit: String(options?.limit ?? 40),
    offset: String(options?.offset ?? 0),
  });
  if (options?.contributionType) {
    params.set("contribution_type", options.contributionType);
  }
  return getJson<EventCommunity>(
    `/api/community/events/${encodeURIComponent(eventId)}?${params.toString()}`,
  );
}

export function createCommunityContribution(
  eventId: string,
  input: {
    contribution_type: CommunityContributionType;
    body: string;
    source_url?: string | null;
  },
) {
  return postJson<CommunityContribution>(
    `/api/community/events/${encodeURIComponent(eventId)}/contributions`,
    input,
  );
}

export function withdrawCommunityContribution(contributionId: number) {
  return deleteJson<{
    status: "withdrawn";
    contribution_id: number;
    event_id: string;
    contribution_type: CommunityContributionType;
  }>(
    `/api/community/contributions/${encodeURIComponent(String(contributionId))}`,
  );
}

export function setCommunityReaction(
  contributionId: number,
  reaction: "up" | "down",
) {
  return postJson<{
    contribution_id: number;
    my_reaction: "up" | "down" | null;
    up_count: number;
    down_count: number;
  }>(
    `/api/community/contributions/${encodeURIComponent(String(contributionId))}/reaction`,
    { reaction },
  );
}

export function reportCommunityContribution(
  contributionId: number,
  reason: CommunityReportReason,
) {
  return postJson<{
    status: "reported";
    report_id: number;
    contribution_id: number;
    reason: CommunityReportReason;
    created_at: string;
  }>(
    `/api/community/contributions/${encodeURIComponent(String(contributionId))}/report`,
    { reason },
  );
}

export type CommunityModerationItem = {
  contribution_id: number;
  event_id: string;
  contribution_type: CommunityContributionType;
  body: string;
  source_url: string | null;
  status: "visible" | "hidden";
  created_at: string;
  updated_at: string;
  report_count: number;
  latest_report_reason: CommunityReportReason;
  latest_report_at: string;
};

export type CommunityModerationQueue = {
  items: CommunityModerationItem[];
  count: number;
};

export function getCommunityModerationQueue(options?: {
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams({
    limit: String(options?.limit ?? 50),
    offset: String(options?.offset ?? 0),
  });
  return getJson<CommunityModerationQueue>(
    `/api/community/moderation/reports?${params.toString()}`,
  );
}

export function setCommunityContributionVisibility(
  contributionId: number,
  visible: boolean,
) {
  return postJson<{
    contribution_id: number;
    event_id: string;
    contribution_type: CommunityContributionType;
    status: "visible" | "hidden";
  }>(
    `/api/community/contributions/${encodeURIComponent(String(contributionId))}/moderation`,
    { visible },
  );
}

export type PodcastAnalysisStatus = {
  status: "not_generated" | "processing" | "ready" | "failed";
  language: string;
  audio_url: string | null;
  row_id: string | null;
  article_version_id?: number;
  event_id?: string;
  source_language?: "en";
  pro_required?: boolean;
};

function podcastPath(articleVersionId: number, language: string) {
  const params = new URLSearchParams({ language });
  return `/api/articles/version/${encodeURIComponent(String(articleVersionId))}/podcast?${params}`;
}

export function getPodcastAnalysisStatus(
  articleVersionId: number,
  language: string,
) {
  return getJson<PodcastAnalysisStatus>(podcastPath(articleVersionId, language));
}

export function requestPodcastAnalysis(
  articleVersionId: number,
  language: string,
) {
  return postJson<PodcastAnalysisStatus>(
    podcastPath(articleVersionId, language),
    {},
  );
}

export type CanonicalArticleFeed = {
  articles: CanonicalArticle[];
  count: number;
  limit: number;
  offset: number;
  language: string;
  feed_language?: string;
  translation_entitled?: boolean;
};

export function getCanonicalArticles(options?: {
  includeDraft?: boolean;
  language?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams({
    language: options?.language ?? "en",
    include_draft: String(options?.includeDraft ?? false),
    limit: String(options?.limit ?? 20),
    offset: String(options?.offset ?? 0),
  });
  return getJson<CanonicalArticleFeed>(`/api/articles?${params.toString()}`);
}

export type HomepageFeedScope = "top" | "national" | "local";

export type HomepageArticleFeed = {
  articles: CanonicalArticle[];
  count: number;
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  scope: HomepageFeedScope;
  country: string | null;
  country_code?: string | null;
  city: string | null;
  region?: string | null;
  region_code?: string | null;
  national_coverage?: {
    key: string;
    status: "not_requested" | "queued" | "running" | "ready" | "failed";
    country_code: string | null;
    started_at?: number | null;
    completed_at?: number | null;
    articles: number;
    events: number;
    error?: string | null;
  } | null;
  local_coverage?: {
    key: string;
    status: "not_requested" | "queued" | "running" | "ready" | "failed";
    cities: string[];
    started_at?: number | null;
    completed_at?: number | null;
    articles: number;
    events: number;
    city_resolution?: {
      country_code: string;
      requested_region: string;
      requested_region_code: string | null;
      geonames_admin1_code: string | null;
      cities: string[];
      method: string;
    } | null;
    error?: string | null;
  } | null;
  feed_language: "en" | "multilingual";
  canonical_article_language?: "en";
  presentation_language?: string;
  generation_mode?: "lazy";
  feed_localization?: string;
};

export function getHomepageArticleFeed(options?: {
  scope?: HomepageFeedScope;
  includeDraft?: boolean;
  language?: string;
  country?: string;
  countryCode?: string | null;
  city?: string;
  region?: string | null;
  regionCode?: string | null;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams({
    scope: options?.scope ?? "top",
    language: options?.language ?? "en",
    include_draft: String(options?.includeDraft ?? false),
    limit: String(options?.limit ?? 20),
    offset: String(options?.offset ?? 0),
  });
  if (options?.country) params.set("country", options.country);
  if (options?.countryCode) params.set("country_code", options.countryCode);
  if (options?.city) params.set("city", options.city);
  if (options?.region) params.set("region", options.region);
  if (options?.regionCode) params.set("region_code", options.regionCode);
  return getJson<HomepageArticleFeed>(`/api/article-feed?${params.toString()}`);
}

export type NewsLocationCountryOption = {
  code: string;
  name: string;
};

export type NewsLocationRegionOption = {
  code: string;
  iso_code: string;
  name: string;
  type?: string | null;
};

export function getNewsLocationCountries() {
  return getJson<{ countries: NewsLocationCountryOption[] }>(
    "/api/location/countries",
  );
}

export function getNewsLocationRegions(countryCode: string) {
  const params = new URLSearchParams({ country_code: countryCode });
  return getJson<{
    country_code: string;
    regions: NewsLocationRegionOption[];
  }>(`/api/location/regions?${params.toString()}`);
}

export type BrieflyAccountState = {
  authenticated: boolean;
  email: string | null;
  translation_entitled: boolean;
  is_admin: boolean;
  briefly_pro_platform: "stripe" | "app_store" | "play_store" | null;
};

export type BetaDashboardEventCount = {
  event_name: string;
  count: number;
  sessions: number;
};

export type BetaDashboardDailyUsage = {
  day: string;
  events: number;
  sessions: number;
};

export type BetaDashboardPlatform = {
  platform: string;
  events: number;
  sessions: number;
};

export type BetaDashboardBreakdown = {
  name: string;
  count: number;
  sessions: number;
};

export type BetaDashboardConversionBreakdown = {
  name: string;
  count: number;
  users: number;
};

export type BetaDashboardErrorGroup = {
  fingerprint: string;
  occurrences: number;
  unresolved_occurrences: number;
  first_seen: string;
  last_seen: string;
  source: "client" | "server";
  severity: "warning" | "error" | "fatal";
  error_type: string;
  route: string | null;
  status_code: number | null;
  exception_type: string | null;
  message: string;
};

export type BetaDashboardReleaseClientVersion = {
  platform: "web" | "ios" | "android" | "unknown";
  app_version: string;
  events: number;
  sessions: number;
  authenticated_users: number;
  first_seen: string | null;
  last_seen: string | null;
};

export type BetaDashboardReleaseErrorVersion = {
  source: "client" | "server";
  platform: "web" | "ios" | "android" | "unknown" | "server";
  app_version: string;
  errors: number;
  unresolved_errors: number;
  fatal_errors: number;
  sessions: number;
  first_seen: string | null;
  last_seen: string | null;
};

export type BetaDashboardReleaseVisibility = {
  backend: {
    release_id: string | null;
    git_sha: string | null;
    git_short_sha: string | null;
    git_branch: string | null;
    revision_source: "environment" | "git" | "unavailable";
    environment: string | null;
    deployed_at: string | null;
    process_started_at: string;
    dirty: boolean | null;
  };
  client_versions: BetaDashboardReleaseClientVersion[];
  error_versions: BetaDashboardReleaseErrorVersion[];
};

export type BetaDashboardSnapshot = {
  window_days: number;
  generated_at: string;
  product: {
    summary: {
      total_events: number;
      sessions: number;
      authenticated_users: number;
    };
    event_counts: BetaDashboardEventCount[];
    daily_usage: BetaDashboardDailyUsage[];
    platforms: BetaDashboardPlatform[];
    funnel: {
      story_open_sessions: number;
      story_save_sessions: number;
      event_follow_sessions: number;
      following_view_sessions: number;
      story_save_rate: number;
      event_follow_rate: number;
      following_view_rate: number;
    };
    social_beta: {
      feed_view_sessions: number;
      feed_story_open_sessions: number;
      feed_to_story_rate: number;
      lens_sessions: number;
      lens_rate: number;
      source_open_sessions: number;
      source_open_rate: number;
      share_sessions: number;
      share_rate: number;
      podcast_action_sessions: number;
      podcast_action_rate: number;
      authenticated_active_users: number;
      multi_session_users: number;
      returning_users: number;
      returning_user_rate: number;
      lens_breakdown: BetaDashboardBreakdown[];
      podcast_breakdown: BetaDashboardBreakdown[];
      story_source_breakdown: BetaDashboardBreakdown[];
      community_engagement?: {
        community_panel_load_sessions: number;
        contribution_start_sessions: number;
        contribution_create_events: number;
        reaction_events: number;
        report_events: number;
        source_open_events: number;
        withdraw_events: number;
        sourced_contribution_events: number;
        active_events: number;
        community_panel_load_users: number;
        contribution_start_users: number;
        contributor_users: number;
        reaction_users: number;
        report_users: number;
        source_open_users: number;
        returning_contributors: number;
        panel_load_to_start_rate: number;
        participation_rate: number;
        start_to_publish_rate: number;
        reaction_rate: number;
        report_rate: number;
        source_open_rate: number;
        returning_contributor_rate: number;
        sourced_contribution_rate: number;
        kind_breakdown: BetaDashboardConversionBreakdown[];
        reaction_breakdown: BetaDashboardConversionBreakdown[];
        report_breakdown: BetaDashboardConversionBreakdown[];
      };
    };
    subscription_conversion: {
      upgrade_view_users: number;
      upgrade_view_events: number;
      plan_select_users: number;
      plan_select_events: number;
      checkout_start_users: number;
      checkout_start_events: number;
      checkout_cancel_users: number;
      checkout_cancel_events: number;
      purchase_complete_users: number;
      purchase_complete_events: number;
      restore_start_users: number;
      restore_success_users: number;
      manage_open_users: number;
      upgrade_to_plan_rate: number;
      plan_to_checkout_rate: number;
      checkout_to_purchase_rate: number;
      upgrade_to_purchase_rate: number;
      checkout_cancel_rate: number;
      restore_success_rate: number;
      plan_breakdown: BetaDashboardConversionBreakdown[];
      purchase_provider_breakdown: BetaDashboardConversionBreakdown[];
    };
    release_visibility?: BetaDashboardReleaseVisibility;
  };
  errors: {
    summary: {
      total_errors: number;
      unresolved_errors: number;
      client_errors: number;
      server_errors: number;
      unique_fingerprints: number;
    };
    groups: BetaDashboardErrorGroup[];
  };
};

export function getBetaDashboard(days = 7) {
  const params = new URLSearchParams({
    days: String(Math.max(1, Math.min(days, 90))),
  });
  return getJson<BetaDashboardSnapshot>(
    "/api/beta-dashboard?" + params.toString(),
  );
}

export function setBetaDashboardErrorResolution(
  fingerprint: string,
  resolved: boolean,
) {
  return postJson<{
    status: "resolved" | "reopened";
    fingerprint: string;
    changed: number;
  }>(
    "/api/beta-dashboard/errors/" +
      encodeURIComponent(fingerprint) +
      "/resolution",
    { resolved },
  );
}

export type BrieflySubscriptionLifecycleState =
  | "free"
  | "trialing"
  | "active"
  | "canceling"
  | "grace_period"
  | "past_due"
  | "expired";

export type BrieflySubscriptionStatus = {
  lifecycle_state: BrieflySubscriptionLifecycleState;
  is_pro: boolean;
  provider: "stripe" | "app_store" | "play_store" | null;
  provider_status: string | null;
  plan: string | null;
  product_id: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  grace_period_end: string | null;
  renews_at: string | null;
  access_until: string | null;
  active_platforms: ("stripe" | "app_store" | "play_store")[];
  legacy_fallback: boolean;
};

export function getCurrentBrieflyAccount() {
  return getJson<BrieflyAccountState>("/api/me");
}

export function getBrieflySubscriptionStatus() {
  return getJson<BrieflySubscriptionStatus>("/api/subscriptions/status");
}


export type BetaDashboardSubscriptionSource = {
  id: number | null;
  provider: "stripe" | "app_store" | "play_store";
  external_customer_id: string | null;
  external_subscription_id: string | null;
  product_id: string | null;
  price_id: string | null;
  plan: string | null;
  status: string | null;
  is_active: boolean;
  cancel_at_period_end: boolean;
  started_at: string | null;
  current_period_end: string | null;
  grace_period_end: string | null;
  canceled_at: string | null;
  ended_at: string | null;
  provider_event_id: string | null;
  provider_event_type: string | null;
  provider_event_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type BetaDashboardBillingEvent = {
  id: number | null;
  provider: "stripe" | "app_store" | "play_store";
  event_type:
    | "purchase"
    | "renewal"
    | "cancellation"
    | "expiration"
    | "restore"
    | "payment_failure"
    | "provider_change";
  provider_event_id: string | null;
  provider_event_type: string | null;
  external_customer_id: string | null;
  external_subscription_id: string | null;
  product_id: string | null;
  price_id: string | null;
  plan: string | null;
  status: string | null;
  previous_provider: "stripe" | "app_store" | "play_store" | null;
  occurred_at: string | null;
  recorded_at: string | null;
};

export type BetaDashboardCustomerSupport = {
  profile: {
    id: string;
    email: string | null;
    is_pro: boolean;
    briefly_pro_platform: "stripe" | "app_store" | "play_store" | null;
    stripe_customer_id: string | null;
    uses_briefly: boolean | null;
    first_used_briefly_at: string | null;
    last_active_briefly_at: string | null;
  };
  lifecycle: BrieflySubscriptionStatus;
  ledger_sources: BetaDashboardSubscriptionSource[];
  billing_events?: BetaDashboardBillingEvent[];
  consistency: {
    in_sync: boolean;
    issues: string[];
    warnings: string[];
  };
};

export function getBetaDashboardCustomerSupport(query: string) {
  const params = new URLSearchParams({ q: query.trim() });
  return getJson<BetaDashboardCustomerSupport>(
    "/api/beta-dashboard/customer-support?" + params.toString(),
  );
}

export type BetaDashboardRevenueCatHealth = {
  configured: boolean;
  reachable: boolean;
  active: boolean | null;
  platform: "app_store" | "play_store" | null;
  product_id: string | null;
  purchase_date: string | null;
  expires_at: string | null;
  grace_period_end: string | null;
  unsubscribe_detected_at: string | null;
  billing_issue_detected_at: string | null;
  store: string | null;
  error: string | null;
};

export type BetaDashboardStripeSubscriptionHealth = {
  id: string | null;
  status: string;
  is_active: boolean;
  cancel_at_period_end: boolean;
  customer_id: string | null;
  product_id: string | null;
  price_id: string | null;
  plan: string | null;
  started_at: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  ended_at: string | null;
};

export type BetaDashboardStripeHealth = {
  configured: boolean;
  reachable: boolean;
  linked: boolean;
  customer_id: string | null;
  active: boolean | null;
  subscriptions: BetaDashboardStripeSubscriptionHealth[];
  error: string | null;
};

export type BetaDashboardBillingOperationalHealth = {
  checked_at: string;
  user_id: string;
  canonical: {
    profile_is_pro: boolean;
    profile_platform: "stripe" | "app_store" | "play_store" | null;
    lifecycle_is_pro: boolean;
    lifecycle_provider: "stripe" | "app_store" | "play_store" | null;
    lifecycle_state: string | null;
    active_platforms: ("stripe" | "app_store" | "play_store")[];
  };
  providers: {
    revenuecat: BetaDashboardRevenueCatHealth;
    stripe: BetaDashboardStripeHealth;
  };
  consistency: {
    in_sync: boolean;
    issues: string[];
    warnings: string[];
    repair_recommended: boolean;
  };
  reconciliation_history: BetaDashboardAdminAuditPage;
};

export type BetaDashboardBillingReconcileResult = {
  status: "completed" | "partial";
  user_id: string;
  providers: Record<string, Record<string, unknown>>;
  canonical: Record<string, unknown>;
  support: BetaDashboardCustomerSupport | null;
  health: BetaDashboardBillingOperationalHealth | null;
};

export function getBetaDashboardBillingHealth(userId: string) {
  return getJson<BetaDashboardBillingOperationalHealth>(
    "/api/beta-dashboard/customer-support/" +
      encodeURIComponent(userId) +
      "/billing-health",
  );
}

export function reconcileBetaDashboardBilling(userId: string) {
  return postJson<BetaDashboardBillingReconcileResult>(
    "/api/beta-dashboard/customer-support/" +
      encodeURIComponent(userId) +
      "/reconcile",
    { confirm: true },
  );
}

export type BrieflyWebPrice = {
  plan: "monthly" | "yearly";
  unit_amount: number;
  currency: string;
  interval: "month" | "year" | string | null;
};

export function getBrieflyWebPrices() {
  return getJson<{
    monthly: BrieflyWebPrice;
    yearly: BrieflyWebPrice;
  }>("/api/subscriptions/web/prices");
}

export function createBrieflyWebCheckout(
  plan: "monthly" | "yearly",
  successUrl: string,
  cancelUrl: string,
) {
  return postJson<{ checkout_url: string }>(
    "/api/subscriptions/web/checkout",
    {
      plan,
      success_url: successUrl,
      cancel_url: cancelUrl,
    },
  );
}

export function createBrieflyWebPortal(returnUrl: string) {
  return postJson<{ portal_url: string }>(
    "/api/subscriptions/web/portal",
    { return_url: returnUrl },
  );
}

export function confirmBrieflyWebCheckout(sessionId: string) {
  return postJson<{
    status: "confirmed";
    translation_entitled: boolean;
    briefly_pro_platform: "stripe";
    profile_updated: boolean;
  }>("/api/subscriptions/web/confirm", {
    session_id: sessionId,
  });
}

export function syncBrieflyWebSubscription() {
  return postJson<{
    status: "synced" | "no_customer";
    translation_entitled: boolean;
    briefly_pro_platform?: string | null;
  }>("/api/subscriptions/web/sync", {});
}

export type BetaDashboardTelemetryConfig = {
  test_account_emails: string[];
  include_test_accounts_in_analytics: boolean;
  include_test_accounts_in_error_monitoring: boolean;
  health_alerts_enabled: boolean;
  health_error_rate_min_sessions: number;
  health_warning_error_session_rate: number;
  health_critical_error_session_rate: number;
  health_warning_server_errors_24h: number;
  health_critical_server_errors_24h: number;
  health_warning_unresolved_errors: number;
  health_critical_unresolved_errors: number;
};

export type BetaDashboardTelemetryAlert = {
  code:
    | "unresolved_fatal_errors"
    | "server_errors_24h"
    | "unresolved_errors"
    | "error_session_rate";
  severity: "warning" | "critical";
  metric: string;
  value: number;
  threshold: number;
  message: string;
};

export type BetaDashboardTelemetryHealth = {
  status: "ok" | "warning" | "critical" | "disabled";
  generated_at: string;
  alerts_enabled: boolean;
  thresholds: {
    error_rate_min_sessions: number;
    warning_error_session_rate: number;
    critical_error_session_rate: number;
    warning_server_errors_24h: number;
    critical_server_errors_24h: number;
    warning_unresolved_errors: number;
    critical_unresolved_errors: number;
  };
  alerts: BetaDashboardTelemetryAlert[];
  analytics: {
    events_24h: number;
    sessions_24h: number;
    authenticated_users_24h: number;
    last_received_at: string | null;
  };
  errors: {
    errors_24h: number;
    client_errors_24h: number;
    server_errors_24h: number;
    fatal_errors_24h: number;
    error_sessions_24h: number;
    error_session_rate: number | null;
    error_session_rate_reason:
      | "insufficient_sessions"
      | "test_account_filters_differ"
      | null;
    unresolved_errors: number;
    unresolved_fatal_errors: number;
    last_received_at: string | null;
  };
};

const DEFAULT_BETA_DASHBOARD_TELEMETRY_CONFIG: BetaDashboardTelemetryConfig = {
  test_account_emails: [],
  include_test_accounts_in_analytics: true,
  include_test_accounts_in_error_monitoring: true,
  health_alerts_enabled: true,
  health_error_rate_min_sessions: 20,
  health_warning_error_session_rate: 5,
  health_critical_error_session_rate: 15,
  health_warning_server_errors_24h: 5,
  health_critical_server_errors_24h: 20,
  health_warning_unresolved_errors: 10,
  health_critical_unresolved_errors: 30,
};

const DEFAULT_BETA_DASHBOARD_HEALTH_THRESHOLDS =
  {
    error_rate_min_sessions: 20,
    warning_error_session_rate: 5,
    critical_error_session_rate: 15,
    warning_server_errors_24h: 5,
    critical_server_errors_24h: 20,
    warning_unresolved_errors: 10,
    critical_unresolved_errors: 30,
  } satisfies BetaDashboardTelemetryHealth["thresholds"];

type BetaDashboardTelemetryHealthWire = Partial<
  Omit<BetaDashboardTelemetryHealth, "analytics" | "errors" | "thresholds">
> & {
  thresholds?: Partial<BetaDashboardTelemetryHealth["thresholds"]>;
  analytics?: Partial<BetaDashboardTelemetryHealth["analytics"]>;
  errors?: Partial<BetaDashboardTelemetryHealth["errors"]>;
};

function normalizeBetaDashboardTelemetryConfig(
  value: Partial<BetaDashboardTelemetryConfig>,
): BetaDashboardTelemetryConfig {
  return {
    ...DEFAULT_BETA_DASHBOARD_TELEMETRY_CONFIG,
    ...value,
    test_account_emails: value.test_account_emails ?? [],
  };
}

function normalizeBetaDashboardTelemetryHealth(
  value: BetaDashboardTelemetryHealthWire,
): BetaDashboardTelemetryHealth {
  return {
    status: value.status ?? "ok",
    generated_at: value.generated_at ?? new Date().toISOString(),
    alerts_enabled: value.alerts_enabled ?? false,
    thresholds: {
      ...DEFAULT_BETA_DASHBOARD_HEALTH_THRESHOLDS,
      ...(value.thresholds ?? {}),
    },
    alerts: value.alerts ?? [],
    analytics: {
      events_24h: value.analytics?.events_24h ?? 0,
      sessions_24h: value.analytics?.sessions_24h ?? 0,
      authenticated_users_24h:
        value.analytics?.authenticated_users_24h ?? 0,
      last_received_at: value.analytics?.last_received_at ?? null,
    },
    errors: {
      errors_24h: value.errors?.errors_24h ?? 0,
      client_errors_24h: value.errors?.client_errors_24h ?? 0,
      server_errors_24h: value.errors?.server_errors_24h ?? 0,
      fatal_errors_24h: value.errors?.fatal_errors_24h ?? 0,
      error_sessions_24h: value.errors?.error_sessions_24h ?? 0,
      error_session_rate: value.errors?.error_session_rate ?? null,
      error_session_rate_reason:
        value.errors?.error_session_rate_reason ?? "insufficient_sessions",
      unresolved_errors: value.errors?.unresolved_errors ?? 0,
      unresolved_fatal_errors: value.errors?.unresolved_fatal_errors ?? 0,
      last_received_at: value.errors?.last_received_at ?? null,
    },
  };
}

export type StripePromotion = {
  id: string;
  code: string;
  active: boolean;
  percent_off: number;
  duration: string;
  times_redeemed: number;
  max_redemptions: number | null;
  created: number;
};

export type BrieflyAppConfig = {
  email_password_login_enabled: boolean;
  reviewer_email: string | null;
  ads_enabled: boolean;
  ads_free_for_pro: boolean;
  home_ad_enabled: boolean;
  home_ad_interval: number;
  story_ad_enabled: boolean;
  ad_provider: string;
  homepage_video_enabled: boolean;
  story_video_enabled: boolean;
  floating_video_enabled: boolean;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  announcement_enabled: boolean;
  announcement_text: string | null;
  community_enabled: boolean;
  evidence_enabled: boolean;
  timeline_enabled: boolean;
  coverage_enabled: boolean;
  podcast_enabled: boolean;
  translation_enabled: boolean;
  following_enabled: boolean;
  search_enabled: boolean;
  top_feed_enabled: boolean;
  national_feed_enabled: boolean;
  local_feed_enabled: boolean;
  default_feed_scope: HomepageFeedScope;
  promotion_enabled: boolean;
  promotion_title: string | null;
  promotion_message: string | null;
  native_revenuecat_offering_id: string | null;
  ios_offer_code_redemption_enabled: boolean;
  android_promo_code_hint_enabled: boolean;
  web_promotion_codes_enabled: boolean;
};

export function getBrieflyAppConfig() {
  return getJson<BrieflyAppConfig>("/api/app-config");
}

export function getBetaDashboardAppConfig() {
  return getJson<BrieflyAppConfig>("/api/beta-dashboard/app-config");
}

export function updateBetaDashboardAppConfig(config: BrieflyAppConfig) {
  return postJson<BrieflyAppConfig>("/api/beta-dashboard/app-config", config);
}

export type BetaDashboardAdminAuditItem = {
  id: number;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_key: string | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type BetaDashboardAdminAuditPage = {
  items: BetaDashboardAdminAuditItem[];
  count: number;
  offset: number;
  limit: number;
  has_more: boolean;
  available?: boolean;
  error?: string | null;
};

export function getBetaDashboardAdminAuditLog(options?: {
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams({
    limit: String(options?.limit ?? 50),
    offset: String(options?.offset ?? 0),
  });
  return getJson<BetaDashboardAdminAuditPage>(
    "/api/beta-dashboard/audit-log?" + params.toString(),
  );
}

export function getBetaDashboardAppConfigHistory(options?: {
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams({
    limit: String(options?.limit ?? 30),
    offset: String(options?.offset ?? 0),
  });
  return getJson<BetaDashboardAdminAuditPage>(
    "/api/beta-dashboard/app-config/history?" + params.toString(),
  );
}

export function rollbackBetaDashboardAppConfig(auditId: number) {
  return postJson<BrieflyAppConfig>(
    "/api/beta-dashboard/app-config/history/" +
      encodeURIComponent(String(auditId)) +
      "/rollback",
    { confirm: true },
  );
}

export function getBetaDashboardStripePromotions() {
  return getJson<{ items: StripePromotion[] }>(
    "/api/beta-dashboard/stripe-promotions",
  );
}

export function createBetaDashboardStripePromotion(input: {
  code: string;
  percent_off: number;
  duration: "once" | "forever";
  max_redemptions: number | null;
}) {
  return postJson<StripePromotion>(
    "/api/beta-dashboard/stripe-promotions",
    input,
  );
}

export function deactivateBetaDashboardStripePromotion(
  promotionCodeId: string,
) {
  return postJson<StripePromotion>(
    "/api/beta-dashboard/stripe-promotions/" +
      encodeURIComponent(promotionCodeId) +
      "/deactivate",
    {},
  );
}

export async function getBetaDashboardTelemetryConfig() {
  const value = await getJson<Partial<BetaDashboardTelemetryConfig>>(
    "/api/beta-dashboard/telemetry-config",
  );
  return normalizeBetaDashboardTelemetryConfig(value);
}

export async function updateBetaDashboardTelemetryConfig(
  config: BetaDashboardTelemetryConfig,
) {
  const value = await postJson<Partial<BetaDashboardTelemetryConfig>>(
    "/api/beta-dashboard/telemetry-config",
    config,
  );
  return normalizeBetaDashboardTelemetryConfig(value);
}

export async function getBetaDashboardTelemetryHealth() {
  const value = await getJson<BetaDashboardTelemetryHealthWire>(
    "/api/beta-dashboard/telemetry-health",
  );
  return normalizeBetaDashboardTelemetryHealth(value);
}


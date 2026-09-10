import {
  clearBrieflyAccessToken,
  getBrieflyAccessToken,
} from "@/auth/session";
import type { CanonicalArticle } from "@/models/article";

const API_BASE_URL = process.env.EXPO_PUBLIC_BRIEFLY_API_URL?.replace(/\/$/, "");

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

  if (process.env.EXPO_PUBLIC_BRIEFLY_TEST_SUBSCRIBER === "true") {
    headers["X-Briefly-Test-Subscriber"] = "1";
  }

  return headers;
}

function isPublicContentPath(path: string) {
  return (
    path.startsWith("/api/article-feed") ||
    path.startsWith("/api/articles") ||
    path.startsWith("/api/lazy-articles") ||
    path.startsWith("/api/event-timeline") ||
    path.startsWith("/api/search")
  );
}

async function getJson<T>(path: string): Promise<T> {
  const accessToken = getBrieflyAccessToken();
  let response = await fetch(`${requireApiBaseUrl()}${path}`, {
    headers: requestHeaders(),
  });

  if (response.status === 401 && accessToken && isPublicContentPath(path)) {
    clearBrieflyAccessToken();
    response = await fetch(`${requireApiBaseUrl()}${path}`, {
      headers: requestHeaders({ includeAuth: false }),
    });
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
  const response = await fetch(`${requireApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      ...requestHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Briefly API request failed (${response.status}): ${message || response.statusText}`,
    );
  }
  return response.json() as Promise<T>;
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
  options?: { includeDraft?: boolean; language?: string },
) {
  const params = new URLSearchParams({
    language: options?.language ?? "en",
    include_draft: String(options?.includeDraft ?? false),
  });
  return getJson<CanonicalArticle>(
    `/api/lazy-articles/event/${encodeURIComponent(eventId)}?${params.toString()}`,
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
) {
  return postJson<CardTranslation>("/api/card-translations", {
    event_id: eventId,
    language,
    article_version_id: articleVersionId ?? null,
  });
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
  city: string | null;
  feed_language: "en";
  presentation_language?: string;
  generation_mode?: "lazy";
  feed_localization?: string;
};

export function getHomepageArticleFeed(options?: {
  scope?: HomepageFeedScope;
  includeDraft?: boolean;
  language?: string;
  country?: string;
  city?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams({
    scope: options?.scope ?? "top",
    language: options?.language ?? "en",
    include_draft: String(options?.includeDraft ?? false),
    country: options?.country ?? "Australia",
    city: options?.city ?? "Sydney",
    limit: String(options?.limit ?? 20),
    offset: String(options?.offset ?? 0),
  });
  return getJson<HomepageArticleFeed>(`/api/article-feed?${params.toString()}`);
}

export type BrieflyAccountState = {
  authenticated: boolean;
  email: string | null;
  translation_entitled: boolean;
};

export function getCurrentBrieflyAccount() {
  return getJson<BrieflyAccountState>("/api/me");
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

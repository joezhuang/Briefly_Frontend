import type { CanonicalArticle } from "@/models/article";

const API_BASE_URL = process.env.EXPO_PUBLIC_BRIEFLY_API_URL?.replace(
  /\/$/,
  "",
);

function requireApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("Missing EXPO_PUBLIC_BRIEFLY_API_URL");
  }

  return API_BASE_URL;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${requireApiBaseUrl()}${path}`);

  if (!response.ok) {
    const message = await response.text().catch(() => "");

    throw new Error(
      `Briefly API request failed (${response.status}): ${
        message || response.statusText
      }`,
    );
  }

  return response.json() as Promise<T>;
}

export function getCanonicalArticleBySlug(
  slug: string,
  options?: {
    includeDraft?: boolean;
    language?: string;
  },
) {
  const params = new URLSearchParams({
    language: options?.language ?? "en",
    include_draft: String(options?.includeDraft ?? false),
  });

  return getJson<CanonicalArticle>(
    `/api/articles/slug/${encodeURIComponent(slug)}?${params}`,
  );
}

export function getCanonicalArticleByEventId(
  eventId: string,
  options?: {
    includeDraft?: boolean;
    language?: string;
  },
) {
  const params = new URLSearchParams({
    language: options?.language ?? "en",
    include_draft: String(options?.includeDraft ?? false),
  });

  return getJson<CanonicalArticle>(
    `/api/articles/event/${encodeURIComponent(eventId)}?${params}`,
  );
}

export type CanonicalArticleFeed = {
  articles: CanonicalArticle[];
  count: number;
  limit: number;
  offset: number;
  language: string;
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

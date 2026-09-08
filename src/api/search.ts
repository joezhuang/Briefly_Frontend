import { getBrieflyAccessToken } from "@/auth/session";
import type { CanonicalArticle } from "@/models/article";

const API_BASE_URL = process.env.EXPO_PUBLIC_BRIEFLY_API_URL?.replace(/\/$/, "");

export type ArticleSearchResponse = {
  articles: CanonicalArticle[];
  count: number;
  query: string;
  language: string;
  feed_language: "en";
  search_scope: "canonical_event";
};

export async function searchBrieflyArticles(
  query: string,
  options?: {
    language?: string;
    includeDraft?: boolean;
    limit?: number;
  },
): Promise<ArticleSearchResponse> {
  if (!API_BASE_URL) throw new Error("Missing EXPO_PUBLIC_BRIEFLY_API_URL");

  const params = new URLSearchParams({
    q: query.trim(),
    language: options?.language ?? "en",
    include_draft: String(options?.includeDraft ?? false),
    limit: String(options?.limit ?? 30),
  });

  const headers: Record<string, string> = {};
  const token = getBrieflyAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (process.env.EXPO_PUBLIC_BRIEFLY_TEST_SUBSCRIBER === "true") {
    headers["X-Briefly-Test-Subscriber"] = "1";
  }

  const response = await fetch(`${API_BASE_URL}/api/article-search?${params.toString()}`, {
    headers,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Briefly search failed (${response.status}): ${message || response.statusText}`,
    );
  }

  return response.json() as Promise<ArticleSearchResponse>;
}

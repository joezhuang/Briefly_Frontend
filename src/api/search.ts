import { getBrieflyJson } from "@/api/briefly";
import type { CanonicalArticle } from "@/models/article";

export type ArticleSearchResponse = {
  articles: CanonicalArticle[];
  count: number;
  query: string;
  language: string;
  feed_language: "en";
  search_scope: "event_universe" | "all_clusters";
};

type SearchOptions = {
  language?: string;
  includeDraft?: boolean;
  limit?: number;
};

function searchWithEndpoint(
  endpoint: "/api/article-search" | "/api/article-search/clusters",
  query: string,
  options?: SearchOptions,
): Promise<ArticleSearchResponse> {
  const params = new URLSearchParams({
    q: query.trim(),
    language: options?.language ?? "en",
    include_draft: String(options?.includeDraft ?? false),
    limit: String(options?.limit ?? 30),
  });

  return getBrieflyJson<ArticleSearchResponse>(
    `${endpoint}?${params.toString()}`,
  );
}

/** Compatibility endpoint: keep its existing result universe for other clients. */
export function searchBrieflyArticles(
  query: string,
  options?: SearchOptions,
): Promise<ArticleSearchResponse> {
  return searchWithEndpoint("/api/article-search", query, options);
}

/** Briefly homepage search: all matching clusters, with or without canonical. */
export async function searchBrieflyClusters(
  query: string,
  options?: SearchOptions,
): Promise<ArticleSearchResponse> {
  try {
    return await searchWithEndpoint("/api/article-search/clusters", query, options);
  } catch (error) {
    // During a staggered web/backend rollout, keep search usable until the
    // opt-in endpoint exists. Never hide a real SQL/service error as a 404.
    if (error instanceof Error && error.message.includes("Briefly API request failed (404)")) {
      return searchBrieflyArticles(query, options);
    }
    throw error;
  }
}

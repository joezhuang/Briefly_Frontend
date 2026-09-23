import { getBrieflyJson } from "@/api/briefly";
import type { CanonicalArticle } from "@/models/article";

export type ArticleSearchResponse = {
  articles: CanonicalArticle[];
  count: number;
  query: string;
  language: string;
  feed_language: "en";
  search_scope: "event_universe";
};

export function searchBrieflyArticles(
  query: string,
  options?: {
    language?: string;
    includeDraft?: boolean;
    limit?: number;
  },
): Promise<ArticleSearchResponse> {
  const params = new URLSearchParams({
    q: query.trim(),
    language: options?.language ?? "en",
    include_draft: String(options?.includeDraft ?? false),
    limit: String(options?.limit ?? 30),
  });

  return getBrieflyJson<ArticleSearchResponse>(
    `/api/article-search?${params.toString()}`,
  );
}

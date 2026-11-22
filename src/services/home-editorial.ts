import type { CanonicalArticle } from "../models/article";

/**
 * Build editorial sections from the already-ranked homepage feed.
 *
 * Never infer developing-story relationships from similarity or shared topics:
 * only explicit group counts from the existing backend are eligible. Promotions
 * are bounded to the first page so loading more cannot reorder the header.
 * Every promoted event is removed from the ordinary feed, once.
 */
export function selectHomepageDevelopments(
  articles: CanonicalArticle[],
  maxHighlights: number,
  pageSize = 20,
): {
  developingHighlights: CanonicalArticle[];
  remaining: CanonicalArticle[];
} {
  const developingHighlights: CanonicalArticle[] = [];
  const groups = new Set<string>();
  const count = Math.max(0, Math.floor(maxHighlights));

  for (const article of articles.slice(3, Math.max(3, pageSize))) {
    if (developingHighlights.length >= count) break;
    if ((article.developing_story_count ?? 0) <= 1) continue;
    const group = article.developing_story_id || article.event_id;
    if (groups.has(group)) continue;
    groups.add(group);
    developingHighlights.push(article);
  }

  const promotedEventIds = new Set(
    developingHighlights.map((article) => article.event_id),
  );
  return {
    developingHighlights,
    remaining: articles.slice(3).filter(
      (article) => !promotedEventIds.has(article.event_id),
    ),
  };
}

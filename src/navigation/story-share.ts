import type { CanonicalArticle } from "@/models/article";

export function buildPublicStoryShareUrl(
  article: CanonicalArticle,
  _href?: string,
) {
  const webBase = process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL?.replace(/\/$/, "");
  const eventId = String(article.event_id || "").trim();
  if (!webBase || !eventId) return null;

  return `${webBase}/s/${encodeURIComponent(eventId)}`;
}

import type { CanonicalArticle } from "@/models/article";

export function buildPublicStoryShareUrl(
  article: CanonicalArticle,
  _href?: string,
  uiLanguage?: string,
) {
  const webBase = process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL?.replace(/\/$/, "");
  const eventId = String(article.event_id || "").trim();
  if (!webBase || !eventId) return null;

  const url = new URL(`${webBase}/s/${encodeURIComponent(eventId)}`);
  if (uiLanguage) url.searchParams.set("ui", uiLanguage);
  return url.toString();
}

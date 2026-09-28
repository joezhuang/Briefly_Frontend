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

  const contentLanguage = String(
    article.content_language ?? article.language ?? "",
  ).trim();
  if (["en", "es", "ja", "zh-CN", "zh-TW"].includes(contentLanguage)) {
    url.searchParams.set("content", contentLanguage);
  }
  return url.toString();
}

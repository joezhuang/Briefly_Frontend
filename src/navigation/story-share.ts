import type { CanonicalArticle } from "@/models/article";

function readingLanguageFromHref(href?: string) {
  if (!href) return null;
  try {
    const url = new URL(href, "https://briefly.local");
    const candidate = String(url.searchParams.get("read") || "").trim();
    return /^[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(candidate)
      ? candidate
      : null;
  } catch {
    return null;
  }
}

export function buildPublicStoryShareUrl(
  article: CanonicalArticle,
  _href?: string,
  uiLanguage?: string,
  readingLanguage?: string,
  contentLanguageOverride?: string,
) {
  const webBase = process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL?.replace(/\/$/, "");
  const eventId = String(article.event_id || "").trim();
  if (!webBase || !eventId) return null;

  const url = new URL(`${webBase}/s/${encodeURIComponent(eventId)}`);
  if (uiLanguage) url.searchParams.set("ui", uiLanguage);

  const contentLanguage = String(
    contentLanguageOverride ??
      article.content_language ??
      article.language ??
      "",
  ).trim();
  if (["en", "es", "ja", "zh-CN", "zh-TW"].includes(contentLanguage)) {
    url.searchParams.set("content", contentLanguage);
  }
  const effectiveReadingLanguage =
    (/^[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(
      String(readingLanguage || "").trim(),
    )
      ? String(readingLanguage).trim()
      : null) ?? readingLanguageFromHref(_href);
  if (effectiveReadingLanguage) {
    url.searchParams.set("read", effectiveReadingLanguage);
  }
  return url.toString();
}

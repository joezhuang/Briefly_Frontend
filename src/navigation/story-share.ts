import type { CanonicalArticle } from "@/models/article";

const BRIEFLY_UI_LANGUAGES = ["en", "es", "ja", "zh-CN", "zh-TW"] as const;

function uiLanguageFromHref(href?: string) {
  if (!href) return null;
  try {
    const url = new URL(href, "https://briefly.local");
    const candidate = String(url.searchParams.get("ui") || "").trim();
    return BRIEFLY_UI_LANGUAGES.includes(
      candidate as (typeof BRIEFLY_UI_LANGUAGES)[number],
    )
      ? candidate
      : null;
  } catch {
    return null;
  }
}

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
  bilingualPair?: { translationVersionId: number; englishVersionId: number } | null,
) {
  const webBase = process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL?.replace(/\/$/, "");
  const eventId = String(article.event_id || "").trim();
  if (!webBase || !eventId) return null;

  const url = new URL(`${webBase}/s/${encodeURIComponent(eventId)}`);
  const uiFromHref = uiLanguageFromHref(_href);
  const fallbackUiLanguage = BRIEFLY_UI_LANGUAGES.includes(
    String(uiLanguage || "") as (typeof BRIEFLY_UI_LANGUAGES)[number],
  )
    ? String(uiLanguage)
    : null;
  const effectiveUiLanguage = uiFromHref ?? fallbackUiLanguage;
  if (effectiveUiLanguage) {
    url.searchParams.set("ui", effectiveUiLanguage);
  }

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
  if (
    bilingualPair &&
    Number.isSafeInteger(bilingualPair.translationVersionId) &&
    bilingualPair.translationVersionId > 0 &&
    Number.isSafeInteger(bilingualPair.englishVersionId) &&
    bilingualPair.englishVersionId > 0
  ) {
    url.searchParams.set("mode", "bilingual");
    url.searchParams.set("translationVersion", String(bilingualPair.translationVersionId));
    url.searchParams.set("englishVersion", String(bilingualPair.englishVersionId));
  }
  return url.toString();
}

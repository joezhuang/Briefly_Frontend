import type { CanonicalArticle } from "@/models/article";

function normalizeStoryHref(article: CanonicalArticle, href?: string) {
  const fallbackPath = `/story/${encodeURIComponent(article.slug)}`;
  const raw = String(href || fallbackPath).trim();
  const [pathPart, queryPart = ""] = raw.split("?", 2);
  const path = pathPart || fallbackPath;
  const params = new URLSearchParams(queryPart);

  if (article.event_id && !params.get("eventId")) {
    params.set("eventId", article.event_id);
  }
  if (article.headline && !params.get("previewHeadline")) {
    params.set("previewHeadline", article.headline);
  }
  if (article.image_url && !params.get("imageUrl")) {
    params.set("imageUrl", article.image_url);
  }
  if (article.video_url && !params.get("videoUrl")) {
    params.set("videoUrl", article.video_url);
  }

  params.set("source", "share");
  params.delete("community");
  params.delete("savedSnapshotId");

  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

export function buildPublicStoryShareUrl(
  article: CanonicalArticle,
  href?: string,
) {
  const webBase = process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL?.replace(/\/$/, "");
  if (!webBase) return null;
  return `${webBase}${normalizeStoryHref(article, href)}`;
}

const DEFAULT_API_BASE = "https://briefly-api.deeplyapp.uk";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function apiBase() {
  return String(
    process.env.BRIEFLY_PUBLIC_BASE_URL ||
      process.env.EXPO_PUBLIC_BRIEFLY_API_URL ||
      DEFAULT_API_BASE,
  ).replace(/\/$/, "");
}

async function loadArticle(key, legacyVersion) {
  const path = legacyVersion
    ? `/api/articles/version/${encodeURIComponent(key)}?include_draft=false`
    : `/api/lazy-articles/event/${encodeURIComponent(
        key,
      )}?language=en&include_draft=false`;

  const response = await fetch(`${apiBase()}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Briefly article lookup failed: ${response.status}`);
  }

  return response.json();
}

function validRemoteImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

module.exports = async function handler(request, response) {
  const key = String(first(request.query.eventId) || "").trim();
  const legacyVersion = String(first(request.query.legacyVersion) || "") === "1";

  if (!key) {
    response.statusCode = 400;
    response.end("Missing Briefly event");
    return;
  }

  try {
    const article = await loadArticle(key, legacyVersion);
    const imageUrl = validRemoteImageUrl(
      article.video_thumbnail_url || article.image_url,
    );

    if (!imageUrl) {
      response.statusCode = 404;
      response.setHeader("Cache-Control", "no-store");
      response.end("Story image unavailable");
      return;
    }

    const upstream = await fetch(imageUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; BrieflyShareCard/1.0; +https://briefly-news-analysis.vercel.app)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });

    if (!upstream.ok) {
      throw new Error(`Upstream image failed: ${upstream.status}`);
    }

    const contentType = String(
      upstream.headers.get("content-type") || "",
    ).split(";")[0].trim().toLowerCase();

    if (!contentType.startsWith("image/")) {
      throw new Error(`Upstream did not return an image: ${contentType || "unknown"}`);
    }

    const declaredLength = Number(upstream.headers.get("content-length") || 0);
    if (declaredLength > MAX_IMAGE_BYTES) {
      response.statusCode = 413;
      response.end("Story image is too large");
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length > MAX_IMAGE_BYTES) {
      response.statusCode = 413;
      response.end("Story image is too large");
      return;
    }

    response.statusCode = 200;
    response.setHeader("Content-Type", contentType);
    response.setHeader("Content-Length", String(buffer.length));
    response.setHeader(
      "Cache-Control",
      legacyVersion
        ? "public, s-maxage=86400, stale-while-revalidate=604800"
        : "public, s-maxage=300, stale-while-revalidate=3600",
    );
    response.setHeader("Content-Disposition", "inline");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.end(buffer);
  } catch (error) {
    console.error("[Briefly share image]", error);
    response.statusCode = 502;
    response.setHeader("Cache-Control", "no-store");
    response.end("Story image unavailable");
  }
};

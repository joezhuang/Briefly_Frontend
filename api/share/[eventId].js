const DEFAULT_API_BASE = "https://briefly-api.deeplyapp.uk";

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainText(value) {
  return String(value ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, max = 220) {
  const text = plainText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function absoluteUrl(value, origin) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    return new URL(raw, origin).toString();
  } catch {
    return null;
  }
}

function storyDestination(article) {
  const slug = String(article.slug || "").trim();
  const eventId = String(article.event_id || "").trim();
  if (!slug || !eventId) return "/";

  const params = new URLSearchParams({
    eventId,
    source: "share",
  });

  const headline = String(article.headline || "").trim();
  const imageUrl = String(
    article.video_thumbnail_url || article.image_url || "",
  ).trim();
  const videoUrl = String(article.video_url || "").trim();

  if (headline) params.set("previewHeadline", headline);
  if (imageUrl) params.set("imageUrl", imageUrl);
  if (videoUrl) params.set("videoUrl", videoUrl);

  return `/story/${encodeURIComponent(slug)}?${params.toString()}`;
}

async function loadArticle(key, legacyVersion) {
  const apiBase = String(
    process.env.BRIEFLY_PUBLIC_BASE_URL ||
      process.env.EXPO_PUBLIC_BRIEFLY_API_URL ||
      DEFAULT_API_BASE,
  ).replace(/\/$/, "");

  const path = legacyVersion
    ? `/api/articles/version/${encodeURIComponent(key)}?include_draft=false`
    : `/api/lazy-articles/event/${encodeURIComponent(
        key,
      )}?language=en&include_draft=false`;

  const response = await fetch(`${apiBase}${path}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Briefly article lookup failed: ${response.status}`);
  }

  return response.json();
}

function unavailableHtml(homeUrl) {
  const safeHome = escapeHtml(homeUrl);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,follow">
  <title>Briefly — Story unavailable</title>
</head>
<body>
  <main>
    <h1>Story unavailable</h1>
    <p>This Briefly story could not be loaded.</p>
    <p><a href="${safeHome}">Open Briefly</a></p>
  </main>
</body>
</html>`;
}

module.exports = async function handler(request, response) {
  const key = String(first(request.query.eventId) || "").trim();
  const legacyVersion = String(first(request.query.legacyVersion) || "") === "1";
  const protocol = String(
    first(request.headers["x-forwarded-proto"]) || "https",
  ).split(",")[0].trim();
  const host = String(request.headers.host || "briefly-news-analysis.vercel.app");
  const origin = `${protocol}://${host}`;

  if (!key) {
    response.statusCode = 400;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(unavailableHtml(origin));
    return;
  }

  try {
    const article = await loadArticle(key, legacyVersion);
    const destinationPath = storyDestination(article);
    const destinationUrl = new URL(destinationPath, origin).toString();

    const eventId = String(article.event_id || key).trim();
    const shareUrl = legacyVersion
      ? `${origin}/share/${encodeURIComponent(key)}`
      : `${origin}/s/${encodeURIComponent(eventId)}`;

    const title = truncate(article.headline || "Briefly", 120);
    const description = truncate(
      article.standfirst ||
        article.what_happened ||
        article.why_it_matters ||
        "Understand what happened, why it matters, and what comes next.",
      220,
    );
    const imageUrl = absoluteUrl(
      article.video_thumbnail_url || article.image_url,
      origin,
    );

    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    const safeShareUrl = escapeHtml(shareUrl);
    const safeDestination = escapeHtml(destinationUrl);
    const safeImage = imageUrl ? escapeHtml(imageUrl) : "";
    const redirectJson = JSON.stringify(destinationUrl).replace(/</g, "\\u003c");

    response.statusCode = 200;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader(
      "Cache-Control",
      legacyVersion
        ? "public, s-maxage=86400, stale-while-revalidate=604800"
        : "public, s-maxage=300, stale-while-revalidate=3600",
    );

    response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,follow">
  <meta name="theme-color" content="#208AEF">

  <title>${safeTitle}</title>
  <link rel="canonical" href="${safeDestination}">

  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Briefly">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:url" content="${safeShareUrl}">
  ${safeImage ? `<meta property="og:image" content="${safeImage}">` : ""}

  <meta name="twitter:card" content="${safeImage ? "summary_large_image" : "summary"}">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  ${safeImage ? `<meta name="twitter:image" content="${safeImage}">` : ""}
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    <p><a href="${safeDestination}">Open this story in Briefly</a></p>
  </main>
  <script>window.location.replace(${redirectJson});</script>
</body>
</html>`);
  } catch (error) {
    console.error("[Briefly share card]", error);
    response.statusCode = 404;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(unavailableHtml(origin));
  }
};

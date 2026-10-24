const CANONICAL_BRIEFLY_WEB_URL = "https://briefly-news.deeplyapp.uk";
const LEGACY_BRIEFLY_WEB_URLS = new Set([
  "https://briefly-news-analysis.vercel.app",
]);

function normalizeBase(value: string | undefined | null): string | null {
  const normalized = String(value || "").trim().replace(/\/$/, "");
  return normalized || null;
}

export function getBrieflyPublicWebBase(): string {
  const configured = normalizeBase(process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL);

  // Existing Vercel links remain valid, but new public/share links should use
  // the custom Briefly domain even while a deployment still carries the old
  // environment value.
  if (!configured || LEGACY_BRIEFLY_WEB_URLS.has(configured)) {
    return CANONICAL_BRIEFLY_WEB_URL;
  }

  return configured;
}

export function isLegacyBrieflyWebBase(value: string): boolean {
  const normalized = normalizeBase(value);
  return normalized ? LEGACY_BRIEFLY_WEB_URLS.has(normalized) : false;
}

export { CANONICAL_BRIEFLY_WEB_URL };

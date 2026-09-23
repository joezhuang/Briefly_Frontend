import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireAll(relativePath, needles) {
  const source = read(relativePath);
  const missing = needles.filter((needle) => !source.includes(needle));
  if (missing.length) {
    throw new Error(
      `${relativePath} is missing journey contract(s): ${missing.join(", ")}`,
    );
  }
}

const checks = [
  {
    name: "Feed renders canonical story tiles and records feed views",
    file: "src/app/index.tsx",
    needles: ["getHomepageArticleFeed", "StoryTile", 'trackProductEvent("feed_view"'],
  },
  {
    name: "Runtime feature controls are enforced by navigation and screens",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      'label="Search"',
      'onChange("search_enabled"',
      'label="Following"',
      'onChange("following_enabled"',
    ],
  },
  {
    name: "Search and Following screens consume runtime feature controls",
    file: "src/app/search.tsx",
    needles: [
      "useBrieflyAppConfig",
      "appConfig?.search_enabled !== false",
    ],
  },
  {
    name: "Homepage feed response contract matches multilingual backend",
    file: "src/api/briefly.ts",
    needles: [
      'feed_language: "en" | "multilingual"',
      'canonical_article_language?: "en"',
      "/api/article-feed?",
      "national_coverage?:",
      "local_coverage?:",
    ],
  },
  {
    name: "Story tile opens the canonical story route",
    file: "src/components/story-tile.tsx",
    needles: [
      "/story/${article.slug}?",
      "router.push(storyHref as never)",
      "buildPublicStoryShareUrl(article, storyHref)",
      "const articleReady = article.article_version_id != null",
      "{articleReady && (",
      "BrieflyMediaFallback",
    ],
  },
  {
    name: "Story screen composes article, Community, and podcast actions",
    file: "src/app/story/[slug].tsx",
    needles: [
      "ArticleView",
      "EventCommunityPanel",
      "handlePodcastAction",
      "requestPodcastAnalysis",
      'focusCommunity={resolvedCommunity === "1"}',
      "shareHref={currentStoryHref}",
    ],
  },
  {
    name: "Lens exposes Evidence, Timeline, Coverage and records explicit selection",
    file: "src/components/event-evidence-panel.tsx",
    needles: [
      'type EventLens = "evidence" | "timeline" | "coverage"',
      'trackProductEvent("event_lens_select"',
      'id: "evidence"',
      'id: "timeline"',
      'id: "coverage"',
    ],
  },
  {
    name: "Source coverage opens originals and records source opens",
    file: "src/components/article-view.tsx",
    needles: [
      'trackProductEvent("source_open"',
      "Linking.openURL(item.url)",
      'window.open(item.url,"_blank","noopener,noreferrer")',
    ],
  },
  {
    name: "Story sharing uses rich-card short URLs and Community focus survives async layout",
    file: "src/components/article-view.tsx",
    needles: [
      "buildPublicStoryShareUrl(article,shareHref)",
      "onContentSizeChange",
      "communityFocusActiveRef",
      "onScrollBeginDrag",
    ],
  },
  {
    name: "Rich share endpoint provides Open Graph metadata and legacy share compatibility",
    file: "api/share/[eventId].js",
    needles: [
      'property="og:title"',
      'property="og:description"',
      'property="og:image"',
      'property="og:image:secure_url"',
      'name="twitter:card"',
      'window.location.replace',
      'legacyVersion',
      'source: "share"',
      '/api/og/',
    ],
  },
  {
    name: "Share image proxy serves crawler-friendly story images from Briefly",
    file: "api/og/[eventId].js",
    needles: [
      "imageCandidates(article, origin)",
      "youtubeVideoId",
      "maxresdefault.jpg",
      "hqdefault.jpg",
      "/briefly-share-default.png",
      "BrieflyShareCard/1.0",
      'contentType.startsWith("image/")',
      '"Content-Disposition", "inline"',
      "MAX_IMAGE_BYTES",
    ],
  },
  {
    name: "Vercel routes short and legacy share links through the rich-card function",
    file: "vercel.json",
    needles: [
      '"/s/:eventId"',
      '"/api/share/:eventId"',
      '"/share/:versionId"',
      'legacyVersion=1',
    ],
  },
  {
    name: "Client share helper emits stable event-based short links",
    file: "src/navigation/story-share.ts",
    needles: [
      '/s/',
      'encodeURIComponent(eventId)',
    ],
  },
  {
    name: "Follow is authenticated, reversible, and linked from the story",
    file: "src/components/event-follow-button.tsx",
    needles: [
      "getEventFollowState",
      "followEvent(eventId)",
      "unfollowEvent(eventId)",
      "/sign-in?returnTo=",
      'trackProductEvent(next ? "event_follow" : "event_unfollow"',
    ],
  },
  {
    name: "Saved stories are locally persisted and instrumented",
    file: "src/context/saved-articles.tsx",
    needles: [
      "readSavedSnapshots",
      "writeSavedSnapshots",
      'trackProductEvent(exists ? "story_unsave" : "story_save"',
    ],
  },
  {
    name: "Article action is wired to saved-story state",
    file: "src/components/article-view.tsx",
    needles: ["useSavedArticles", "toggleSaved"],
  },
  {
    name: "Podcast status, generation and inline playback are wired",
    file: "src/components/article-view.tsx",
    needles: ["PodcastInlinePlayer"],
  },
  {
    name: "Podcast API contract matches the canonical article-version route",
    file: "src/api/briefly.ts",
    needles: [
      "/api/articles/version/",
      "/podcast?",
      "getPodcastAnalysisStatus",
      "requestPodcastAnalysis",
    ],
  },
  {
    name: "Community supports create, reaction, report and withdrawal",
    file: "src/components/event-community-panel.tsx",
    needles: [
      "getEventCommunity",
      "createCommunityContribution",
      "setCommunityReaction",
      "reportCommunityContribution",
      "withdrawCommunityContribution",
      "communityMutationError",
      "text.rateLimited",
      "/sign-in?returnTo=",
    ],
  },
  {
    name: "Community client routes match the backend contract",
    file: "src/api/briefly.ts",
    needles: [
      "/api/community/events/",
      "/contributions",
      "/reaction",
      "/report",
      "/moderation",
    ],
  },
  {
    name: "Admin dashboard exposes Community moderation",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      "getCommunityModerationQueue",
      "setCommunityContributionVisibility",
      'title="Community moderation"',
    ],
  },
  {
    name: "Admin dashboard exposes read-only customer support diagnostics",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      "getBetaDashboardCustomerSupport",
      'title="Customer support"',
      '"Profile / ledger consistency"',
      '"Billing event history"',
      "result.billing_events",
      '"Subscription ledger"',
    ],
  },
  {
    name: "Journey analytics names remain registered",
    file: "src/analytics/product-analytics.ts",
    needles: [
      '"feed_view"',
      '"story_open"',
      '"story_save"',
      '"event_follow"',
      '"event_lens_select"',
      '"source_open"',
      '"podcast_action"',
      '"community_contribution_create"',
      '"community_contribution_report"',
      '"community_reaction"',
    ],
  },
];

let passed = 0;
for (const check of checks) {
  requireAll(check.file, check.needles);
  passed += 1;
  process.stdout.write(`✓ ${check.name}\n`);
}

process.stdout.write(
  `\nBriefly beta user-journey contract: ${passed}/${checks.length} checks passed.\n`,
);

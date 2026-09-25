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
    name: "Remote operations and default feed controls affect the product",
    file: "src/app/index.tsx",
    needles: [
      "didApplyDefaultScopeRef",
      "appConfig.default_feed_scope",
      "enabledHomeScopes(appConfig)",
    ],
  },
  {
    name: "Google OAuth always requests explicit account selection",
    file: "src/context/auth.tsx",
    needles: [
      'provider === "google"',
      'prompt: "select_account"',
      "queryParams: providerQueryParams",
    ],
  },
  {
    name: "Maintenance mode gates the news experience but preserves recovery routes",
    file: "src/app/_layout.tsx",
    needles: [
      "appConfig?.maintenance_mode",
      'pathname.startsWith("/beta-dashboard")',
      'pathname.startsWith("/account")',
      "appConfig.maintenance_message",
    ],
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
    name: "Single-source Local stories bypass canonical extraction",
    file: "src/components/story-tile.tsx",
    needles: [
      'analyticsScope === "local"',
      "article.article_count === 1",
      "article.source_url",
      "singleSourceLocalCoverage",
      "WebBrowser.openBrowserAsync",
      'surface: "local_single_source_feed"',
    ],
  },
  {
    name: "Direct Local story routes inspect coverage before generation",
    file: "src/app/story/[slug].tsx",
    needles: [
      'prepare: resolvedScope !== "local"',
      "canonicalResponse.article_count === 1",
      "canonicalResponse.source_url",
      "setSingleSourceLocal(coverage)",
      "SingleSourceLocalArticle",
      "prepare: true",
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
    name: "Community analytics measure reach and participation",
    file: "src/components/event-community-panel.tsx",
    needles: [
      '"community_panel_load"',
      '"community_contribution_start"',
      '"community_contribution_create"',
      '"community_source_open"',
      "has_source:",
      "contribution_count:",
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
    name: "Admin dashboard exposes audit history and runtime rollback",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      "getBetaDashboardAdminAuditLog",
      "getBetaDashboardAppConfigHistory",
      "rollbackBetaDashboardAppConfig",
      'title="Runtime configuration history"',
      'title="Admin audit log"',
      '"Restore previous"',
    ],
  },
  {
    name: "Upgrade flow emits subscription conversion events",
    file: "src/app/upgrade.tsx",
    needles: [
      '"subscription_upgrade_view"',
      '"subscription_plan_select"',
      '"subscription_purchase_complete"',
      '"subscription_restore_start"',
      '"subscription_restore_complete"',
    ],
  },
  {
    name: "Subscription clients emit provider checkout events",
    file: "src/subscriptions/index.ts",
    needles: [
      '"subscription_checkout_start"',
      '"subscription_checkout_cancel"',
      '"subscription_purchase_complete"',
    ],
  },
  {
    name: "Account subscription actions emit restore and management events",
    file: "src/app/account.tsx",
    needles: [
      '"subscription_restore_start"',
      '"subscription_restore_complete"',
      '"subscription_manage_open"',
    ],
  },
  {
    name: "Social Beta exposes Community engagement analytics",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      '{ id: "community", label: "Community" }',
      '"Community-loaded sessions"',
      '"Published"',
      '"Returning contributors"',
      'title="Contribution types"',
      'title="Reaction actions"',
      'title="Report reasons"',
    ],
  },
  {
    name: "Subscription conversion analytics cover upgrade to paid",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      '{ id: "subscriptions", label: "Subscriptions" }',
      'title="Subscription conversion"',
      '"Completed purchase"',
      '"Upgrade → paid"',
      'title="Plan selections"',
      'title="Completed purchases by provider"',
    ],
  },
  {
    name: "Beta dashboard exposes version and release visibility",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      'title="Version & release visibility"',
      '"Dashboard runtime"',
      '"Backend release"',
      'title="Observed client releases"',
      'title="Errors by release"',
    ],
  },
  {
    name: "Client telemetry includes build-aware release identity",
    file: "src/release/runtime-release.ts",
    needles: [
      "+build.",
      "+web.",
      "nativeBuildVersion",
      "telemetryVersion",
      "EXPO_PUBLIC_BRIEFLY_GIT_SHA",
    ],
  },
  {
    name: "Controlled rollout settings expose stable platform percentages",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      'title="Controlled rollout"',
      '"Percentage rollout"',
      "Cohort key",
      '"Web rollout (%)"',
      '"iOS rollout (%)"',
      '"Android rollout (%)"',
      "Legacy clients that do not send a rollout identity remain allowed",
    ],
  },
  {
    name: "API requests send stable rollout identity",
    file: "src/rollouts/identity.ts",
    needles: [
      '"briefly.rollout-id.v1"',
      '"X-Briefly-Rollout-Id"',
      '"X-Briefly-Platform"',
      "AsyncStorage",
    ],
  },
  {
    name: "Following requests participate in the same rollout cohort",
    file: "src/api/event-follow.ts",
    needles: [
      "getBrieflyRolloutHeaders",
      "await getBrieflyRolloutHeaders()",
      '"@/rollouts/identity"',
    ],
  },
  {
    name: "Beta dashboard exposes AI usage and cost metering",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      'title="AI usage & cost"',
      '"Model calls"',
      '"Cloud provider cost"',
      'title="AI operations"',
      'title="Models & providers"',
      "unpriced cloud call(s)",
    ],
  },
  {
    name: "AI metering contract remains optional during backend rollout",
    file: "src/api/briefly.ts",
    needles: [
      "BetaDashboardAiUsage",
      "ai_usage?: BetaDashboardAiUsage",
      "unpriced_cloud_calls",
      "estimated_token_calls",
    ],
  },
  {
    name: "Beta dashboard evaluates telemetry health thresholds",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      'title="Telemetry health & alerts"',
      '"Health status"',
      '"Sessions with client errors"',
      '"Unresolved fatal"',
      "No configured health threshold is currently breached.",
    ],
  },
  {
    name: "Admin dashboard configures health alert thresholds",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      '"Health alerts enabled"',
      '"Minimum sessions for error-rate alerts"',
      '"Warning · server errors / 24h"',
      '"Critical · unresolved errors"',
    ],
  },
  {
    name: "Admin dashboard exposes billing operational health and reconciliation",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      "getBetaDashboardBillingHealth",
      "reconcileBetaDashboardBilling",
      'title="Billing operational health"',
      "Reconcile now",
      'title="Manual reconciliation history"',
      '"Audit storage required"',
      '"RevenueCat"',
      '"Stripe"',
    ],
  },
  {
    name: "Admin dashboard exposes customer support diagnostics",
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
      '"community_panel_load"',
      '"community_contribution_start"',
      '"community_contribution_create"',
      '"community_contribution_report"',
      '"community_reaction"',
      '"community_source_open"',
      '"subscription_upgrade_view"',
      '"subscription_plan_select"',
      '"subscription_checkout_start"',
      '"subscription_purchase_complete"',
      '"subscription_restore_complete"',
      '"subscription_manage_open"',
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

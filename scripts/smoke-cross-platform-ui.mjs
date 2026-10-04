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
      `${relativePath} is missing cross-platform UI contract(s): ${missing.join(", ")}`,
    );
  }
}

const checks = [
  {
    name: "iOS shares the story headline and URL together instead of URL-only",
    file: "src/navigation/platform-share.ts",
    needles: [
      'message: `${headline}\\n${url}`',
      'Platform.OS === "android" ? { title: headline } : {}',
      'Platform.OS === "ios" ? { subject: headline } : undefined',
    ],
  },
  {
    name: "Web sharing uses native Web Share with clipboard fallback",
    file: "src/navigation/platform-share.ts",
    needles: [
      'Platform.OS === "web"',
      'typeof navigator.share === "function"',
      "navigator.clipboard?.writeText",
      'window.prompt("Copy this Briefly link:"',
      "Share.share(",
      'Platform.OS === "ios"',
    ],
  },
  {
    name: "Story page keeps Community controls usable while the mobile keyboard is open",
    file: "src/components/article-view.tsx",
    needles: [
      'keyboardShouldPersistTaps="handled"',
      'keyboardDismissMode={Platform.OS==="ios"?"interactive":"on-drag"}',
      "FloatingStoryVideo",
      "updateFloatingVideo(scrollY)",
      "initialTime={videoResumeTime}",
      "onTimeUpdate={handleStoryVideoTimeUpdate}",
      "onClose={closeFloatingVideo}/>}{!immutable&&showFloatingBack&&<Pressable",
      'window.open(item.url,"_blank","noopener,noreferrer")',
      "shareBrieflyStory({headline:article.headline,url})",
    ],
  },
  {
    name: "Video list uses per-video posters and does not repeat story imagery as thumbnails",
    file: "src/components/article-view.tsx",
    needles: [
      "function youtubeVideoPoster(videoUrl:string):string|null",
      "https://i.ytimg.com/vi/",
      "function videoListPoster(video:ArticleVideo,videos:ArticleVideo[]):string|null",
      "other.url!==video.url",
      "videoListPoster(selectedVideo,videoItems)",
      "!selectedVideo||selectedVideo===videoItems[0]",
      "const poster=videoListPoster(video,videoItems);",
    ],
  },
  {
    name: "Story brief disclosure is consistent across small web and mobile layouts",
    file: "src/components/article-view.tsx",
    needles: [
      "briefTextClip",
      "collapsedLines*28",
      'width<900?{whatHappened:4,whyItMatters:3,whatNext:3}',
      "toggleFromBlock",
      'window.getSelection?.()?.toString().trim()',
      "onPress={selectable&&canExpand?toggleFromBlock:undefined}",
      "onLongPress={selectable&&canExpand?markLongPress:undefined}",
      "Date.now()-longPressAtRef.current<800",
      "selectable?(",
      "briefBlockToggle",
      "briefExpansion.section===id",
      "section:current.articleKey===briefArticleKey&&current.section===id?null:id",
      "selectable={selectable}",
      "account?.is_admin===true",
      "selectable={adminTextSelectable}",
      "<Text selectable={adminTextSelectable} style={[styles.headline",
      "<Text selectable={adminTextSelectable} key={`${p.type}-${i}`}",
      "briefMoreButton",
    ],
  },
  {
    name: "Top Story Detail timeline consumes saved manual order",
    file: "src/components/event-timeline.tsx",
    needles: [
      "ordered_timeline?: EventTimelineItem[]",
      "timeline_order_manual?: boolean",
      "setOrderedItems(",
      "setManualOrder(payload.timeline_order_manual === true)",
      "manualOrder && orderedItems.length > 0",
      "items={orderedItems}",
    ],
  },
  {
    name: "Admin can drag, save, and reset Story Detail timeline order",
    file: "src/components/event-evolution-panel.tsx",
    needles: [
      "PanResponder.create",
      "ADMIN_TIMELINE_ROW_HEIGHT",
      "const itemKey = item.order_key || item.id",
      "current.findIndex(",
      "timeline?.ordered_timeline",
      ": orderedOccurredItems;",
      "saveEventTimelineOrder(eventId, keys)",
      "resetEventTimelineOrder(eventId)",
      "AdminTimelineDragRow",
      "text.adjustOrder",
      "text.dragHint",
    ],
  },
  {
    name: "Timeline ordering API exposes additive manual override controls",
    file: "src/api/event-evolution.ts",
    needles: [
      "ordered_timeline?: EventTimelineItem[]",
      "timeline_order_manual?: boolean",
      "saveEventTimelineOrder",
      "resetEventTimelineOrder",
      "/timeline/order",
    ],
  },
  {
    name: "Admin can select major Story Detail evidence and timeline text",
    file: "src/components/event-evidence-panel.tsx",
    needles: [
      "const adminTextSelectable = account?.is_admin === true",
      "selectable={adminTextSelectable}",
      "adminTextSelectable={adminTextSelectable}",
    ],
  },
  {
    name: "Admin selection propagates through Story Detail coverage",
    file: "src/components/event-coverage-panel.tsx",
    needles: [
      "adminTextSelectable?: boolean",
      "selectable={adminTextSelectable}",
      "selectable={selectable}",
    ],
  },
  {
    name: "Admin selection propagates through Story Detail evolution",
    file: "src/components/event-evolution-panel.tsx",
    needles: [
      "adminTextSelectable?: boolean",
      "selectable={adminTextSelectable}",
      "styles.timelineTitle",
    ],
  },
  {
    name: "Admin can select standalone story timeline content",
    file: "src/components/event-timeline.tsx",
    needles: [
      "const adminTextSelectable = account?.is_admin === true",
      "selectable={adminTextSelectable}",
      "selectable={selectable}",
    ],
  },
  {
    name: "Feed story actions expose accessible navigation and mobile-sized targets",
    file: "src/components/story-tile.tsx",
    needles: [
      'accessibilityRole={Platform.OS === "web" ? "link" : "button"}',
      "accessibilityLabel={displayedHeadline}",
      "width: 44",
      "height: 44",
      "styles.actionIconButton",
      "styles.videoStoryLink",
      "autoplayVideo=1&videoTime=",
      "setActiveHomepageVideo(null)",
      "router.push(nextHref as never)",
      "videoDetached",
      "onVideoTimeUpdate?.(article.event_id, seconds)",
      "accessibilityLabel={copy.share}",
      "accessibilityLabel={copy.community}",
      "accessibilityLabel={copy.play}",
      "shareBrieflyStory({",
      "BrieflyMediaFallback",
      'bottom: { gap: 10, paddingBottom: 54 }',
      'position: "absolute"',
      "bottom: 22",
      "left: 22",
      "right: 22",
    ],
  },
  {
    name: "Home keeps one active video session floating across feed scroll",
    file: "src/app/index.tsx",
    needles: [
      "FloatingStoryVideo",
      "videoSessionRef",
      "outsideViewport !== videoFloatingRef.current",
      "setVideoResumeTime(Math.max(0, session.currentTime))",
      "videoTime=",
      "stopActiveHomepageVideo()",
    ],
  },
  {
    name: "Video player reports progress and resumes from a supplied timestamp",
    file: "src/components/story-video.tsx",
    needles: [
      "timeUpdateEventInterval = 0.5",
      'player.addListener("timeUpdate"',
      'player.addListener("playingChange"',
      "instance.currentTime = startTime",
      "initialTime={startTime}",
    ],
  },
  {
    name: "Video engines stop explicitly when an old player unmounts",
    file: "src/components/story-video.tsx",
    needles: [
      "player.pause()",
      "}, [player]);",
    ],
  },
  {
    name: "Web embedded video tears down cross-origin media on unmount",
    file: "src/components/story-video-embed.web.tsx",
    needles: [
      'func: "stopVideo"',
      '{ method: "pause" }',
      '{ method: "unload" }',
      'iframe.src = "about:blank"',
    ],
  },
  {
    name: "Community interactive controls use mobile-sized touch targets",
    file: "src/components/event-community-panel.tsx",
    needles: [
      "ownerActionButton: { minHeight: 44",
      "sourceLinkButton: { minHeight: 44",
      "reactionButton: {",
      "minHeight: 44",
      'accessibilityRole="button"',
      'accessibilityRole="link"',
    ],
  },
  {
    name: "Reading language card and long translation labels fit narrow story screens",
    file: "src/components/web-translate-button.tsx",
    needles: [
      'alignSelf: "stretch"',
      'maxWidth: "100%"',
      'minWidth: 0',
      'flexShrink: 1',
      'textAlign: "center"',
    ],
  },
  {
    name: "Story Detail constrains the reading-language wrapper to article width",
    file: "src/components/article-view.tsx",
    needles: [
      'translationAction:{marginTop:22,width:"100%",maxWidth:520,minWidth:0,alignSelf:"flex-start"}',
    ],
  },
  {
    name: "Follow control uses a mobile-sized touch target",
    file: "src/components/event-follow-button.tsx",
    needles: ["minHeight: 44"],
  },
  {
    name: "Podcast inline controls use mobile-sized touch targets",
    file: "src/components/podcast-inline-player.tsx",
    needles: ["primaryButton:", "secondaryButton:", "minHeight: 44"],
  },
  {
    name: "Header has phone and compact breakpoints with accessible targets",
    file: "src/components/app-header.tsx",
    needles: [
      "const compactNav = width < 1200",
      "const phoneNav = width < 600",
      "minHeight: 44",
      "width: 44",
      "height: 44",
      "BrieflyLogo",
    ],
  },
  {
    name: "Bilingual generation is explicit, gated and read-only when polling",
    file: "src/app/story/[slug].tsx",
    needles: [
      'bilingualReaderFeatureEnabled',
      'prepare: !isSharedStory && !bilingualReaderFeatureEnabled',
      'bilingualGenerationAction={showBilingualGeneration',
      'bilingualGenerationBusy',
      'requestBilingualTranslation = async () =>',
      'if (!user) {',
      'if (!isPro) {',
      'prepare: true,',
      'prepare: false,',
      'matchedBilingualOriginal(localized, authoritativeArticle)',
      'setLanguageMode("bilingual")',
      'BILINGUAL_MAX_POLLS',
      'isSharedStory',
    ],
  },
  {
    name: "Existing story view accepts a gated bilingual generation action",
    file: "src/components/article-view.tsx",
    needles: [
      'bilingualGenerationAction?:ReactNode',
      'bilingualGenerationAction&&<View style={styles.translationAction}',
    ],
  },
  {
    name: "Bilingual reader is opted-in through the existing runtime dashboard",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      'label="Bilingual reader (experimental)"',
      'onChange("bilingual_reader_enabled", value)',
    ],
  },
  {
    name: "Bilingual story only pairs the authenticated English source version",
    file: "src/components/bilingual-reading.tsx",
    needles: [
      "matchedBilingualOriginal(",
      "localized.translation_source_article_version_id",
      "localized.event_id !== english.event_id",
      'localized.translation_historical',
      "paragraph.type === englishParagraphs[index].type",
      "styles.pairStacked",
    ],
  },
  {
    name: "Story Detail gates bilingual mode and keeps old reader available",
    file: "src/app/story/[slug].tsx",
    needles: [
      "appConfig?.bilingual_reader_enabled === true",
      "matchedBilingualOriginal(article, authoritativeArticle)",
      'languageMode === "bilingual" && !bilingualEnabled',
      "includeBilingual={bilingualEnabled}",
      'effectiveLanguageMode === "bilingual" && bilingualEnabled',
    ],
  },
  {
    name: "Story content has an opt-in bilingual rendering path",
    file: "src/components/article-view.tsx",
    needles: [
      "bilingualOriginal?:CanonicalArticle|null",
      "bilingualOriginal?<BilingualBrief",
      "bilingualOriginal?<BilingualBody",
    ],
  },
  {
    name: "Error/retry state has a mobile-sized retry target",
    file: "src/components/screen-state.tsx",
    needles: ["minHeight: 44", 'justifyContent: "center"'],
  },
];

let passed = 0;
for (const check of checks) {
  requireAll(check.file, check.needles);
  passed += 1;
  process.stdout.write(`✓ ${check.name}\n`);
}

process.stdout.write(
  `\nBriefly cross-platform UI contract: ${passed}/${checks.length} checks passed.\n`,
);

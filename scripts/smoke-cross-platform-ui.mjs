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
    name: "Story route focus and route identity stop old video playback",
    file: "src/app/story/[slug].tsx",
    needles: [
      "useNavigation",
      'navigation.addListener("focus"',
      'navigation.addListener("blur"',
      "storyArticleMatchesRoute",
      "storyMediaActive = storyFocused && storyArticleMatchesRoute",
      "mediaActive={storyMediaActive}",
    ],
  },
  {
    name: "Article and preview video trees unmount while their Story route is inactive",
    file: "src/components/article-view.tsx",
    needles: [
      "mediaActive=true",
      "videoFloating||!mediaActive",
      "mediaActive&&videoAccess.allowed&&floatingVideoEnabled",
    ],
  },
  {
    name: "Preview video also stops when its Story route becomes inactive",
    file: "src/components/event-preview-view.tsx",
    needles: [
      "mediaActive = true",
      "mediaActive ? <StoryVideo",
    ],
  },
  {
    name: "Login nudge uses lower shared thresholds and higher normal web/app engagement",
    file: "src/app/story/[slug].tsx",
    needles: [
      "SHARED_LOGIN_NUDGE_DELAY_MS = 15_000",
      "NORMAL_WEB_LOGIN_NUDGE_DELAY_MS = 60_000",
      "NORMAL_WEB_STORY_OPEN_THRESHOLD = 2",
      "NORMAL_NATIVE_STORY_OPEN_THRESHOLD = 3",
      "anonymousOpenedStoriesThisSession",
      "normalWebLoginNudgeActiveMs",
      "sessionStoryOpenCount >= normalStoryOpenThreshold",
      "anonymousOpenedStoriesThisSession.add(storyIdentity)",
      "isSharedStory",
      "readerEngaged",
      "loginNudgeDelayMs",
      "onReaderEngaged={markReaderEngaged}",
      "LOGIN_NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000",
      "LOGIN_NUDGE_REPEAT_COOLDOWN_MS = 30 * 60 * 1000",
      "mobileWebInstallChoiceActive",
      "loginNudgeCopy",
      "view related videos",
      "router.push(\`/sign-in?returnTo=\${encodeURIComponent(currentStoryHref)}\` as never)",
    ],
  },
  {
    name: "Login nudge floats above the current reading position instead of appearing off-screen",
    file: "src/app/story/[slug].tsx",
    needles: [
      'pointerEvents="box-none" style={styles.loginNudgeHost}',
      'position: "absolute"',
      'bottom: 18',
      'maxWidth: 640',
    ],
  },
  {
    name: "Mobile-web install chooser dismissal releases the later login nudge",
    file: "src/components/shared-app-choice.web.tsx",
    needles: [
      "dismissed?: boolean",
      "props.dismissed",
      "onDismissed?: () => void",
      "props.onDismissed?.()",
    ],
  },
  {
    name: "Follow sign-in preserves shared story state and completes the requested follow",
    file: "src/components/event-follow-button.tsx",
    needles: [
      'params.set("followEvent", eventId)',
      'properties: { source: "story_sign_in_return" }',
      'router.replace(withoutFollowIntent(returnTo) as never)',
      'event_follow_sign_in',
    ],
  },
  {
    name: "Story follow uses the full story href instead of dropping language/share state",
    file: "src/components/article-view.tsx",
    needles: [
      'const followReturnTo=shareHref||',
      'returnTo={followReturnTo}',
    ],
  },
  {
    name: "Story route carries one-time follow intent across OAuth return",
    file: "src/app/story/[slug].tsx",
    needles: [
      'followEvent?: string | string[]',
      'const resolvedFollowEvent = useMemo(',
      'params.set("followEvent", resolvedFollowEvent)',
      'resolvedFollowEvent,',
    ],
  },
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
      '<Text selectable={adminTextSelectable} key={`${p.type}-${i}`}',
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
    name: "Compact reading language row and long translation labels fit narrow screens",
    file: "src/components/web-translate-button.tsx",
    needles: [
      'alignSelf: "stretch"',
      'maxWidth: "100%"',
      'minWidth: 0',
      'flexShrink: 1',
      'textAlign: "center"',
      "styles.headingRow",
      "styles.infoButton",
      "accessibilityState={{ expanded: infoOpen }}",
      "minHeight: 44",
      "{infoOpen && (",
      "{needsGoogleTranslation ? (",
    ],
  },
  {
    name: "Story Detail constrains the reading-language wrapper to article width",
    file: "src/components/article-view.tsx",
    needles: [
      'translationAction:{width:"100%",maxWidth:520,minWidth:0,alignSelf:"flex-start"}',
    ],
  },
  {
    name: "Story translation status is compact and read-only with expandable detail",
    file: "src/components/article-view.tsx",
    needles: [
      "styles.readingControls",
      "styles.localizationCompactRow",
      "accessibilityState={{ expanded: localizationInfoOpen }}",
      "localizationInfoOpen && (",
      "localizationText.compactTitle",
      "localizationText.translated",
      "!localizationDisabled && (",
      'briefCard:{marginTop:16,padding:18,borderRadius:16,gap:18}',
      'actions:{flexDirection:"row",flexWrap:"wrap",gap:10,marginTop:14}',
      "article.source_count??article.sources_used?.length??0",
    ],
  },
  {
    name: "Bilingual summary has a compact top gap and no repeated mobile heading",
    file: "src/components/bilingual-reading.tsx",
    needles: [
      "brief: { marginTop: 16, padding: 18, borderRadius: 16, gap: 18 }",
      "{!stacked && (",
      "styles.sectionHeadingRow",
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
    name: "Dashboard controls cost-aware initial lazy canonical generation",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      "Minimum full-text sources for initial canonical generation",
      'canonicalMinSourcesDraft ?? String(config?.canonical_min_sources ?? 1)',
      'setCanonicalMinSourcesDraft(next)',
      'next !== "" && Number.isInteger(number) && number >= 1 && number <= 20',
      'onChange("canonical_min_sources", number)',
      'disabled={saving || !canonicalMinSourcesValid}',
      "Enter a whole number from 1 to 20 before saving.",
    ],
  },
  {
    name: "Source-only preview keeps video at top and gates playback",
    file: "src/components/event-preview-view.tsx",
    needles: [
      "previewVideoList(article)",
      "<StoryVideo",
      "videoAccess.allowed",
      "playLabel={copy.playVideo}",
      "topVideoSection",
    ],
  },
  {
    name: "Play button text is independent of the source video title",
    file: "src/components/story-video.tsx",
    needles: [
      'playLabel = "Play video"',
      'accessibilityLabel={accessibilityLabel}',
      '<Text style={styles.playText}>{playLabel}</Text>',
      'title={accessibilityLabel}',
    ],
  },
  {
    name: "Historical translations use their own published English source",
    file: "src/app/story/[slug].tsx",
    needles: [
      "getCanonicalArticleByVersionId(oldEnglishSourceId, { includeDraft: canUseDraftTranslation })",
      "matchedBilingualOriginal(article, historicalOriginal)",
      '(value.content_language ?? value.language) === "en"',
      "bilingualLatestEnglishVersionId",
    ],
  },
  {
    name: "Reading language selector appears outside collapsible Story tools",
    file: "src/app/story/[slug].tsx",
    needles: [
      "readingModeAction={canToggleOriginal ? (",
      "bilingualVersionNotice={earlierVersion ? (",
      "shareBilingualPair={",
      "getExperimentalTranslationStatus(",
      "getCanonicalArticleByVersionId(oldEnglishSourceId, { includeDraft: canUseDraftTranslation })",
    ],
  },
  {
    name: "Pro auto-translation reuses version-matched caches and keeps shared reads read-only",
    file: "src/app/story/[slug].tsx",
    needles: [
      'useTranslationPreferences()',
      'autoTranslationRequested.current.has(requestId)',
      'job.status !== "not_requested"',
      'localized.translation_historical === true',
      'resolvedContentLanguage === "en"',
      'languageMode === "original"',
      '!isPro ||',
      'includeDraft: canUseDraftTranslation, language: articleRequestLanguage, prepare: true',
      'prepare: false,',
      'job.status === "ready"',
      'job.status === "queued" || job.status === "processing"',
    ],
  },
  {
    name: "Mobile bilingual passages switch their own cached language inline",
    file: "src/components/bilingual-reading.tsx",
    needles: [
      'useState<"translated" | "english">("translated")',
      "onPress={() => setMobileLanguage((current) =>",
      "minHeight: 44",
      "matchedBilingualOriginal(",
    ],
  },
  {
    name: "Compact bilingual summary heading and discoverable uninterrupted mobile body",
    file: "src/components/bilingual-reading.tsx",
    needles: [
      "styles.sectionHeadingRow",
      "heading={t[localizedLabel]}",
      "label.bodyHint",
      "label.bodyHintAdmin",
      "accessibilityLabel={showEnglish ? translatedHint : englishHint}",
      "onPress={!selectable && englishAvailable ? switchLanguage : undefined}",
      '{showEnglish ? translatedHint : "EN"} ↔',
      "selectable={selectable}",
    ],
  },
  {
    name: "Non-English shared stories open cached Bilingual mode without generating",
    file: "src/app/story/[slug].tsx",
    needles: [
      'isSharedStory && articleRequestLanguage !== "en" && bilingualReaderFeatureEnabled',
      'matchedBilingualOriginal(article, authoritativeArticle)',
      'matchedBilingualOriginal(article, historicalOriginal)',
      'languageMode === "bilingual" && !bilingualEnabled',
      'prepare: false,',
      'getCanonicalArticleByVersionId(oldEnglishSourceId, { includeDraft: canUseDraftTranslation })',
    ],
  },
  {
    name: "Pinned bilingual share URL carries immutable pair versions",
    file: "src/navigation/story-share.ts",
    needles: [
      'url.searchParams.set("mode", "bilingual")',
      'url.searchParams.set("translationVersion",',
      'url.searchParams.set("englishVersion",',
    ],
  },
  {
    name: "Pinned shares are preserved through /s redirect",
    file: "src/app/s/[eventId].tsx",
    needles: [
      'search.set("mode", "bilingual")',
      'search.set("translationVersion",',
      'search.set("englishVersion",',
    ],
  },
  {
    name: "Read-only translation status API and pinned version lookup are wired",
    file: "src/api/briefly.ts",
    needles: [
      "getExperimentalTranslationStatus(",
      'params.set("prepare", "false")',
      'params.set("translation_version_id",',
      'params.set("english_version_id",',
    ],
  },
  {
    name: "Bilingual generation is explicit, gated and read-only when polling",
    file: "src/app/story/[slug].tsx",
    needles: [
      'bilingualReaderFeatureEnabled',
      'prepare: false,',
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
      'translationEnabled && !!bilingualGenerationAction && (',
      'style={styles.generationAction}',
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
      "localized.event_id !== englishEventId",
      "latestEnglishVersionId",
      "paragraph.type === englishParagraphs[index].type",
      "styles.mobileSwitcher",
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
      "<BilingualBrief translated={article} english={bilingualOriginal}",
      "bilingualOriginal?<BilingualBody",
    ],
  },
  {
    name: "Error/retry state has a mobile-sized retry target",
    file: "src/components/screen-state.tsx",
    needles: ["minHeight: 44", 'justifyContent: "center"'],
  },
];

// A historical cached translation is a display fallback, not proof that
// translation of the latest authoritative English version is complete.
const storySource = read("src/app/story/[slug].tsx");
function storySection(start, end) {
  const first = storySource.indexOf(start);
  const last = first < 0 ? -1 : storySource.indexOf(end, first + start.length);
  if (first < 0 || last < 0) {
    throw new Error(`Story translation contract markers missing: ${start} → ${end}`);
  }
  return storySource.slice(first, last);
}
const historicalFallback = storySection(
  "// Keep an approved historical translation",
  '          } else {\n            result = canonical;',
);
const startupTranslation = storySection(
  "// Reconcile translation on story open from one read-only status lookup.",
  "// Polling only retrieves durable status",
);
const generationAction = storySection(
  "  const showBilingualGeneration =",
  "  const bilingualGenerationText =",
);
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
ensure(historicalFallback.includes('setLanguageMode("bilingual")') &&
       !historicalFallback.includes("result = canonical;"),
       "Historical translation must remain readable as a version-matched pair");
ensure(startupTranslation.includes('latestTranslationReady') &&
       startupTranslation.includes('matchedBilingualOriginal(article, authoritativeArticle)'),
       "Startup must check the latest English pair, not the displayed historical pair");
ensure(!startupTranslation.includes('}, [\n    preferencesReady, autoTranslateStories, user, isPro') &&
       !startupTranslation.includes('    article,\n'),
       "Startup effect must not be cancelled by unrelated displayed-article identity changes");
ensure(startupTranslation.includes('translationMatchesEnglishVersion(localized, latestEnglishEventId, latestEnglishVersionId)') &&
       !startupTranslation.includes('const english = authoritativeArticle!;'),
       "Startup version checks must not capture mutable authoritative article objects");
const pairHelper = read("src/components/bilingual-reading.tsx");
ensure(pairHelper.includes('export function translationMatchesEnglishVersion(') &&
       pairHelper.includes('return translationMatchesEnglishVersion('),
       "The bilingual view and startup reconciliation must share one immutable pair predicate");
ensure(startupTranslation.includes('job.status === "ready"') &&
       startupTranslation.includes('job.status === "queued"') &&
       startupTranslation.includes('job.status === "processing"') &&
       startupTranslation.includes('job.status === "failed"'),
       "Startup must reconcile existing job states without launching duplicates");
ensure(startupTranslation.includes('job.status !== "not_requested"') &&
       startupTranslation.includes('autoTranslationRequested.current.has(requestId)') &&
       startupTranslation.includes('prepare: true'),
       "Only a missing latest-version job may be auto-started once");
ensure(startupTranslation.includes('!preferencesReady || !autoTranslateStories') &&
       startupTranslation.includes('isSharedStory') &&
       startupTranslation.includes('pinnedTranslationVersion') &&
       startupTranslation.includes('resolvedContentLanguage === "en"'),
       "Automatic generation must respect explicit opt-out and share/English restrictions");
ensure(!startupTranslation.includes('(article.content_language ?? article.language) !== "en"') &&
       !generationAction.includes('(article.content_language ?? article.language) === "en"') &&
       generationAction.includes('matchedBilingualOriginal(article, authoritativeArticle) === null'),
       "A previous translation must not suppress current-version generation or progress");


const statusAction = storySection(
  "  const requestBilingualTranslation = async () => {",
  "  useEffect(() => {\n    if (!article || !article.event_id)",
);
const translationProgressUI = storySection(
  "bilingualGenerationAction={showBilingualGeneration ? (",
  "evidenceEnabled={evidenceEnabled}",
);
ensure(startupTranslation.includes('status: "checking"') &&
       startupTranslation.includes('status: "unavailable"') &&
       startupTranslation.includes('job.status !== "not_requested"'),
       "Story open must check source status before translation and report unavailable errors");
ensure(statusAction.includes('status: "checking"') &&
       statusAction.includes('status: "unavailable"'),
       "Manual status checks need distinct loading and unavailable states");
ensure(translationProgressUI.includes('<ActivityIndicator size="small"') &&
       translationProgressUI.includes('bilingualGenerationBusy &&') &&
       translationProgressUI.includes('bilingualGenerationText.unavailable'),
       "Translation progress must show a spinner only while checking or pending");
ensure(startupTranslation.includes('canUseDraftTranslation') &&
       startupTranslation.includes('includeDraft: canUseDraftTranslation') &&
       startupTranslation.includes('!isPro ||') &&
       !startupTranslation.includes('latestEnglishPublished') &&
       !startupTranslation.includes('latestEnglishDraft') &&
       !startupTranslation.includes('currentCanonicalStale') &&
       !generationAction.includes('!article.canonical_stale &&'),
       "Pro auto-translation must not be blocked by legacy publication status or newly arrived evidence");
ensure(storySource.includes('includeDraft: PREVIEW_DRAFTS || canUseDraftTranslation'),
       "Pro must read a draft canonical source to start translation");
ensure(!storySource.includes('value.status === "published"') &&
       !storySource.includes('article.status === "published" && matchedEnglishArticle.status === "published"') &&
       storySource.includes('(value.content_language ?? value.language) === "en"') &&
       storySource.includes('article.article_version_id != null && matchedEnglishArticle.article_version_id != null'),
       "Legacy draft/published flags must not hide version-matched English or approved bilingual shares");

// Translation notifications are part of the shared generation notification tray,
// not a screen-local spinner. They must survive leaving the Story screen.
const notificationsSource = read("src/context/analysis-readiness.tsx");
ensure(startupTranslation.includes('watchTranslation({') &&
       statusAction.includes('watchTranslation({') &&
       storySource.includes('const { watchAnalysis, watchTranslation, watchPodcast }') &&
       storySource.includes('params.set("content", articleRequestLanguage)') &&
       storySource.includes('params.set("read", articleRequestLanguage)'),
       "Auto/manual queued translation jobs register a persistent notification with a translated deep link");
ensure(notificationsSource.includes('if (item.kind === "translation") {') &&
       notificationsSource.includes('getExperimentalTranslationStatus(') &&
       notificationsSource.includes('job.translation_article_version_id != null') &&
       notificationsSource.includes('job.source_article_version_id === item.baseVersionId') &&
       notificationsSource.includes('job.language === item.targetLanguage'),
       "Translation notifications complete only on a source-version/language matched ready job");
ensure(notificationsSource.includes('kind === "refresh" || item.kind === "translation"') &&
       notificationsSource.includes('candidate.kind !== "translation"') &&
       notificationsSource.includes('withoutSuperseded'),
       "Translation readiness is uniquely tracked and replaces obsolete initial watchers");
ensure(notificationsSource.includes('prepare: false,') &&
       !notificationsSource.includes('prepare: true'),
       "Notification polling must never start paid canonical or translation generation");
ensure(notificationsSource.includes('if (item.kind === "translation") {') &&
       notificationsSource.includes('const canonicalReady =\n              item.baseVersionId != null') &&
       !notificationsSource.includes('const staleTranslation =') &&
       !notificationsSource.includes('if (item.kind !== "translation" &&'),
       "Translation notification checks return before initial/refresh article handling");


// A user-initiated Retry of empty English brief sections must also restore
// the corresponding pre-existing translated brief without starting generation.
const briefRepairScreen = read("src/app/story/[slug].tsx");
const briefRepairView = read("src/components/article-view.tsx");
ensure(briefRepairScreen.includes('repairedEnglishBriefVersion.current = briefRepairArticleVersionId') &&
       briefRepairScreen.includes('getExperimentalArticleByEventId(resolvedEventId, {') &&
       briefRepairScreen.includes('prepare: false,') &&
       briefRepairScreen.includes('matchedBilingualOriginal(localized, authoritativeArticle)') &&
       briefRepairScreen.includes('setReloadKey((value) => value + 1)'),
       "Retry of an English brief waits for its matching cached translated sections using read-only polling");
ensure(briefRepairView.includes('const sourceBrief=bilingualOriginal??article;') &&
       briefRepairView.includes('hasMissingSourceBrief&&bilingualOriginal.article_version_id===bilingualLatestEnglishVersionId&&briefRepair?.available') &&
       briefRepairView.includes('bilingualOriginal?<><BilingualBrief'),
       "Bilingual Story shows English brief Retry only for the current matching source version");
const bilingualSource = read("src/components/bilingual-reading.tsx");
ensure(bilingualSource.includes('onRetryMissingSection(field)') &&
       bilingualSource.includes('!String(translated[field] ?? "").trim()') &&
       bilingualSource.includes('englishRetryAvailable') &&
       bilingualSource.includes('retryingMissingSection'),
       "Missing translated brief sections have their own accessible Retry button");
ensure(briefRepairView.includes('onBriefTranslationRepair?:(field:') &&
       briefRepairView.includes('onBriefTranslationRepair(id==="whatHappened"') &&
       briefRepairView.includes('onRetryMissingSection={!immutable'),
       "Translated-only and bilingual Story layouts expose the repair control");
ensure(briefRepairScreen.includes('result.status === "translation_pending"') &&
       briefRepairScreen.includes('requestBriefRepair(briefRepairArticleVersionId, targetLanguage)') &&
       briefRepairScreen.includes('matchedBilingualOriginal(article, authoritativeArticle) !== null'),
       "Translation-only Retry targets the approved current English pair, without a new article version");
ensure(briefRepairScreen.includes("repairedEnglishBriefFields.current.some(") &&
       briefRepairScreen.includes("result.repaired_sections ?? []") &&
       briefRepairScreen.includes("setBriefTranslationRecoveryKey(\"\")"),
       "Translated recovery waits for repaired English to reload before concluding that the translated sections are complete");
ensure(briefRepairScreen.includes('useRef<("what_happened" | "why_it_matters" | "what_next")[]>([])') &&
       briefRepairScreen.includes('const finishedTimer = setTimeout(() => setBriefTranslationRecoveryKey(""), 0)') &&
       briefRepairScreen.includes('return () => clearTimeout(finishedTimer)'),
       "Completed translation repair clears busy state asynchronously and cleans up its timer");

const apiSource = read("src/api/briefly.ts");
ensure(apiSource.includes('status: "succeeded" | "not_needed" | "translation_pending"') &&
       apiSource.includes('target_language='),
       "Retry API supports version-checked existing translation repairs");

// On-device English speech must remain a free, version-scoped bilingual
// reading action with no backend inference or competing podcast playback.
const articleViewSource = read("src/components/article-view.tsx");
const speechButtonSource = read("src/components/english-speech-button.tsx");
const speechControllerSource = read("src/context/english-speech.tsx");
const podcastPlayerSource = read("src/context/podcast-player.tsx");
const rootLayoutSource = read("src/app/_layout.tsx");
const packageManifest = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));
ensure(packageManifest.dependencies["expo-speech"] === "~57.0.3" &&
       packageLock.packages[""].dependencies["expo-speech"] === "~57.0.3" &&
       packageLock.packages["node_modules/expo-speech"].version === "57.0.3",
       "Expo 57 on-device speech must be locked in the manifest and npm lockfile");
ensure(rootLayoutSource.includes("<PodcastPlayerProvider>") &&
       rootLayoutSource.includes("<EnglishSpeechProvider>") &&
       rootLayoutSource.indexOf("<PodcastPlayerProvider>") < rootLayoutSource.indexOf("<EnglishSpeechProvider>"),
       "Speech context must be shared across bilingual passages beneath podcast playback");
ensure(speechControllerSource.includes('import * as Speech from "expo-speech"') &&
       speechControllerSource.includes("Speech.speak(chunk, {") &&
       speechControllerSource.includes("void Speech.stop()") &&
       speechControllerSource.includes("pauseForSpeech()") &&
       speechControllerSource.includes('language: locale') &&
       speechControllerSource.includes("rate: 1.0") &&
       speechControllerSource.includes('AppState.addEventListener("change"'),
       "Speech must use device TTS, speak one passage at a time and stop on app background");
ensure(podcastPlayerSource.includes("pauseForSpeech: () => void") &&
       podcastPlayerSource.includes("const pauseForSpeech = useCallback(() => {") &&
       podcastPlayerSource.includes("player.pause();"),
       "English speech must pause a playing podcast without clearing its queue");
ensure(speechButtonSource.includes('toggle(passageId, text, "en-US")') &&
       speechButtonSource.includes("accessibilityRole=") &&
       speechButtonSource.includes("accessibilityLabel={playing ? labels.stop : labels.listen}") &&
       speechButtonSource.includes("minHeight: 44"),
       "Free English Listen/Stop actions use explicit English speech and touch-size accessibility");
ensure(bilingualSource.includes('passageId={`${english.article_version_id}:summary:${field}`}') &&
       bilingualSource.includes('passageId={`${english.article_version_id}:body:${index}`}') &&
       bilingualSource.includes('<EnglishSpeechButton passageId={passageId} english={english} compact />') &&
       bilingualSource.includes('english={englishParagraphs[index].text}') &&
       bilingualSource.includes('index === 1 && (') &&
       bilingualSource.includes('wholeBodyEnglish && ('),
       "English Listen appears for summary and body passages in aligned/unaligned web and mobile layouts");
ensure(storySource.includes('bilingualOriginal={effectiveLanguageMode === "bilingual" && bilingualEnabled ? matchedEnglishArticle : null}') &&
       !storySource.includes("englishSpeechSource=") &&
       !articleViewSource.includes("EnglishSpeechButton") &&
       !articleViewSource.includes("EnglishVoicePicker") &&
       !articleViewSource.includes("englishSpeechSource") &&
       articleViewSource.includes('bilingualOriginal?<><BilingualBrief') &&
       articleViewSource.includes('bilingualOriginal?<BilingualBody'),
       "Listen controls must only render with the version-matched English original in Bilingual mode");
ensure(bilingualSource.includes('const [mobileLanguage, setMobileLanguage] = useState<"translated" | "english">("translated")') &&
       bilingualSource.includes('<View style={styles.sectionActions}>') &&
       bilingualSource.includes('<EnglishSpeechButton passageId={passageId} english={english} compact />') &&
       bilingualSource.includes('style={[styles.mobileSwitcher, { borderColor: colors.border, backgroundColor: colors.surface }]}') &&
       bilingualSource.includes('<View style={styles.englishColumnHeading}>') &&
       bilingualSource.includes('justifyContent: "flex-start", flexWrap: "wrap"') &&
       bilingualSource.includes('<View style={styles.bodyParagraphControls}>') &&
       bilingualSource.includes('accessibilityLabel={showEnglish ? translatedHint : englishHint}') &&
       bilingualSource.includes('onPress={switchLanguage}') &&
       bilingualSource.includes('{showEnglish ? translatedHint : "EN"} ↔') &&
       bilingualSource.includes('english={englishParagraphs[index].text}') &&
       bilingualSource.includes('wholeBodyEnglish && (') &&
       !bilingualSource.includes('inlineEnglishMark') &&
       !bilingualSource.includes('EN ·'),
       "Mobile Listen shares the summary switch row; EN beside paragraph Listen is the language toggle without inline prefixes");
ensure(bilingualSource.includes('selectable={selectable}') &&
       bilingualSource.includes('onPress={!selectable && englishAvailable ? switchLanguage : undefined}') &&
       bilingualSource.includes('initiallyEnglish={selectable && wholeBodyEnglish}') &&
       bilingualSource.includes('key={`${translated.article_version_id}:${english.article_version_id}:${index}:${wholeBodyEnglish}`}') &&
       bilingualSource.includes('onPress={() => setWholeBodyEnglish(false)}') &&
       bilingualSource.includes('englishAvailable && (') &&
       bilingualSource.includes('{showEnglish ? translatedHint : "EN"} ↔') &&
       !bilingualSource.includes('inlineEnglishMark') &&
       !bilingualSource.includes('EN ·'),
       "Mobile bilingual English switch preserves paragraph taps and admin selection, avoids false alignment, and hides controls for empty English");
ensure(bilingualSource.includes("const { stop } = useEnglishSpeech();") &&
       bilingualSource.includes("useEffect(() => () => { stop(); }, [stop]);") &&
       bilingualSource.includes("<EnglishVoicePicker />") &&
       !articleViewSource.includes("<EnglishVoicePicker />"),
       "Leaving Bilingual mode stops speech, and voice selection exists only within Bilingual mode");
ensure(speechControllerSource.includes("  useContext,") &&
       speechControllerSource.includes("export function useEnglishSpeech(): SpeechController {") &&
       speechControllerSource.includes("const context = useContext(SpeechContext);") &&
       speechControllerSource.includes("voices: Speech.Voice[];"),
       "Shared speech hook must import useContext and retain typed voice arrays");

ensure(speechControllerSource.includes("Speech.getAvailableVoicesAsync()") &&
       speechControllerSource.includes("voiceRank(b) - voiceRank(a)") &&
       speechControllerSource.includes("VOICE_STORAGE_KEY") &&
       speechControllerSource.includes('voice: selectedVoice') &&
       speechControllerSource.includes('Platform.OS === "web" ? 220 : 950') &&
       speechButtonSource.includes("export function EnglishVoicePicker()") &&
       speechButtonSource.includes("voices.map((voice)") &&
       bilingualSource.includes("<EnglishVoicePicker />"),
       "Web bilingual reader must prefer natural-sounding installed voices and let the user override the choice without cloud inference");

let passed = 0;
for (const check of checks) {
  requireAll(check.file, check.needles);
  passed += 1;
  process.stdout.write(`✓ ${check.name}\n`);
}

process.stdout.write(
  `\nBriefly cross-platform UI contract: ${passed}/${checks.length} checks passed.\n`,
);

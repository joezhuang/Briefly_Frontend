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
      "autoStart={autoStartVideo}",
      'window.open(item.url,"_blank","noopener,noreferrer")',
      "shareBrieflyStory({headline:article.headline,url})",
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
      "styles.videoTopActions",
      "styles.videoStoryLink",
      "autoplayVideo=1",
      "setActiveHomepageVideo(null)",
      "router.push(playingStoryHref as never)",
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

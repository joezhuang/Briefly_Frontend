#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const target = path.join(
  process.cwd(),
  "node_modules",
  "expo-router",
  "build",
  "fork",
  "NavigationContainer.js",
);

const marker = "BRIEFLY_EXPO_ROUTER_INITIAL_LINK_MOUNT_GUARD";

if (!fs.existsSync(target)) {
  console.log("[Briefly] Expo Router patch skipped: NavigationContainer.js not found.");
  process.exit(0);
}

let source = fs.readFileSync(target, "utf8");

if (source.includes(marker)) {
  console.log("[Briefly] Expo Router initial-link guard already applied.");
  process.exit(0);
}

const stateMatch = source.match(
  /const \[lastUnhandledLink, setLastUnhandledLink\] = ([A-Za-z0-9_$.]+)\.useState\([^;]*\);/,
);

if (!stateMatch) {
  if (!source.includes("setLastUnhandledLink")) {
    console.log(
      "[Briefly] Expo Router initial-link patch not needed; upstream implementation no longer exposes the affected callback.",
    );
    process.exit(0);
  }

  console.warn(
    "[Briefly] Expo Router initial-link patch skipped: unsupported NavigationContainer.js structure.",
  );
  process.exit(0);
}

const reactRef = stateMatch[1];
const stateStatement = stateMatch[0];

const guard = `
    // ${marker}
    const brieflyLinkingMountedRef = ${reactRef}.useRef(false);
    const brieflyPendingUnhandledLinkRef = ${reactRef}.useRef(undefined);
    ${reactRef}.useEffect(() => {
        brieflyLinkingMountedRef.current = true;
        if (brieflyPendingUnhandledLinkRef.current !== undefined) {
            setLastUnhandledLink(brieflyPendingUnhandledLinkRef.current);
            brieflyPendingUnhandledLinkRef.current = undefined;
        }
        return () => {
            brieflyLinkingMountedRef.current = false;
        };
    }, []);
    const brieflySetLastUnhandledLinkAfterMount = (value) => {
        if (brieflyLinkingMountedRef.current) {
            setLastUnhandledLink(value);
            return;
        }
        brieflyPendingUnhandledLinkRef.current = value;
    };`;

source = source.replace(stateStatement, stateStatement + guard);

const useLinkingIndex = source.indexOf("useLinking");
if (useLinkingIndex === -1) {
  console.warn(
    "[Briefly] Expo Router initial-link patch skipped: useLinking call not found.",
  );
  process.exit(0);
}

const callbackIndex = source.indexOf("setLastUnhandledLink", useLinkingIndex);
if (callbackIndex === -1) {
  console.log(
    "[Briefly] Expo Router initial-link patch not needed; affected callback is no longer passed to useLinking.",
  );
  process.exit(0);
}

source =
  source.slice(0, callbackIndex) +
  "brieflySetLastUnhandledLinkAfterMount" +
  source.slice(callbackIndex + "setLastUnhandledLink".length);

fs.writeFileSync(target, source);
console.log("[Briefly] Applied Expo Router Android initial-link mount guard.");

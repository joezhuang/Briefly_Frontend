import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ios = require(path.join(root, "api/apple-app-site-association.js"));
const android = require(path.join(root, "api/android-assetlinks.js"));

const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = JSON.parse(read("app.json")).expo;
const vercel = JSON.parse(read("vercel.json"));

function run(handler) {
  const headers = new Map();
  let responseText = "";
  const response = {
    statusCode: 200,
    setHeader(key, value) {
      headers.set(String(key).toLowerCase(), value);
    },
    end(value) {
      responseText = String(value);
    },
  };
  handler({}, response);
  return {
    status: response.statusCode,
    headers,
    body: JSON.parse(responseText),
  };
}

function withEnv(key, value, fn) {
  const before = process.env[key];
  try {
    if (value === null) delete process.env[key];
    else process.env[key] = value;
    return fn();
  } finally {
    if (before === undefined) delete process.env[key];
    else process.env[key] = before;
  }
}

let passed = 0;
function check(label, fn) {
  fn();
  passed += 1;
  process.stdout.write(`✓ ${label}\n`);
}

const host = "briefly-news-analysis.vercel.app";
const packageName = "com.hybridgalaxy.briefly";
const sharedPaths = ["/s/", "/story/", "/share/"];

check("iOS entitlement names the canonical Briefly link host", () => {
  assert.equal(app.ios.bundleIdentifier, packageName);
  assert.deepEqual(app.ios.associatedDomains, [`applinks:${host}`]);
});

check("Android auto-verifies all three shared-story routes", () => {
  assert.equal(app.android.package, packageName);
  const filters = app.android.intentFilters.filter((item) => item.autoVerify);
  assert.equal(filters.length, 1);
  for (const prefix of sharedPaths) {
    assert.ok(filters[0].data.some(
      (item) => item.scheme === "https" && item.host === host && item.pathPrefix === prefix,
    ));
  }
  assert.ok(filters[0].category.includes("BROWSABLE"));
  assert.ok(filters[0].category.includes("DEFAULT"));
});

check("Vercel serves both .well-known documents directly", () => {
  assert.ok(vercel.rewrites.some(
    (item) => item.source === "/.well-known/apple-app-site-association" &&
      item.destination === "/api/apple-app-site-association",
  ));
  assert.ok(vercel.rewrites.some(
    (item) => item.source === "/.well-known/assetlinks.json" &&
      item.destination === "/api/android-assetlinks",
  ));
  assert.ok(vercel.rewrites.some((item) => item.source === "/s/:eventId"));
});

check("Apple document refuses to claim unverifiable identities", () => {
  withEnv("BRIEFLY_APPLE_APP_ID_PREFIX", null, () => {
    assert.equal(run(ios).status, 503);
  });
  withEnv("BRIEFLY_APPLE_APP_ID_PREFIX", "invalid prefix", () => {
    assert.equal(run(ios).status, 503);
  });
});

check("Apple association lists only the Briefly story paths", () => {
  withEnv("BRIEFLY_APPLE_APP_ID_PREFIX", "ABCDE12345", () => {
    const result = run(ios);
    assert.equal(result.status, 200);
    assert.match(result.headers.get("content-type"), /^application\/json/);
    const details = result.body.applinks.details;
    assert.deepEqual(details[0].appIDs, [`ABCDE12345.${packageName}`]);
    assert.deepEqual(details[0].components.map((x) => x["/"]), sharedPaths.map(x => x + "*"));
  });
});

check("Android document rejects empty or incorrectly formatted fingerprints", () => {
  withEnv("BRIEFLY_ANDROID_SHA256_CERT_FINGERPRINTS", null, () => {
    assert.equal(run(android).status, 503);
  });
  withEnv("BRIEFLY_ANDROID_SHA256_CERT_FINGERPRINTS", "AB:CD", () => {
    assert.equal(run(android).status, 503);
  });
});

check("Android association uses Play app-signing fingerprints", () => {
  const fingerprint = Array.from({ length: 32 }, () => "AB").join(":");
  withEnv("BRIEFLY_ANDROID_SHA256_CERT_FINGERPRINTS", fingerprint, () => {
    const result = run(android);
    assert.equal(result.status, 200);
    assert.equal(result.body[0].target.package_name, packageName);
    assert.deepEqual(result.body[0].target.sha256_cert_fingerprints, [fingerprint]);
    assert.deepEqual(result.body[0].relation, ["delegate_permission/common.handle_all_urls"]);
  });
});

check("Share link routing is read-only and preserves user languages", () => {
  const source = read("src/app/s/[eventId].tsx");
  assert.match(source, /source: "share"/);
  assert.match(source, /router\.replace\(destination/);
  for (const param of ['params.ui', 'params.content', 'params.read']) {
    assert.ok(source.includes(param), `missing language ${param}`);
  }
  assert.ok(read("src/app/story/[slug].tsx").includes("prepare: !isSharedStory"));
  assert.ok(read("api/share/[eventId].js").includes("prepare=false"));
});

check("Web readers choose app, store if configured, or continue reading", () => {
  const source = read("src/components/shared-app-choice.web.tsx");
  for (const marker of [
    "briefly:///",
    "EXPO_PUBLIC_BRIEFLY_IOS_APP_URL",
    "EXPO_PUBLIC_BRIEFLY_ANDROID_APP_URL",
    "setDismissed(true)",
    "window.location.assign(appUrl)",
    "Linking.openURL(storeUrl)",
    "onPress={openInAppOrStore}",
    "S.browser_fallback_url=",
    "androidAppIntent(appUrl, storeUrl)",
    "document.visibilityState",
    "window.location.assign(storeUrl)",
    "setStoreUnavailable(true)",
    "ANDROID_DEFAULT_STORE_URL",
  ]) {
    assert.ok(source.includes(marker), `missing chooser action ${marker}`);
  }
  assert.ok(read("src/app/story/[slug].tsx").includes("SharedAppChoice"));
  assert.ok(read("src/app/share/[versionId].tsx").includes("SharedAppChoice"));
  assert.ok(read("src/app/index.tsx").includes("HomeInstallBanners"));
});

process.stdout.write(`\nBriefly mobile app-link contract: ${passed}/${passed} checks passed.\n`);

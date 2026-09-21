import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(label, args) {
  process.stdout.write(`\n== ${label} ==\n`);
  const result = spawnSync(npm, args, {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.stderr.write(`✗ ${label} failed\n`);
    process.exit(result.status ?? 1);
  }
  process.stdout.write(`✓ ${label}\n`);
}

function requireFile(relativePath) {
  const target = path.join(root, relativePath);
  if (!fs.existsSync(target)) {
    throw new Error(`Missing release asset: ${relativePath}`);
  }
}

function verifyNativeBrandConfig() {
  const app = JSON.parse(
    fs.readFileSync(path.join(root, "app.json"), "utf8"),
  ).expo;

  const expected = {
    icon: "./assets/images/icon.png",
    iosIcon: "./assets/images/icon.png",
    androidForeground: "./assets/images/android-icon-foreground.png",
    androidBackground: "./assets/images/android-icon-background.png",
    androidMonochrome: "./assets/images/android-icon-monochrome.png",
    favicon: "./assets/images/favicon.png",
  };

  const actual = {
    icon: app.icon,
    iosIcon: app.ios?.icon,
    androidForeground: app.android?.adaptiveIcon?.foregroundImage,
    androidBackground: app.android?.adaptiveIcon?.backgroundImage,
    androidMonochrome: app.android?.adaptiveIcon?.monochromeImage,
    favicon: app.web?.favicon,
  };

  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      throw new Error(
        `Release brand config mismatch for ${key}: expected ${value}, got ${actual[key]}`,
      );
    }
    requireFile(value.replace(/^\.\//, ""));
  }

  requireFile("assets/images/splash-icon.png");
  requireFile("public/briefly-share-default.png");
  process.stdout.write("✓ Native/web brand asset configuration is wired\n");
}

run("Frontend lint", ["run", "lint"]);
run("Beta user-journey source gate", ["run", "smoke:journey"]);
run("Cross-platform UI source gate", ["run", "smoke:ui"]);
run("Analytics and monitoring source gate", ["run", "smoke:telemetry"]);

try {
  verifyNativeBrandConfig();
} catch (error) {
  process.stderr.write(
    `✗ ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  "\nBRIEFLY FRONTEND AUTOMATED RELEASE GATE: PASS\n" +
    "Manual Web/iOS/Android and moderation evidence is still required by the backend Step 8 gate.\n",
);

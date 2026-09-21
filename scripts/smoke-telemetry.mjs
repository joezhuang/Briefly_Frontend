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
      `${relativePath} is missing telemetry contract(s): ${missing.join(", ")}`,
    );
  }
}

const checks = [
  {
    name: "Product analytics is first-party, authenticated when possible, and fail-open",
    file: "src/analytics/product-analytics.ts",
    needles: [
      "/api/analytics/events",
      "getBrieflyAccessToken()",
      "Authorization: `Bearer ${token}`",
      "consecutiveFailures",
      "queue = [...batch, ...queue]",
      "telemetry is never allowed to",
    ],
  },
  {
    name: "Client monitoring redacts sensitive text and only records API failures at 5xx/network severity",
    file: "src/monitoring/error-monitoring.ts",
    needles: [
      "/api/errors/client",
      "EMAIL_PATTERN",
      "BEARER_PATTERN",
      "JWT_PATTERN",
      "URL_QUERY_PATTERN",
      "if (statusCode !== null && statusCode < 500) return",
      "normalizeErrorRoute",
    ],
  },
  {
    name: "Admin API exposes private telemetry controls and read-only health",
    file: "src/api/briefly.ts",
    needles: [
      "BetaDashboardTelemetryConfig",
      "test_account_emails",
      "include_test_accounts_in_analytics",
      "include_test_accounts_in_error_monitoring",
      "/api/beta-dashboard/telemetry-config",
      "/api/beta-dashboard/telemetry-health",
    ],
  },
  {
    name: "Beta Dashboard exposes independent test-account switches",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      'title="Test-account telemetry"',
      'label="Include test accounts in product analytics"',
      'label="Include test accounts in error monitoring"',
      "Save telemetry controls",
      "Applies to new telemetry only",
      "const stackEmailEditor = width < 640",
      "styles.telemetryEmailRowStacked",
      "styles.telemetryEmailInputStacked",
    ],
  },
  {
    name: "Beta Dashboard shows live analytics and monitoring health",
    file: "src/app/beta-dashboard.tsx",
    needles: [
      'title="Telemetry health"',
      "telemetryHealth.analytics.events_24h",
      "telemetryHealth.errors.errors_24h",
      "telemetryHealth.errors.unresolved_errors",
      "Refresh telemetry",
    ],
  },
  {
    name: "Public app configuration does not expose test account emails",
    file: "src/api/briefly.ts",
    needles: [
      'export function getBrieflyAppConfig()',
      'export type BrieflyAppConfig = {',
    ],
    forbidden: ["test_account_emails: string[];\n  email_password_login_enabled"],
  },
];

let passed = 0;
for (const check of checks) {
  requireAll(check.file, check.needles);
  const source = read(check.file);
  for (const forbidden of check.forbidden ?? []) {
    if (source.includes(forbidden)) {
      throw new Error(`${check.file} exposes forbidden telemetry configuration`);
    }
  }
  passed += 1;
  process.stdout.write(`✓ ${check.name}\n`);
}

process.stdout.write(
  `\nBriefly telemetry contract: ${passed}/${checks.length} checks passed.\n`,
);

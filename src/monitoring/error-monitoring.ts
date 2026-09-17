import Constants from "expo-constants";
import { Platform } from "react-native";

import { getBrieflyAccessToken } from "@/auth/session";
import { telemetrySessionId } from "@/telemetry/session";

const API_BASE_URL = process.env.EXPO_PUBLIC_BRIEFLY_API_URL?.replace(/\/$/, "");
const FLUSH_DELAY_MS = 2000;
const FLUSH_BATCH_SIZE = 5;
const MAX_QUEUE_SIZE = 50;
const MAX_RETRY_DELAY_MS = 60_000;

type ErrorSeverity = "warning" | "error" | "fatal";
type ClientErrorType = "render" | "unhandled" | "api";

type ErrorContext = Record<
  string,
  string | number | boolean | null | undefined
>;

type QueuedClientError = {
  error_type: ClientErrorType;
  severity: ErrorSeverity;
  session_id: string;
  platform: "web" | "ios" | "android" | "unknown";
  app_version?: string | null;
  route?: string | null;
  status_code?: number | null;
  exception_type?: string | null;
  message: string;
  stack?: string | null;
  context: ErrorContext;
  occurred_at: string;
};

const appVersion = Constants.expoConfig?.version ?? null;
const platform: QueuedClientError["platform"] =
  Platform.OS === "web" || Platform.OS === "ios" || Platform.OS === "android"
    ? Platform.OS
    : "unknown";

let queue: QueuedClientError[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushPromise: Promise<void> | null = null;
let consecutiveFailures = 0;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+\-/]+=*/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const LONG_TOKEN_PATTERN = /\b[A-Za-z0-9_-]{40,}\b/g;
const URL_QUERY_PATTERN = /(https?:\/\/[^\s?#]+)(?:\?[^\s#]*)?(?:#[^\s]*)?/gi;
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

function redactText(value: unknown, limit: number) {
  let text =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : String(value ?? "Unknown error");

  text = text
    .replace(BEARER_PATTERN, "Bearer [redacted]")
    .replace(JWT_PATTERN, "[redacted-token]")
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(LONG_TOKEN_PATTERN, "[redacted-token]")
    .replace(URL_QUERY_PATTERN, "$1");

  return text.slice(0, limit);
}

export function normalizeErrorRoute(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  return raw
    .split("?", 1)[0]
    .split("#", 1)[0]
    .replace(UUID_PATTERN, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    .replace(/\/slug\/[^/]+/g, "/slug/:slug")
    .replace(/\/event\/[^/]+/g, "/event/:event_id")
    .replace(/\/version\/[^/]+/g, "/version/:version_id")
    .slice(0, 300);
}

function nextFlushDelay() {
  if (consecutiveFailures === 0) return FLUSH_DELAY_MS;
  return Math.min(
    MAX_RETRY_DELAY_MS,
    FLUSH_DELAY_MS * 2 ** Math.min(consecutiveFailures, 5),
  );
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushClientErrors();
  }, nextFlushDelay());
}

export function captureClientError(options: {
  errorType: ClientErrorType;
  severity?: ErrorSeverity;
  message: unknown;
  stack?: unknown;
  route?: string | null;
  statusCode?: number | null;
  exceptionType?: string | null;
  context?: ErrorContext;
}) {
  if (!API_BASE_URL) return;

  queue.push({
    error_type: options.errorType,
    severity: options.severity ?? "error",
    session_id: telemetrySessionId,
    platform,
    app_version: appVersion,
    route: normalizeErrorRoute(options.route),
    status_code: options.statusCode ?? null,
    exception_type: options.exceptionType
      ? redactText(options.exceptionType, 160)
      : null,
    message: redactText(options.message, 1200),
    stack: options.stack ? redactText(options.stack, 8000) : null,
    context: options.context ?? {},
    occurred_at: new Date().toISOString(),
  });

  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
  }

  if (queue.length >= FLUSH_BATCH_SIZE && consecutiveFailures === 0) {
    void flushClientErrors();
    return;
  }

  scheduleFlush();
}

export function captureApiError(options: {
  route: string;
  method?: string;
  statusCode?: number | null;
  error?: unknown;
}) {
  const statusCode = options.statusCode ?? null;
  if (statusCode !== null && statusCode < 500) return;

  const method = String(options.method ?? "GET").toUpperCase();
  const error =
    options.error instanceof Error
      ? options.error
      : statusCode !== null
        ? new Error(`API ${method} request failed with ${statusCode}`)
        : new Error("Network request failed");

  captureClientError({
    errorType: "api",
    message:
      statusCode !== null
        ? `API ${method} request failed with ${statusCode}`
        : error,
    stack: error.stack,
    route: options.route,
    statusCode,
    exceptionType:
      statusCode !== null ? "HttpError" : error.name || "NetworkError",
    context: {
      operation: "api_request",
      method,
      status_code: statusCode,
    },
  });
}

export function captureRenderError(
  error: Error,
  componentStack?: string | null,
) {
  captureClientError({
    errorType: "render",
    severity: "fatal",
    message: error,
    stack: [error.stack, componentStack].filter(Boolean).join("\n"),
    exceptionType: error.name || "RenderError",
    context: { component: "react_tree", phase: "render" },
  });
}

export function captureUnhandledError(error: unknown, isFatal = false) {
  const normalized =
    error instanceof Error ? error : new Error(redactText(error, 1200));

  captureClientError({
    errorType: "unhandled",
    severity: isFatal ? "fatal" : "error",
    message: normalized,
    stack: normalized.stack,
    exceptionType: normalized.name || "UnhandledError",
    context: { phase: "global" },
  });
}

export function installGlobalErrorMonitoring() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const onError = (event: ErrorEvent) => {
      captureUnhandledError(event.error ?? event.message, false);
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      captureUnhandledError(event.reason, false);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }

  type GlobalHandler = (error: Error, isFatal?: boolean) => void;
  type ErrorUtilsLike = {
    getGlobalHandler?: () => GlobalHandler;
    setGlobalHandler?: (handler: GlobalHandler) => void;
  };

  const errorUtils = (
    globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsLike }
  ).ErrorUtils;

  if (!errorUtils?.setGlobalHandler) return undefined;

  const previous = errorUtils.getGlobalHandler?.();
  const handler: GlobalHandler = (error, isFatal) => {
    captureUnhandledError(error, isFatal === true);
    previous?.(error, isFatal);
  };

  errorUtils.setGlobalHandler(handler);

  return () => {
    if (previous && errorUtils.getGlobalHandler?.() === handler) {
      errorUtils.setGlobalHandler?.(previous);
    }
  };
}

export async function flushClientErrors() {
  if (!API_BASE_URL || queue.length === 0) return;
  if (flushPromise) return flushPromise;

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const batch = queue.splice(0, FLUSH_BATCH_SIZE);
  flushPromise = (async () => {
    try {
      const token = getBrieflyAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/errors/client`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ errors: batch }),
      });

      if (!response.ok) {
        throw new Error(`Error monitoring request failed (${response.status})`);
      }

      consecutiveFailures = 0;
    } catch {
      consecutiveFailures += 1;
      queue = [...batch, ...queue].slice(0, MAX_QUEUE_SIZE);
    } finally {
      flushPromise = null;
      if (queue.length > 0) scheduleFlush();
    }
  })();

  return flushPromise;
}

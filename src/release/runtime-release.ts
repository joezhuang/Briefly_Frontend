import Constants from "expo-constants";
import { Platform } from "react-native";

export type BrieflyRuntimePlatform =
  | "web"
  | "ios"
  | "android"
  | "unknown";

type NativePlatformManifest = {
  ios?: {
    buildNumber?: string | null;
  };
  android?: {
    versionCode?: number | null;
  };
};

const manifest = Constants.platform as NativePlatformManifest | null | undefined;
const appVersion = Constants.expoConfig?.version ?? null;
const platform: BrieflyRuntimePlatform =
  Platform.OS === "web" || Platform.OS === "ios" || Platform.OS === "android"
    ? Platform.OS
    : "unknown";

const nativeBuildVersion =
  platform === "ios"
    ? manifest?.ios?.buildNumber ?? null
    : platform === "android"
      ? manifest?.android?.versionCode != null
        ? String(manifest.android.versionCode)
        : null
      : null;

const rawRuntimeVersion = Constants.expoConfig?.runtimeVersion as unknown;
const runtimeVersion =
  typeof rawRuntimeVersion === "string"
    ? rawRuntimeVersion
    : rawRuntimeVersion &&
        typeof rawRuntimeVersion === "object" &&
        "policy" in rawRuntimeVersion
      ? "policy:" +
        String((rawRuntimeVersion as { policy?: string }).policy ?? "unknown")
      : null;

const sourceRevision =
  process.env.EXPO_PUBLIC_BRIEFLY_GIT_SHA?.trim() ||
  process.env.EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
  null;
const releaseId =
  process.env.EXPO_PUBLIC_BRIEFLY_RELEASE_ID?.trim() ||
  (sourceRevision ? sourceRevision.slice(0, 12) : null);
const releaseChannel =
  process.env.EXPO_PUBLIC_BRIEFLY_RELEASE_CHANNEL?.trim() || null;

const telemetryVersion = (() => {
  if (!appVersion) return releaseId ? releaseId.slice(0, 64) : null;
  if (nativeBuildVersion) {
    return `${appVersion}+build.${nativeBuildVersion}`.slice(0, 64);
  }
  if (platform === "web" && sourceRevision) {
    return `${appVersion}+web.${sourceRevision.slice(0, 12)}`.slice(0, 64);
  }
  return appVersion.slice(0, 64);
})();

export const brieflyRuntimeRelease = {
  platform,
  appVersion,
  nativeBuildVersion,
  runtimeVersion,
  sourceRevision,
  releaseId,
  releaseChannel,
  telemetryVersion,
} as const;

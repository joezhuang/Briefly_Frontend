import type {
  BrieflyAppConfig,
  FeatureAccessMode,
} from "@/api/briefly";

export type RuntimePaidFeature = "video" | "podcast" | "story_refresh";
export type FeatureGate = "allowed" | "sign_in" | "pro" | "disabled";

export type FeatureAccessState = {
  mode: FeatureAccessMode;
  gate: FeatureGate;
  allowed: boolean;
  badge: "PRO" | "FREE" | "FREE · SIGN IN" | null;
};

export function featureAccessMode(
  config: BrieflyAppConfig | null | undefined,
  feature: RuntimePaidFeature,
): FeatureAccessMode {
  if (feature === "video") {
    return config?.source_video_access_mode ?? "pro_only";
  }
  if (feature === "podcast") {
    return config?.podcast_access_mode ?? "pro_only";
  }
  return config?.story_refresh_access_mode ?? "pro_only";
}

export function resolveFeatureAccess(
  config: BrieflyAppConfig | null | undefined,
  feature: RuntimePaidFeature,
  {
    signedIn,
    isPro,
  }: {
    signedIn: boolean;
    isPro: boolean;
  },
): FeatureAccessState {
  const mode = featureAccessMode(config, feature);

  if (mode === "disabled") {
    return { mode, gate: "disabled", allowed: false, badge: null };
  }

  if (mode === "pro_only") {
    if (isPro) {
      return { mode, gate: "allowed", allowed: true, badge: null };
    }
    return { mode, gate: "pro", allowed: false, badge: "PRO" };
  }

  if (!signedIn) {
    return {
      mode,
      gate: "sign_in",
      allowed: false,
      badge: "FREE · SIGN IN",
    };
  }

  return {
    mode,
    gate: "allowed",
    allowed: true,
    badge: isPro ? null : "FREE",
  };
}

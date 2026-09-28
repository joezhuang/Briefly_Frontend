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

const featureBadgeCopy = {
  en: { free: "FREE", signIn: "SIGN IN" },
  es: { free: "GRATIS", signIn: "INICIAR SESIÓN" },
  ja: { free: "無料", signIn: "ログイン" },
  "zh-CN": { free: "免费", signIn: "登录" },
  "zh-TW": { free: "免費", signIn: "登入" },
} as const;

export function featureAccessBadgeLabel(
  badge: FeatureAccessState["badge"],
  language: string,
  { compact = false }: { compact?: boolean } = {},
) {
  if (!badge) return null;
  if (badge === "PRO") return "PRO";

  const labels =
    featureBadgeCopy[language as keyof typeof featureBadgeCopy] ??
    featureBadgeCopy.en;
  if (badge === "FREE" || compact) return labels.free;
  return `${labels.free} · ${labels.signIn}`;
}

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

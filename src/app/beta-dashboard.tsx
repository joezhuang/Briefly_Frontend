import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getBetaDashboard,
  getBetaDashboardAppConfig,
  getBetaDashboardTelemetryConfig,
  getBetaDashboardTelemetryHealth,
  getCommunityModerationQueue,
  setBetaDashboardErrorResolution,
  setCommunityContributionVisibility,
  updateBetaDashboardAppConfig,
  updateBetaDashboardTelemetryConfig,
  type BetaDashboardErrorGroup,
  type BetaDashboardSnapshot,
  type BetaDashboardTelemetryConfig,
  type BetaDashboardTelemetryHealth,
  type BrieflyAppConfig,
  type CommunityModerationItem,
  type CommunityModerationQueue,
} from "@/api/briefly";
import { AppHeader } from "@/components/app-header";
import { ScreenState } from "@/components/screen-state";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyTheme } from "@/context/theme";
import { layout } from "@/theme/tokens";

const WINDOWS = [7, 30, 90] as const;
const DASHBOARD_TABS = [
  { id: "overview", label: "Overview" },
  { id: "social", label: "Social Beta" },
  { id: "operations", label: "Operations" },
  { id: "settings", label: "Settings" },
] as const;
const SOCIAL_BETA_TABS = [
  { id: "overview", label: "Overview" },
  { id: "acquisition", label: "Acquisition" },
  { id: "lenses", label: "Lenses" },
  { id: "deeply", label: "Podcast" },
] as const;

type DashboardTab = (typeof DASHBOARD_TABS)[number]["id"];
type SocialBetaTab = (typeof SOCIAL_BETA_TABS)[number]["id"];

const EMPTY_SOCIAL_BETA: BetaDashboardSnapshot["product"]["social_beta"] = {
  feed_view_sessions: 0,
  feed_story_open_sessions: 0,
  feed_to_story_rate: 0,
  lens_sessions: 0,
  lens_rate: 0,
  source_open_sessions: 0,
  source_open_rate: 0,
  share_sessions: 0,
  share_rate: 0,
  podcast_action_sessions: 0,
  podcast_action_rate: 0,
  authenticated_active_users: 0,
  multi_session_users: 0,
  returning_users: 0,
  returning_user_rate: 0,
  lens_breakdown: [],
  podcast_breakdown: [],
  story_source_breakdown: [],
};

function number(value: number | null | undefined) {
  return new Intl.NumberFormat("en-AU").format(value ?? 0);
}

function percentage(value: number | null | undefined) {
  return Number(value ?? 0).toFixed(1) + "%";
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  const { colors } = useBrieflyTheme();
  return (
    <View
      style={[
        styles.metricCard,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      {!!detail && (
        <Text style={[styles.metricDetail, { color: colors.textMuted }]}>
          {detail}
        </Text>
      )}
    </View>
  );
}

function SectionTitle({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  const { colors } = useBrieflyTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {!!detail && (
        <Text style={[styles.sectionDetail, { color: colors.textMuted }]}>
          {detail}
        </Text>
      )}
    </View>
  );
}

function ActivityBar({
  label,
  value,
  max,
  detail,
}: {
  label: string;
  value: number;
  max: number;
  detail?: string;
}) {
  const { colors } = useBrieflyTheme();
  const width = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  const barWidth = (String(width) + "%") as `${number}%`;
  return (
    <View style={styles.activityRow}>
      <View style={styles.activityTop}>
        <Text style={[styles.activityLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.activityValue, { color: colors.textMuted }]}>
          {number(value)}
          {detail ? " · " + detail : ""}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <View
          style={[
            styles.fill,
            { width: barWidth, backgroundColor: colors.accent },
          ]}
        />
      </View>
    </View>
  );
}

function DailySessionsTrend({
  items,
}: {
  items: BetaDashboardSnapshot["product"]["daily_usage"];
}) {
  const { colors } = useBrieflyTheme();
  const [chartWidth, setChartWidth] = useState(0);
  const chartHeight = 190;
  const insetX = 18;
  const insetY = 18;
  const usableWidth = Math.max(0, chartWidth - insetX * 2);
  const usableHeight = chartHeight - insetY * 2;
  const maxSessions = Math.max(1, ...items.map((item) => item.sessions));

  const points = useMemo(
    () =>
      items.map((item, index) => {
        const denominator = Math.max(1, items.length - 1);
        const x =
          items.length === 1
            ? chartWidth / 2
            : insetX + (index / denominator) * usableWidth;
        const y =
          insetY +
          (1 - Math.min(1, item.sessions / maxSessions)) * usableHeight;
        return { ...item, x, y };
      }),
    [chartWidth, items, maxSessions, usableHeight, usableWidth],
  );

  const segments = useMemo(
    () =>
      points.slice(1).map((point, index) => {
        const previous = points[index];
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        return {
          key: `${previous.day}-${point.day}`,
          left: (previous.x + point.x) / 2 - length / 2,
          top: (previous.y + point.y) / 2 - 1,
          length,
          angle,
        };
      }),
    [points],
  );

  if (items.length === 0) {
    return (
      <Text style={[styles.empty, { color: colors.textMuted }]}>
        No daily session data yet.
      </Text>
    );
  }

  const first = items[0];
  const last = items[items.length - 1];
  const totalSessions = items.reduce((sum, item) => sum + item.sessions, 0);
  const formatDay = (value: string) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("en-AU", {
          day: "numeric",
          month: "short",
        }).format(date);
  };

  return (
    <View
      style={[
        styles.trendPanel,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.trendSummary}>
        <View>
          <Text style={[styles.trendValue, { color: colors.text }]}>
            {number(totalSessions)}
          </Text>
          <Text style={[styles.trendCaption, { color: colors.textMuted }]}>
            daily-session total across visible buckets
          </Text>
        </View>
        <Text style={[styles.trendCaption, { color: colors.textMuted }]}>
          Peak {number(maxSessions)}
        </Text>
      </View>

      <View
        onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
        style={[
          styles.trendChart,
          { height: chartHeight, backgroundColor: colors.surfaceMuted },
        ]}
      >
        {chartWidth > 0 &&
          segments.map((segment) => (
            <View
              key={segment.key}
              style={[
                styles.trendLine,
                {
                  backgroundColor: colors.accent,
                  width: segment.length,
                  left: segment.left,
                  top: segment.top,
                  transform: [{ rotate: `${segment.angle}rad` }],
                },
              ]}
            />
          ))}

        {chartWidth > 0 &&
          points.map((point) => (
            <View
              key={point.day}
              style={[
                styles.trendPoint,
                {
                  borderColor: colors.background,
                  backgroundColor: colors.accent,
                  left: point.x - 5,
                  top: point.y - 5,
                },
              ]}
            />
          ))}
      </View>

      <View style={styles.trendAxis}>
        <Text style={[styles.trendAxisText, { color: colors.textMuted }]}>
          {formatDay(first.day)}
        </Text>
        {items.length > 1 && (
          <Text style={[styles.trendAxisText, { color: colors.textMuted }]}>
            {formatDay(last.day)}
          </Text>
        )}
      </View>
    </View>
  );
}

function ErrorGroupCard({
  item,
  busy,
  onToggle,
}: {
  item: BetaDashboardErrorGroup;
  busy: boolean;
  onToggle: (item: BetaDashboardErrorGroup) => void;
}) {
  const { colors } = useBrieflyTheme();
  const unresolved = item.unresolved_occurrences > 0;
  return (
    <View
      style={[
        styles.errorCard,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.errorTop}>
        <View style={styles.errorTitleWrap}>
          <Text style={[styles.errorType, { color: colors.accent }]}>
            {item.source.toUpperCase()} · {item.error_type}
          </Text>
          <Text style={[styles.errorMessage, { color: colors.text }]}>
            {item.exception_type || item.message}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { borderColor: unresolved ? colors.accent : colors.border },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: unresolved ? colors.accent : colors.textMuted },
            ]}
          >
            {unresolved ? "UNRESOLVED" : "RESOLVED"}
          </Text>
        </View>
      </View>

      <Text style={[styles.errorMessageBody, { color: colors.textMuted }]}>
        {item.message}
      </Text>

      <View style={styles.errorMeta}>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          {item.route || "No route"}
        </Text>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          {item.status_code ? "HTTP " + item.status_code : "No HTTP status"}
        </Text>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          {number(item.occurrences)} occurrences
        </Text>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          Last {formatTimestamp(item.last_seen)}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => onToggle(item)}
        style={({ pressed }) => [
          styles.resolveButton,
          {
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
            opacity: busy ? 0.5 : pressed ? 0.68 : 1,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.text} />
        ) : (
          <Text style={[styles.resolveText, { color: colors.text }]}>
            {unresolved ? "Mark resolved" : "Reopen"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function CommunityModerationCard({
  item,
  busy,
  onToggle,
}: {
  item: CommunityModerationItem;
  busy: boolean;
  onToggle: (item: CommunityModerationItem) => void;
}) {
  const { colors } = useBrieflyTheme();
  const hidden = item.status === "hidden";
  const reason = item.latest_report_reason.replaceAll("_", " ");

  return (
    <View
      style={[
        styles.errorCard,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.errorTop}>
        <View style={styles.errorTitleWrap}>
          <Text style={[styles.errorType, { color: colors.accent }]}>
            {item.contribution_type.toUpperCase()} · {number(item.report_count)}{" "}
            {item.report_count === 1 ? "REPORT" : "REPORTS"}
          </Text>
          <Text
            numberOfLines={4}
            style={[styles.errorMessage, { color: colors.text }]}
          >
            {item.body}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { borderColor: hidden ? colors.border : colors.accent },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: hidden ? colors.textMuted : colors.accent },
            ]}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.errorMeta}>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          Latest reason: {reason}
        </Text>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          Reported {formatTimestamp(item.latest_report_at)}
        </Text>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          Event {item.event_id}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => onToggle(item)}
        style={({ pressed }) => [
          styles.resolveButton,
          {
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
            opacity: busy ? 0.5 : pressed ? 0.68 : 1,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.text} />
        ) : (
          <Text style={[styles.resolveText, { color: colors.text }]}>
            {hidden ? "Restore contribution" : "Hide contribution"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function ConfigToggle({
  label,
  detail,
  value,
  onValueChange,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = useBrieflyTheme();
  return (
    <View
      style={[
        styles.configRow,
        { borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.configCopy}>
        <Text style={[styles.configLabel, { color: colors.text }]}>{label}</Text>
        {!!detail && (
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>
            {detail}
          </Text>
        )}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function TelemetryConfigEditor({
  config,
  loading,
  saving,
  error,
  saved,
  onChange,
  onSave,
}: {
  config: BetaDashboardTelemetryConfig | null;
  loading: boolean;
  saving: boolean;
  error: boolean;
  saved: boolean;
  onChange: <K extends keyof BetaDashboardTelemetryConfig>(
    key: K,
    value: BetaDashboardTelemetryConfig[K],
  ) => void;
  onSave: () => void;
}) {
  const { colors } = useBrieflyTheme();

  if (loading && !config) {
    return <ScreenState loading message="Loading telemetry controls…" />;
  }

  if (!config) {
    return (
      <Text style={[styles.empty, { color: colors.textMuted }]}>
        Telemetry controls are unavailable.
      </Text>
    );
  }

  return (
    <View
      style={[
        styles.configPanel,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View
        style={[
          styles.configFieldRow,
          { borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.configCopy}>
          <Text style={[styles.configLabel, { color: colors.text }]}>
            Test account emails
          </Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>
            One email per line or comma separated. Matching uses the trusted
            authenticated account email and never stores the email in telemetry.
          </Text>
        </View>
        <TextInput
          value={config.test_account_emails.join("\n")}
          onChangeText={(value) =>
            onChange(
              "test_account_emails",
              value
                .split(/[\n,]+/)
                .map((item) => item.trim().toLowerCase())
                .filter(Boolean)
                .slice(0, 20),
            )
          }
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          multiline
          placeholder="test@example.com"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.configInput,
            styles.configInputMultiline,
            {
              borderColor: colors.border,
              backgroundColor: colors.background,
              color: colors.text,
            },
          ]}
        />
      </View>

      <ConfigToggle
        label="Include test accounts in product analytics"
        detail="When off, new analytics batches from the listed authenticated accounts are accepted but filtered before database writes."
        value={config.include_test_accounts_in_analytics}
        onValueChange={(value) =>
          onChange("include_test_accounts_in_analytics", value)
        }
      />

      <ConfigToggle
        label="Include test accounts in error monitoring"
        detail="Independent from analytics so you can exclude test usage while still keeping test crashes and API/server failures."
        value={config.include_test_accounts_in_error_monitoring}
        onValueChange={(value) =>
          onChange("include_test_accounts_in_error_monitoring", value)
        }
      />

      <View style={styles.configActions}>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={onSave}
          style={({ pressed }) => [
            styles.configSaveButton,
            {
              backgroundColor: colors.text,
              opacity: saving ? 0.5 : pressed ? 0.72 : 1,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={[styles.configSaveText, { color: colors.background }]}>
              Save telemetry controls
            </Text>
          )}
        </Pressable>
        {saved && !error && (
          <Text style={[styles.configStatus, { color: colors.textMuted }]}>
            Saved. Applies to new telemetry only.
          </Text>
        )}
        {error && (
          <Text style={[styles.configStatus, { color: colors.accent }]}>
            Save failed. Existing telemetry controls were not changed.
          </Text>
        )}
      </View>
    </View>
  );
}


function RuntimeConfigEditor({
  config,
  loading,
  saving,
  error,
  saved,
  onChange,
  onSave,
}: {
  config: BrieflyAppConfig | null;
  loading: boolean;
  saving: boolean;
  error: boolean;
  saved: boolean;
  onChange: <K extends keyof BrieflyAppConfig>(
    key: K,
    value: BrieflyAppConfig[K],
  ) => void;
  onSave: () => void;
}) {
  const { colors } = useBrieflyTheme();

  if (loading && !config) {
    return <ScreenState loading message="Loading runtime configuration…" />;
  }

  if (!config) {
    return (
      <Text style={[styles.empty, { color: colors.textMuted }]}>
        Runtime configuration is unavailable.
      </Text>
    );
  }

  return (
    <View
      style={[
        styles.configPanel,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <ConfigToggle
        label="Email/password login"
        detail="Enable the reviewer email/password sign-in flow."
        value={config.email_password_login_enabled}
        onValueChange={(value) =>
          onChange("email_password_login_enabled", value)
        }
      />

      <View
        style={[
          styles.configFieldRow,
          { borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.configCopy}>
          <Text style={[styles.configLabel, { color: colors.text }]}>
            Reviewer email
          </Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>
            Optional reviewer account shown by the current review-login config.
          </Text>
        </View>
        <TextInput
          value={config.reviewer_email ?? ""}
          onChangeText={(value) => onChange("reviewer_email", value || null)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="reviewer@example.com"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.configInput,
            {
              borderColor: colors.border,
              backgroundColor: colors.background,
              color: colors.text,
            },
          ]}
        />
      </View>

      <ConfigToggle
        label="Ads enabled"
        detail="Master advertising switch."
        value={config.ads_enabled}
        onValueChange={(value) => onChange("ads_enabled", value)}
      />
      <ConfigToggle
        label="Ads free for Pro"
        detail="Suppress ads for Briefly Pro users."
        value={config.ads_free_for_pro}
        onValueChange={(value) => onChange("ads_free_for_pro", value)}
      />
      <ConfigToggle
        label="Home ads"
        detail="Allow ad placements in the home feed."
        value={config.home_ad_enabled}
        onValueChange={(value) => onChange("home_ad_enabled", value)}
      />

      <View
        style={[
          styles.configFieldRow,
          { borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.configCopy}>
          <Text style={[styles.configLabel, { color: colors.text }]}>
            Home ad interval
          </Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>
            Number of feed items between home ad placements. Allowed: 1–100.
          </Text>
        </View>
        <TextInput
          value={String(config.home_ad_interval)}
          onChangeText={(value) => {
            const digits = value.replace(/[^0-9]/g, "");
            if (!digits) return;
            onChange(
              "home_ad_interval",
              Math.max(1, Math.min(100, Number(digits))),
            );
          }}
          keyboardType="number-pad"
          style={[
            styles.configInputSmall,
            {
              borderColor: colors.border,
              backgroundColor: colors.background,
              color: colors.text,
            },
          ]}
        />
      </View>

      <ConfigToggle
        label="Story ads"
        detail="Allow ad placements on StoryDetail."
        value={config.story_ad_enabled}
        onValueChange={(value) => onChange("story_ad_enabled", value)}
      />

      <View
        style={[
          styles.configFieldRow,
          { borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.configCopy}>
          <Text style={[styles.configLabel, { color: colors.text }]}>
            Ad provider
          </Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>
            Lowercase provider identifier, for example admob.
          </Text>
        </View>
        <TextInput
          value={config.ad_provider}
          onChangeText={(value) =>
            onChange(
              "ad_provider",
              value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
            )
          }
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.configInput,
            {
              borderColor: colors.border,
              backgroundColor: colors.background,
              color: colors.text,
            },
          ]}
        />
      </View>

      <ConfigToggle
        label="Homepage video"
        detail="Allow source video playback on the homepage."
        value={config.homepage_video_enabled}
        onValueChange={(value) => onChange("homepage_video_enabled", value)}
      />
      <ConfigToggle
        label="Story video"
        detail="Allow source video playback inside stories."
        value={config.story_video_enabled}
        onValueChange={(value) => onChange("story_video_enabled", value)}
      />

      <View style={styles.configActions}>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={onSave}
          style={({ pressed }) => [
            styles.configSaveButton,
            {
              backgroundColor: colors.text,
              opacity: saving ? 0.5 : pressed ? 0.72 : 1,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={[styles.configSaveText, { color: colors.background }]}>
              Save runtime config
            </Text>
          )}
        </Pressable>
        {saved && !error && (
          <Text style={[styles.configStatus, { color: colors.textMuted }]}>
            Saved.
          </Text>
        )}
        {error && (
          <Text style={[styles.configStatus, { color: colors.accent }]}>
            Save failed. Current settings were not replaced in the editor.
          </Text>
        )}
      </View>
    </View>
  );
}

export default function BetaDashboardScreen() {
  const { width } = useWindowDimensions();
  const { ready: authReady, user, account } = useBrieflyAuth();
  const { colors } = useBrieflyTheme();
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(7);
  const [snapshot, setSnapshot] = useState<BetaDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState(false);
  const [busyFingerprint, setBusyFingerprint] = useState<string | null>(null);
  const [communityModeration, setCommunityModeration] =
    useState<CommunityModerationQueue | null>(null);
  const [communityModerationLoading, setCommunityModerationLoading] =
    useState(true);
  const [communityModerationError, setCommunityModerationError] =
    useState(false);
  const [busyContributionId, setBusyContributionId] = useState<number | null>(
    null,
  );
  const [appConfig, setAppConfig] = useState<BrieflyAppConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [telemetryConfig, setTelemetryConfig] =
    useState<BetaDashboardTelemetryConfig | null>(null);
  const [telemetryConfigLoading, setTelemetryConfigLoading] = useState(true);
  const [telemetryConfigSaving, setTelemetryConfigSaving] = useState(false);
  const [telemetryConfigError, setTelemetryConfigError] = useState(false);
  const [telemetryConfigSaved, setTelemetryConfigSaved] = useState(false);
  const [telemetryHealth, setTelemetryHealth] =
    useState<BetaDashboardTelemetryHealth | null>(null);
  const [telemetryHealthLoading, setTelemetryHealthLoading] = useState(true);
  const [telemetryHealthError, setTelemetryHealthError] = useState(false);
  const [dashboardTab, setDashboardTab] =
    useState<DashboardTab>("overview");
  const [socialBetaTab, setSocialBetaTab] =
    useState<SocialBetaTab>("overview");
  const socialBeta = snapshot?.product.social_beta ?? EMPTY_SOCIAL_BETA;

  const refreshDashboard = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);

    try {
      const next = await getBetaDashboard(days);
      setError(false);
      setForbidden(false);
      setSnapshot(next);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      if (message.includes("(403)") || message.includes("(401)")) {
        setForbidden(true);
      } else {
        setError(true);
      }
    } finally {
      setRefreshing(false);
    }
  }, [days, user]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      router.replace("/sign-in?returnTo=%2Fbeta-dashboard" as never);
      return;
    }

    let active = true;

    getBetaDashboard(days)
      .then((next) => {
        if (!active) return;
        setError(false);
        setForbidden(false);
        setSnapshot(next);
      })
      .catch((caught) => {
        if (!active) return;
        const message = caught instanceof Error ? caught.message : "";
        if (message.includes("(403)") || message.includes("(401)")) {
          setForbidden(true);
        } else {
          setError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authReady, days, user]);

  useEffect(() => {
    if (!authReady || !user || account?.is_admin !== true) return;

    let active = true;

    getBetaDashboardAppConfig()
      .then((next) => {
        if (!active) return;
        setAppConfig(next);
        setConfigError(false);
      })
      .catch(() => {
        if (active) setConfigError(true);
      })
      .finally(() => {
        if (active) setConfigLoading(false);
      });

    return () => {
      active = false;
    };
  }, [account?.is_admin, authReady, user]);

  useEffect(() => {
    if (!authReady || !user || account?.is_admin !== true) return;

    let active = true;
    setTelemetryConfigLoading(true);
    setTelemetryHealthLoading(true);

    void Promise.allSettled([
      getBetaDashboardTelemetryConfig(),
      getBetaDashboardTelemetryHealth(),
    ]).then(([configResult, healthResult]) => {
      if (!active) return;

      if (configResult.status === "fulfilled") {
        setTelemetryConfig(configResult.value);
        setTelemetryConfigError(false);
      } else {
        setTelemetryConfigError(true);
      }
      setTelemetryConfigLoading(false);

      if (healthResult.status === "fulfilled") {
        setTelemetryHealth(healthResult.value);
        setTelemetryHealthError(false);
      } else {
        setTelemetryHealthError(true);
      }
      setTelemetryHealthLoading(false);
    });

    return () => {
      active = false;
    };
  }, [account?.is_admin, authReady, user]);

  const refreshTelemetryHealth = useCallback(async () => {
    if (!user || account?.is_admin !== true) return;

    setTelemetryHealthLoading(true);
    try {
      const next = await getBetaDashboardTelemetryHealth();
      setTelemetryHealth(next);
      setTelemetryHealthError(false);
    } catch {
      setTelemetryHealthError(true);
    } finally {
      setTelemetryHealthLoading(false);
    }
  }, [account?.is_admin, user]);

  const refreshCommunityModeration = useCallback(async () => {
    if (!user || account?.is_admin !== true) return;

    setCommunityModerationLoading(true);
    try {
      const next = await getCommunityModerationQueue();
      setCommunityModeration(next);
      setCommunityModerationError(false);
    } catch {
      setCommunityModerationError(true);
    } finally {
      setCommunityModerationLoading(false);
    }
  }, [account?.is_admin, user]);

  useEffect(() => {
    if (!authReady || !user || account?.is_admin !== true) return;

    let active = true;

    getCommunityModerationQueue()
      .then((next) => {
        if (!active) return;
        setCommunityModeration(next);
        setCommunityModerationError(false);
      })
      .catch(() => {
        if (active) setCommunityModerationError(true);
      })
      .finally(() => {
        if (active) setCommunityModerationLoading(false);
      });

    return () => {
      active = false;
    };
  }, [account?.is_admin, authReady, user]);

  const toggleCommunityVisibility = async (item: CommunityModerationItem) => {
    setBusyContributionId(item.contribution_id);
    try {
      await setCommunityContributionVisibility(
        item.contribution_id,
        item.status === "hidden",
      );
      await refreshCommunityModeration();
    } catch {
      setCommunityModerationError(true);
    } finally {
      setBusyContributionId(null);
    }
  };

  const changeAppConfig = <K extends keyof BrieflyAppConfig>(
    key: K,
    value: BrieflyAppConfig[K],
  ) => {
    setConfigSaved(false);
    setAppConfig((current) =>
      current ? { ...current, [key]: value } : current,
    );
  };

  const saveAppConfig = async () => {
    if (!appConfig) return;
    setConfigSaving(true);
    setConfigSaved(false);
    setConfigError(false);
    try {
      const savedConfig = await updateBetaDashboardAppConfig(appConfig);
      setAppConfig(savedConfig);
      setConfigSaved(true);
    } catch {
      setConfigError(true);
    } finally {
      setConfigSaving(false);
    }
  };

  const changeTelemetryConfig = <
    K extends keyof BetaDashboardTelemetryConfig,
  >(
    key: K,
    value: BetaDashboardTelemetryConfig[K],
  ) => {
    setTelemetryConfigSaved(false);
    setTelemetryConfig((current) =>
      current ? { ...current, [key]: value } : current,
    );
  };

  const saveTelemetryConfig = async () => {
    if (!telemetryConfig) return;
    setTelemetryConfigSaving(true);
    setTelemetryConfigSaved(false);
    setTelemetryConfigError(false);
    try {
      const savedConfig =
        await updateBetaDashboardTelemetryConfig(telemetryConfig);
      setTelemetryConfig(savedConfig);
      setTelemetryConfigSaved(true);
    } catch {
      setTelemetryConfigError(true);
    } finally {
      setTelemetryConfigSaving(false);
    }
  };

  const maxEventCount = useMemo(
    () =>
      Math.max(
        0,
        ...(snapshot?.product.event_counts ?? []).map((item) => item.count),
      ),
    [snapshot],
  );

  const maxPlatformEvents = useMemo(
    () =>
      Math.max(
        0,
        ...(snapshot?.product.platforms ?? []).map((item) => item.events),
      ),
    [snapshot],
  );

  const maxLensCount = useMemo(
    () =>
      Math.max(
        0,
        ...(socialBeta.lens_breakdown ?? []).map(
          (item) => item.count,
        ),
      ),
    [socialBeta.lens_breakdown],
  );

  const maxPodcastCount = useMemo(
    () =>
      Math.max(
        0,
        ...(socialBeta.podcast_breakdown ?? []).map(
          (item) => item.count,
        ),
      ),
    [socialBeta.podcast_breakdown],
  );

  const maxStorySourceCount = useMemo(
    () =>
      Math.max(
        0,
        ...(socialBeta.story_source_breakdown ?? []).map(
          (item) => item.count,
        ),
      ),
    [socialBeta.story_source_breakdown],
  );

  const toggleError = async (item: BetaDashboardErrorGroup) => {
    const resolved = item.unresolved_occurrences > 0;
    setBusyFingerprint(item.fingerprint);
    try {
      await setBetaDashboardErrorResolution(item.fingerprint, resolved);
      await refreshDashboard();
    } finally {
      setBusyFingerprint(null);
    }
  };

  if (!authReady || !user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenState loading message="Loading beta dashboard…" />
      </SafeAreaView>
    );
  }

  if (forbidden || (account && account.is_admin === false)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.statePage}>
          <AppHeader />
          <ScreenState
            title="Admin access required"
            message="This internal dashboard is available only to Briefly admin accounts."
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.page, width < 560 && styles.pageCompact]}>
          <AppHeader />

          <View style={styles.intro}>
            <View style={styles.introCopy}>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>
                INTERNAL BETA
              </Text>
              <Text style={[styles.title, { color: colors.text }]}>
                Beta dashboard
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Product usage and first-party error monitoring. No third-party
                analytics data.
              </Text>
            </View>

            <View style={styles.windowRow}>
              {WINDOWS.map((windowDays) => {
                const active = days === windowDays;
                return (
                  <Pressable
                    key={windowDays}
                    onPress={() => setDays(windowDays)}
                    style={[
                      styles.windowButton,
                      {
                        borderColor: active ? colors.text : colors.border,
                        backgroundColor: active ? colors.text : colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.windowText,
                        { color: active ? colors.background : colors.textMuted },
                      ]}
                    >
                      {windowDays}d
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                disabled={refreshing}
                onPress={() => void refreshDashboard()}
                style={({ pressed }) => [
                  styles.refreshButton,
                  {
                    borderColor: colors.border,
                    opacity: refreshing ? 0.5 : pressed ? 0.65 : 1,
                  },
                ]}
              >
                <Text style={[styles.windowText, { color: colors.text }]}>
                  {refreshing ? "Refreshing…" : "Refresh"}
                </Text>
              </Pressable>
            </View>
          </View>

          {loading && !snapshot ? (
            <ScreenState loading message="Loading beta metrics…" />
          ) : error || !snapshot ? (
            <ScreenState
              title="Dashboard unavailable"
              message="Could not load beta metrics from the Briefly API."
            />
          ) : (
            <>
              <View style={styles.dashboardTabs}>
                {DASHBOARD_TABS.map((tab) => {
                  const active = dashboardTab === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      onPress={() => setDashboardTab(tab.id)}
                      style={[
                        styles.dashboardTab,
                        {
                          borderColor: active ? colors.text : colors.border,
                          backgroundColor: active
                            ? colors.text
                            : colors.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dashboardTabText,
                          {
                            color: active
                              ? colors.background
                              : colors.textMuted,
                          },
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {dashboardTab === "overview" && (
                <>
                  <View style={styles.metricsGrid}>
                <MetricCard
                  label="Sessions"
                  value={number(snapshot.product.summary.sessions)}
                  detail={String(days) + "-day unique in-memory sessions"}
                />
                <MetricCard
                  label="Product events"
                  value={number(snapshot.product.summary.total_events)}
                  detail={
                    number(snapshot.product.summary.authenticated_users) +
                    " authenticated users"
                  }
                />
                <MetricCard
                  label="Unresolved errors"
                  value={number(snapshot.errors.summary.unresolved_errors)}
                  detail={
                    number(snapshot.errors.summary.unique_fingerprints) +
                    " fingerprints"
                  }
                />
                <MetricCard
                  label="Server errors"
                  value={number(snapshot.errors.summary.server_errors)}
                  detail={
                    number(snapshot.errors.summary.client_errors) +
                    " client errors"
                  }
                />
              </View>

              <View style={styles.section}>
                <SectionTitle
                  title="Core session reach"
                  detail="Percentages use sessions that opened at least one story as the baseline."
                />
                <View style={styles.funnelGrid}>
                  <MetricCard
                    label="Opened story"
                    value={number(snapshot.product.funnel.story_open_sessions)}
                    detail="Baseline sessions"
                  />
                  <MetricCard
                    label="Saved story"
                    value={number(snapshot.product.funnel.story_save_sessions)}
                    detail={percentage(snapshot.product.funnel.story_save_rate)}
                  />
                  <MetricCard
                    label="Followed event"
                    value={number(snapshot.product.funnel.event_follow_sessions)}
                    detail={percentage(snapshot.product.funnel.event_follow_rate)}
                  />
                  <MetricCard
                    label="Viewed Following"
                    value={number(snapshot.product.funnel.following_view_sessions)}
                    detail={percentage(snapshot.product.funnel.following_view_rate)}
                  />
                </View>
              </View>

                  <View style={styles.section}>
                    <SectionTitle
                      title="Usage trend"
                      detail="Daily unique sessions for the selected dashboard window."
                    />
                    <DailySessionsTrend items={snapshot.product.daily_usage} />
                  </View>
                </>
              )}

              {dashboardTab === "social" && (
              <View style={styles.section}>
                <SectionTitle
                  title="Social beta"
                  detail="Session-level conversion and engagement. Feed→story is not a per-card impression CTR."
                />

                <View style={styles.analyticsTabs}>
                  {SOCIAL_BETA_TABS.map((tab) => {
                    const active = socialBetaTab === tab.id;
                    return (
                      <Pressable
                        key={tab.id}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        onPress={() => setSocialBetaTab(tab.id)}
                        style={[
                          styles.analyticsTab,
                          {
                            borderColor: active ? colors.text : colors.border,
                            backgroundColor: active ? colors.text : colors.surface,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.analyticsTabText,
                            {
                              color: active
                                ? colors.background
                                : colors.textMuted,
                            },
                          ]}
                        >
                          {tab.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {socialBetaTab === "overview" && (
                  <View style={styles.funnelGrid}>
                    <MetricCard
                      label="Feed → story"
                      value={percentage(socialBeta.feed_to_story_rate)}
                      detail={
                        number(socialBeta.feed_story_open_sessions) +
                        " of " +
                        number(socialBeta.feed_view_sessions) +
                        " feed sessions"
                      }
                    />
                    <MetricCard
                      label="Switched event lens"
                      value={percentage(socialBeta.lens_rate)}
                      detail={
                        number(socialBeta.lens_sessions) + " story sessions"
                      }
                    />
                    <MetricCard
                      label="Opened a source"
                      value={percentage(socialBeta.source_open_rate)}
                      detail={
                        number(socialBeta.source_open_sessions) +
                        " story sessions"
                      }
                    />
                    <MetricCard
                      label="Shared a story"
                      value={percentage(socialBeta.share_rate)}
                      detail={
                        number(socialBeta.share_sessions) + " story sessions"
                      }
                    />
                    <MetricCard
                      label="Used podcast"
                      value={percentage(socialBeta.podcast_action_rate)}
                      detail={
                        number(socialBeta.podcast_action_sessions) +
                        " story sessions"
                      }
                    />
                    <MetricCard
                      label="Returned on 2+ days"
                      value={percentage(socialBeta.returning_user_rate)}
                      detail={
                        number(socialBeta.returning_users) +
                        " of " +
                        number(socialBeta.authenticated_active_users) +
                        " signed-in active users"
                      }
                    />
                  </View>
                )}

                {socialBetaTab === "acquisition" && (
                  <View
                    style={[
                      styles.panel,
                      styles.tabPanel,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <SectionTitle title="Story acquisition" />
                    <View style={styles.activityList}>
                      {socialBeta.story_source_breakdown.length === 0 ? (
                        <Text style={[styles.empty, { color: colors.textMuted }]}>
                          No story opens yet.
                        </Text>
                      ) : (
                        socialBeta.story_source_breakdown.map((item) => (
                          <ActivityBar
                            key={item.name}
                            label={item.name}
                            value={item.count}
                            max={maxStorySourceCount}
                            detail={number(item.sessions) + " sessions"}
                          />
                        ))
                      )}
                    </View>
                  </View>
                )}

                {socialBetaTab === "lenses" && (
                  <View
                    style={[
                      styles.panel,
                      styles.tabPanel,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <SectionTitle title="Lens selections" />
                    <View style={styles.activityList}>
                      {socialBeta.lens_breakdown.length === 0 ? (
                        <Text style={[styles.empty, { color: colors.textMuted }]}>
                          No explicit lens selections yet.
                        </Text>
                      ) : (
                        socialBeta.lens_breakdown.map((item) => (
                          <ActivityBar
                            key={item.name}
                            label={item.name}
                            value={item.count}
                            max={maxLensCount}
                            detail={number(item.sessions) + " sessions"}
                          />
                        ))
                      )}
                    </View>
                  </View>
                )}

                {socialBetaTab === "deeply" && (
                  <View
                    style={[
                      styles.panel,
                      styles.tabPanel,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <SectionTitle title="Podcast actions" />
                    <View style={styles.activityList}>
                      {socialBeta.podcast_breakdown.length === 0 ? (
                        <Text style={[styles.empty, { color: colors.textMuted }]}>
                          No podcast actions yet.
                        </Text>
                      ) : (
                        socialBeta.podcast_breakdown.map((item) => (
                          <ActivityBar
                            key={item.name}
                            label={item.name}
                            value={item.count}
                            max={maxPodcastCount}
                            detail={number(item.sessions) + " sessions"}
                          />
                        ))
                      )}
                    </View>
                  </View>
                )}
              </View>
              )}

              {dashboardTab === "operations" && (
                <>
              <View style={styles.section}>
                <SectionTitle
                  title="Telemetry health"
                  detail="Read-only storage verification for first-party analytics and error monitoring."
                />
                <View style={styles.windowRow}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={telemetryHealthLoading}
                    onPress={() => void refreshTelemetryHealth()}
                    style={({ pressed }) => [
                      styles.refreshButton,
                      {
                        borderColor: colors.border,
                        opacity: telemetryHealthLoading
                          ? 0.5
                          : pressed
                            ? 0.65
                            : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.windowText, { color: colors.text }]}>
                      {telemetryHealthLoading ? "Checking…" : "Refresh telemetry"}
                    </Text>
                  </Pressable>
                </View>

                {telemetryHealthLoading && !telemetryHealth ? (
                  <ActivityIndicator
                    color={colors.accent}
                    style={{ alignSelf: "flex-start", marginTop: 14 }}
                  />
                ) : telemetryHealthError || !telemetryHealth ? (
                  <Text
                    style={[
                      styles.empty,
                      { color: colors.textMuted, marginTop: 14 },
                    ]}
                  >
                    Telemetry health is unavailable.
                  </Text>
                ) : (
                  <>
                    <View style={[styles.metricsGrid, { marginTop: 14 }]}>
                      <MetricCard
                        label="Analytics · 24h"
                        value={number(telemetryHealth.analytics.events_24h)}
                        detail={
                          number(telemetryHealth.analytics.sessions_24h) +
                          " sessions"
                        }
                      />
                      <MetricCard
                        label="Authenticated · 24h"
                        value={number(
                          telemetryHealth.analytics.authenticated_users_24h,
                        )}
                        detail="users represented in analytics"
                      />
                      <MetricCard
                        label="Errors · 24h"
                        value={number(telemetryHealth.errors.errors_24h)}
                        detail={
                          number(telemetryHealth.errors.client_errors_24h) +
                          " client · " +
                          number(telemetryHealth.errors.server_errors_24h) +
                          " server"
                        }
                      />
                      <MetricCard
                        label="Unresolved errors"
                        value={number(telemetryHealth.errors.unresolved_errors)}
                        detail="all-time unresolved occurrences"
                      />
                    </View>
                    <Text style={[styles.metaText, { color: colors.textMuted }]}>
                      Analytics last received:{" "}
                      {formatTimestamp(telemetryHealth.analytics.last_received_at)}
                      {" · "}Errors last received:{" "}
                      {formatTimestamp(telemetryHealth.errors.last_received_at)}
                    </Text>
                  </>
                )}
              </View>

              <View style={styles.twoColumn}>
                <View
                  style={[
                    styles.panel,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                >
                  <SectionTitle title="Event activity" />
                  <View style={styles.activityList}>
                    {snapshot.product.event_counts.map((item) => (
                      <ActivityBar
                        key={item.event_name}
                        label={item.event_name}
                        value={item.count}
                        max={maxEventCount}
                        detail={number(item.sessions) + " sessions"}
                      />
                    ))}
                  </View>
                </View>

                <View
                  style={[
                    styles.panel,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                >
                  <SectionTitle title="Platforms" />
                  <View style={styles.activityList}>
                    {snapshot.product.platforms.map((item) => (
                      <ActivityBar
                        key={item.platform}
                        label={item.platform}
                        value={item.events}
                        max={maxPlatformEvents}
                        detail={number(item.sessions) + " sessions"}
                      />
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <SectionTitle
                  title="Community moderation"
                  detail="Reported event contributions. Account identities stay private; only moderation-relevant content is shown."
                />
                <View style={styles.windowRow}>
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    {number(communityModeration?.count)} reported contributions
                  </Text>
                  <Pressable
                    disabled={communityModerationLoading}
                    onPress={() => void refreshCommunityModeration()}
                    style={({ pressed }) => [
                      styles.refreshButton,
                      {
                        borderColor: colors.border,
                        opacity: communityModerationLoading
                          ? 0.5
                          : pressed
                            ? 0.65
                            : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.windowText, { color: colors.text }]}>
                      {communityModerationLoading ? "Refreshing…" : "Refresh"}
                    </Text>
                  </Pressable>
                </View>

                {communityModerationLoading && !communityModeration ? (
                  <ActivityIndicator
                    color={colors.accent}
                    style={{ alignSelf: "flex-start", marginTop: 14 }}
                  />
                ) : communityModerationError && !communityModeration ? (
                  <Text
                    style={[
                      styles.empty,
                      { color: colors.textMuted, marginTop: 14 },
                    ]}
                  >
                    Community moderation queue is unavailable.
                  </Text>
                ) : communityModeration?.items.length ? (
                  <View style={[styles.errorList, { marginTop: 14 }]}>
                    {communityModeration.items.map((item) => (
                      <CommunityModerationCard
                        key={item.contribution_id}
                        item={item}
                        busy={busyContributionId === item.contribution_id}
                        onToggle={(contribution) =>
                          void toggleCommunityVisibility(contribution)
                        }
                      />
                    ))}
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.empty,
                      { color: colors.textMuted, marginTop: 14 },
                    ]}
                  >
                    No reported contributions.
                  </Text>
                )}
              </View>

              <View style={styles.section}>
                <SectionTitle
                  title="Error groups"
                  detail="Grouped by sanitized fingerprint. Unresolved groups are shown first."
                />
                {snapshot.errors.groups.length === 0 ? (
                  <Text style={[styles.empty, { color: colors.textMuted }]}>
                    No errors recorded in this window.
                  </Text>
                ) : (
                  <View style={styles.errorList}>
                    {snapshot.errors.groups.map((item) => (
                      <ErrorGroupCard
                        key={item.fingerprint}
                        item={item}
                        busy={busyFingerprint === item.fingerprint}
                        onToggle={(group) => void toggleError(group)}
                      />
                    ))}
                  </View>
                )}
              </View>

                </>
              )}

              {dashboardTab === "settings" && (
                <>
                  <View style={styles.section}>
                    <SectionTitle
                      title="Runtime configuration"
                      detail="Admin-only product controls backed by briefly_app_config."
                    />
                    <RuntimeConfigEditor
                      config={appConfig}
                      loading={configLoading}
                      saving={configSaving}
                      error={configError}
                      saved={configSaved}
                      onChange={changeAppConfig}
                      onSave={() => void saveAppConfig()}
                    />
                  </View>

                  <View style={styles.section}>
                    <SectionTitle
                      title="Test-account telemetry"
                      detail="Private admin-only controls. Email is used only to classify the trusted authenticated account and is not written into analytics or error rows."
                    />
                    <TelemetryConfigEditor
                      config={telemetryConfig}
                      loading={telemetryConfigLoading}
                      saving={telemetryConfigSaving}
                      error={telemetryConfigError}
                      saved={telemetryConfigSaved}
                      onChange={changeTelemetryConfig}
                      onSave={() => void saveTelemetryConfig()}
                    />
                  </View>
                </>
              )}

              <Text style={[styles.generated, { color: colors.textMuted }]}>
                Generated {formatTimestamp(snapshot.generated_at)}
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { alignItems: "center" },
  page: {
    width: "100%",
    maxWidth: layout.pageMax,
    paddingHorizontal: layout.pagePadding,
    paddingBottom: 80,
  },
  pageCompact: { paddingHorizontal: layout.pagePaddingCompact },
  statePage: {
    flex: 1,
    width: "100%",
    maxWidth: layout.pageMax,
    alignSelf: "center",
    paddingHorizontal: layout.pagePadding,
  },
  intro: {
    paddingVertical: 28,
    gap: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  introCopy: { gap: 7, maxWidth: 760 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  title: { fontSize: 36, lineHeight: 42, fontWeight: "900" },
  subtitle: { fontSize: 16, lineHeight: 24, maxWidth: 700 },
  windowRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  windowButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  windowText: { fontSize: 12, fontWeight: "800" },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 32,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: 210,
    minHeight: 122,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 7,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metricValue: { fontSize: 31, lineHeight: 36, fontWeight: "900" },
  metricDetail: { fontSize: 12, lineHeight: 18 },
  section: { marginBottom: 34 },
  sectionHeader: { gap: 5, marginBottom: 14 },
  sectionTitle: { fontSize: 22, lineHeight: 28, fontWeight: "900" },
  sectionDetail: { fontSize: 13, lineHeight: 19, maxWidth: 720 },
  funnelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  dashboardTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 28,
  },
  dashboardTab: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  dashboardTabText: { fontSize: 13, fontWeight: "900" },
  analyticsTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  analyticsTab: {
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  analyticsTabText: { fontSize: 12, fontWeight: "800" },
  tabPanel: { marginBottom: 0 },
  trendPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  trendSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    flexWrap: "wrap",
  },
  trendValue: { fontSize: 32, lineHeight: 37, fontWeight: "900" },
  trendCaption: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
  trendChart: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
    borderRadius: 12,
  },
  trendLine: {
    position: "absolute",
    height: 2,
    borderRadius: 999,
  },
  trendPoint: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  trendAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  trendAxisText: { fontSize: 11, fontWeight: "700" },
  twoColumn: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 34,
  },
  panel: {
    flexGrow: 1,
    flexBasis: 380,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  activityList: { gap: 14 },
  activityRow: { gap: 6 },
  activityTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  activityLabel: { flex: 1, fontSize: 13, fontWeight: "800" },
  activityValue: { fontSize: 12, fontWeight: "600" },
  track: { height: 7, borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
  configPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: "hidden",
  },
  configRow: {
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  },
  configFieldRow: {
    minHeight: 82,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 14,
  },
  configCopy: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 300,
    gap: 4,
  },
  configLabel: {
    fontSize: 14,
    fontWeight: "800",
  },
  configDetail: {
    fontSize: 12,
    lineHeight: 18,
  },
  configInput: {
    minWidth: 220,
    minHeight: 40,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 13,
  },
  configInputMultiline: {
    minWidth: 280,
    minHeight: 96,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  configInputSmall: {
    width: 90,
    minHeight: 40,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 13,
    textAlign: "center",
  },
  configActions: {
    minHeight: 70,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  configSaveButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  configSaveText: {
    fontSize: 13,
    fontWeight: "900",
  },
  configStatus: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  errorList: { gap: 12 },
  errorCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  errorTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  errorTitleWrap: { flex: 1, minWidth: 220, gap: 5 },
  errorType: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  errorMessage: { fontSize: 17, lineHeight: 23, fontWeight: "800" },
  errorMessageBody: { fontSize: 13, lineHeight: 20 },
  statusBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  errorMeta: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaText: { fontSize: 11, fontWeight: "600" },
  resolveButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  resolveText: { fontSize: 12, fontWeight: "800" },
  empty: { fontSize: 14, lineHeight: 21 },
  generated: { fontSize: 11, textAlign: "right" },
});

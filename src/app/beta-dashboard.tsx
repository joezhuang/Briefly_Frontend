import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
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
  createBetaDashboardStripePromotion,
  deactivateBetaDashboardStripePromotion,
  getBetaDashboard,
  getBetaDashboardAdminAuditLog,
  getBetaDashboardBillingHealth,
  getBetaDashboardAppConfig,
  getBetaDashboardAppConfigHistory,
  getBetaDashboardCustomerSupport,
  getBetaDashboardStripePromotions,
  getBetaDashboardTelemetryConfig,
  getBetaDashboardTelemetryHealth,
  getCommunityModerationQueue,
  setBetaDashboardErrorResolution,
  reconcileBetaDashboardBilling,
  rollbackBetaDashboardAppConfig,
  setCommunityContributionVisibility,
  updateBetaDashboardAppConfig,
  updateBetaDashboardTelemetryConfig,
  type BetaDashboardAdminAuditItem,
  type BetaDashboardAdminAuditPage,
  type BetaDashboardBillingOperationalHealth,
  type BetaDashboardCustomerSupport,
  type BetaDashboardErrorGroup,
  type BetaDashboardSnapshot,
  type BetaDashboardTelemetryConfig,
  type BetaDashboardTelemetryHealth,
  type BrieflyAppConfig,
  type CommunityModerationItem,
  type CommunityModerationQueue,
  type StripePromotion,
} from "@/api/briefly";
import { AppHeader } from "@/components/app-header";
import { ScreenState } from "@/components/screen-state";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyAppConfig } from "@/context/app-config";
import { useBrieflyTheme } from "@/context/theme";
import { layout } from "@/theme/tokens";

const WINDOWS = [7, 30, 90] as const;
const DASHBOARD_TABS = [
  { id: "overview", label: "Overview" },
  { id: "social", label: "Social Beta" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "operations", label: "Operations" },
  { id: "support", label: "Support" },
  { id: "settings", label: "Settings" },
] as const;
const SOCIAL_BETA_TABS = [
  { id: "overview", label: "Overview" },
  { id: "acquisition", label: "Acquisition" },
  { id: "community", label: "Community" },
  { id: "lenses", label: "Lenses" },
  { id: "deeply", label: "Podcast" },
] as const;

type DashboardTab = (typeof DASHBOARD_TABS)[number]["id"];
type SocialBetaTab = (typeof SOCIAL_BETA_TABS)[number]["id"];

const EMPTY_COMMUNITY_ENGAGEMENT = {
  community_panel_load_sessions: 0,
  contribution_start_sessions: 0,
  contribution_create_events: 0,
  reaction_events: 0,
  report_events: 0,
  source_open_events: 0,
  withdraw_events: 0,
  sourced_contribution_events: 0,
  active_events: 0,
  community_panel_load_users: 0,
  contribution_start_users: 0,
  contributor_users: 0,
  reaction_users: 0,
  report_users: 0,
  source_open_users: 0,
  returning_contributors: 0,
  panel_load_to_start_rate: 0,
  participation_rate: 0,
  start_to_publish_rate: 0,
  reaction_rate: 0,
  report_rate: 0,
  source_open_rate: 0,
  returning_contributor_rate: 0,
  sourced_contribution_rate: 0,
  kind_breakdown: [],
  reaction_breakdown: [],
  report_breakdown: [],
} as const;

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

function supportProviderLabel(
  provider: BetaDashboardCustomerSupport["lifecycle"]["provider"],
) {
  if (provider === "stripe") return "Web / Stripe";
  if (provider === "app_store") return "App Store";
  if (provider === "play_store") return "Google Play";
  return "None";
}

function supportBillingEventLabel(
  eventType: string,
  providerEventType?: string | null,
) {
  if (providerEventType === "TRANSFER") return "Transfer";
  return eventType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function CustomerSupportConsole() {
  const { colors } = useBrieflyTheme();
  const [query, setQuery] = useState("");
  const [result, setResult] =
    useState<BetaDashboardCustomerSupport | null>(null);
  const [billingHealth, setBillingHealth] =
    useState<BetaDashboardBillingOperationalHealth | null>(null);
  const [billingHealthLoading, setBillingHealthLoading] = useState(false);
  const [billingHealthError, setBillingHealthError] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadBillingHealth = async (userId: string) => {
    setBillingHealthLoading(true);
    setBillingHealthError(false);
    try {
      const next = await getBetaDashboardBillingHealth(userId);
      setBillingHealth(next);
      return next;
    } catch {
      setBillingHealthError(true);
      return null;
    } finally {
      setBillingHealthLoading(false);
    }
  };

  const search = async () => {
    const normalized = query.trim();
    if (normalized.length < 3 || loading) return;

    setLoading(true);
    setMessage(null);
    setBillingHealth(null);
    setBillingHealthError(false);
    try {
      const next = await getBetaDashboardCustomerSupport(normalized);
      setResult(next);
      await loadBillingHealth(next.profile.id);
    } catch (caught) {
      setResult(null);
      setBillingHealth(null);
      const text = caught instanceof Error ? caught.message : "";
      setMessage(
        text.includes("(404)")
          ? "No Briefly account matched that exact email or user ID."
          : "Customer support data is unavailable.",
      );
    } finally {
      setLoading(false);
    }
  };

  const performReconciliation = async () => {
    if (!result || reconciling) return;
    setReconciling(true);
    setMessage(null);
    try {
      const next = await reconcileBetaDashboardBilling(result.profile.id);
      if (next.support) setResult(next.support);
      if (next.health) {
        setBillingHealth(next.health);
        setBillingHealthError(false);
      } else {
        await loadBillingHealth(result.profile.id);
      }
      setMessage(
        next.status === "partial"
          ? "Reconciliation completed with one or more provider checks unavailable. Review the notes below."
          : "Reconciliation completed. Briefly's ledger and profile were refreshed from the available provider state.",
      );
    } catch {
      setMessage(
        "Reconciliation failed. No store purchase, cancellation, refund, or renewal setting was changed.",
      );
    } finally {
      setReconciling(false);
    }
  };

  const confirmReconciliation = () => {
    if (!result || reconciling) return;

    const prompt =
      "Reconcile this Briefly account from RevenueCat and Stripe now?\n\n" +
      "This refreshes Briefly's local subscription ledger/profile only. It does not purchase, cancel, refund, or change auto-renew at Apple, Google, or Stripe.";

    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.confirm === "function"
    ) {
      if (window.confirm(prompt)) void performReconciliation();
      return;
    }

    Alert.alert("Reconcile billing state?", prompt, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reconcile",
        onPress: () => void performReconciliation(),
      },
    ]);
  };

  const rc = billingHealth?.providers.revenuecat;
  const stripeHealth = billingHealth?.providers.stripe;
  const reconciliationAuditAvailable =
    billingHealth?.reconciliation_history.available !== false;
  const reconciliationHistory =
    billingHealth?.reconciliation_history.items.filter(
      (item) => item.action !== "billing_reconciliation.start",
    ) ?? [];

  const revenueCatState =
    !rc?.configured
      ? "Not configured"
      : !rc.reachable
        ? "Unavailable"
        : rc.active
          ? "Active"
          : "Inactive";

  const stripeState =
    !stripeHealth?.configured
      ? "Not configured"
      : !stripeHealth.reachable
        ? "Unavailable"
        : !stripeHealth.linked
          ? "No customer"
          : stripeHealth.active
            ? "Active"
            : "Inactive";

  return (
    <View style={styles.supportConsole}>
      <View
        style={[
          styles.supportSearch,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <View style={styles.supportSearchCopy}>
          <Text style={[styles.configLabel, { color: colors.text }]}>
            Find Briefly account
          </Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>
            Search by exact account email or Supabase user ID. Provider checks are
            diagnostic until you explicitly choose Reconcile now.
          </Text>
        </View>
        <View style={styles.supportSearchControls}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void search()}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="person@example.com or user UUID"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.supportSearchInput,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
                color: colors.text,
              },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            disabled={query.trim().length < 3 || loading}
            onPress={() => void search()}
            style={({ pressed }) => [
              styles.supportSearchButton,
              {
                backgroundColor: colors.text,
                opacity:
                  query.trim().length < 3 || loading
                    ? 0.45
                    : pressed
                      ? 0.7
                      : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text
                style={[styles.configSaveText, { color: colors.background }]}
              >
                Search
              </Text>
            )}
          </Pressable>
        </View>
        {!!message && (
          <Text style={[styles.configStatus, { color: colors.textMuted }]}>
            {message}
          </Text>
        )}
      </View>

      {result && (
        <>
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Briefly Pro"
              value={result.lifecycle.is_pro ? "Active" : "No"}
              detail={result.lifecycle.lifecycle_state.replaceAll("_", " ")}
            />
            <MetricCard
              label="Provider"
              value={supportProviderLabel(result.lifecycle.provider)}
              detail={result.lifecycle.plan || "No plan recorded"}
            />
            <MetricCard
              label="Consistency"
              value={result.consistency.in_sync ? "In sync" : "Review"}
              detail={
                result.consistency.in_sync
                  ? "Profile and canonical billing state agree"
                  : result.consistency.issues.length + " issue(s)"
              }
            />
            <MetricCard
              label="Ledger sources"
              value={number(result.ledger_sources.length)}
              detail={
                number(result.lifecycle.active_platforms.length) +
                " active provider(s)"
              }
            />
          </View>

          <View style={styles.twoColumn}>
            <View
              style={[
                styles.panel,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <SectionTitle title="Account" />
              <View style={styles.supportDetailList}>
                <Text style={[styles.supportDetail, { color: colors.text }]}>
                  {result.profile.email || "No email"}
                </Text>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  User ID: {result.profile.id}
                </Text>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  Profile Pro: {result.profile.is_pro ? "yes" : "no"}
                </Text>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  Profile platform:{" "}
                  {supportProviderLabel(result.profile.briefly_pro_platform)}
                </Text>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  Stripe customer: {result.profile.stripe_customer_id || "—"}
                </Text>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  First used Briefly:{" "}
                  {formatTimestamp(result.profile.first_used_briefly_at)}
                </Text>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  Last active Briefly:{" "}
                  {formatTimestamp(result.profile.last_active_briefly_at)}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.panel,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <SectionTitle title="Canonical subscription" />
              <View style={styles.supportDetailList}>
                <Text style={[styles.supportDetail, { color: colors.text }]}>
                  {result.lifecycle.lifecycle_state.replaceAll("_", " ")}
                </Text>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  Provider: {supportProviderLabel(result.lifecycle.provider)}
                </Text>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  Provider status: {result.lifecycle.provider_status || "—"}
                </Text>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  Plan: {result.lifecycle.plan || "—"}
                </Text>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  Renews: {formatTimestamp(result.lifecycle.renews_at)}
                </Text>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  Access until: {formatTimestamp(result.lifecycle.access_until)}
                </Text>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  Grace period end:{" "}
                  {formatTimestamp(result.lifecycle.grace_period_end)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <SectionTitle
              title="Profile / ledger consistency"
              detail="Local Briefly diagnostics. Provider state is checked separately below."
            />
            <View
              style={[
                styles.supportConsistency,
                {
                  borderColor: result.consistency.in_sync
                    ? colors.border
                    : colors.accent,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              {result.consistency.in_sync &&
              result.consistency.warnings.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>
                  No local consistency issues detected.
                </Text>
              ) : (
                <>
                  {result.consistency.issues.map((item) => (
                    <Text
                      key={"issue-" + item}
                      style={[styles.supportIssue, { color: colors.text }]}
                    >
                      Issue · {item}
                    </Text>
                  ))}
                  {result.consistency.warnings.map((item) => (
                    <Text
                      key={"warning-" + item}
                      style={[styles.supportWarning, { color: colors.textMuted }]}
                    >
                      Note · {item}
                    </Text>
                  ))}
                </>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <SectionTitle
              title="Billing operational health"
              detail="Live RevenueCat / Stripe checks compared with Briefly's canonical ledger. Reconcile repairs Briefly state only; it never changes the provider subscription."
            />

            <View style={[styles.windowRow, { marginBottom: 14 }]}>
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                Last checked: {formatTimestamp(billingHealth?.checked_at)}
              </Text>
              <Pressable
                disabled={billingHealthLoading}
                onPress={() => void loadBillingHealth(result.profile.id)}
                style={[styles.resolveButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.resolveText, { color: colors.text }]}>
                  {billingHealthLoading ? "Checking…" : "Check providers"}
                </Text>
              </Pressable>
              <Pressable
                disabled={reconciling || !reconciliationAuditAvailable}
                onPress={confirmReconciliation}
                style={[
                  styles.supportSearchButton,
                  {
                    backgroundColor: colors.text,
                    opacity:
                      reconciling || !reconciliationAuditAvailable ? 0.5 : 1,
                  },
                ]}
              >
                {reconciling ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text
                    style={[styles.configSaveText, { color: colors.background }]}
                  >
                    {reconciliationAuditAvailable
                      ? "Reconcile now"
                      : "Audit storage required"}
                  </Text>
                )}
              </Pressable>
            </View>

            {billingHealthLoading && !billingHealth ? (
              <ActivityIndicator
                color={colors.accent}
                style={{ alignSelf: "flex-start", marginBottom: 14 }}
              />
            ) : billingHealthError && !billingHealth ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                Provider health is unavailable. The existing Briefly billing state
                has not been changed.
              </Text>
            ) : billingHealth ? (
              <>
                <View style={styles.metricsGrid}>
                  <MetricCard
                    label="RevenueCat"
                    value={revenueCatState}
                    detail={
                      rc?.reachable
                        ? supportProviderLabel(rc.platform) +
                          " · expires " +
                          formatTimestamp(rc.expires_at)
                        : rc?.error || "Native provider check unavailable"
                    }
                  />
                  <MetricCard
                    label="Stripe"
                    value={stripeState}
                    detail={
                      stripeHealth?.reachable
                        ? number(stripeHealth.subscriptions.length) +
                          " subscription record(s)"
                        : stripeHealth?.error || "Web provider check unavailable"
                    }
                  />
                  <MetricCard
                    label="Provider consistency"
                    value={
                      billingHealth.consistency.in_sync ? "In sync" : "Review"
                    }
                    detail={
                      billingHealth.consistency.in_sync
                        ? "Provider and canonical state agree"
                        : billingHealth.consistency.issues.length + " issue(s)"
                    }
                  />
                </View>

                <View
                  style={[
                    styles.supportConsistency,
                    {
                      borderColor: billingHealth.consistency.in_sync
                        ? colors.border
                        : colors.accent,
                      backgroundColor: colors.surface,
                      marginBottom: 18,
                    },
                  ]}
                >
                  {billingHealth.consistency.in_sync &&
                  billingHealth.consistency.warnings.length === 0 ? (
                    <Text style={[styles.empty, { color: colors.textMuted }]}>
                      RevenueCat, Stripe, the ledger, and the profile agree.
                    </Text>
                  ) : (
                    <>
                      {billingHealth.consistency.issues.map((item) => (
                        <Text
                          key={"provider-issue-" + item}
                          style={[styles.supportIssue, { color: colors.text }]}
                        >
                          Issue · {item}
                        </Text>
                      ))}
                      {billingHealth.consistency.warnings.map((item) => (
                        <Text
                          key={"provider-warning-" + item}
                          style={[
                            styles.supportWarning,
                            { color: colors.textMuted },
                          ]}
                        >
                          Note · {item}
                        </Text>
                      ))}
                    </>
                  )}
                </View>

                <View
                  style={[
                    styles.panel,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <SectionTitle
                    title="Manual reconciliation history"
                    detail="Audited support repairs for this account. RevenueCat transfer events also appear in Billing event history below."
                  />
                  {!reconciliationAuditAvailable ? (
                    <Text style={[styles.supportIssue, { color: colors.text }]}>
                      Manual reconciliation history is unavailable. Phase 29 admin
                      audit storage must be applied and reachable before Reconcile
                      now can run safely.
                    </Text>
                  ) : reconciliationHistory.length === 0 ? (
                    <Text style={[styles.empty, { color: colors.textMuted }]}>
                      No manual reconciliation has been run for this account.
                    </Text>
                  ) : (
                    <View style={styles.supportDetailList}>
                      {reconciliationHistory.map((item) => (
                        <Text
                          key={item.id}
                          style={[styles.metaText, { color: colors.textMuted }]}
                        >
                          {formatTimestamp(item.created_at)} ·{" "}
                          {item.action.replaceAll("_", " ").replaceAll(".", " · ")}
                          {" · "}
                          {item.actor_email || item.actor_user_id || "Unknown admin"}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.section}>
            <SectionTitle
              title="Billing event history"
              detail="Append-only provider lifecycle and transfer events, newest first. This history is diagnostic and does not grant access."
            />
            {(result.billing_events ?? []).length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                No billing lifecycle events have been recorded for this account yet.
              </Text>
            ) : (
              <View style={styles.errorList}>
                {(result.billing_events ?? []).map((event, index) => (
                  <View
                    key={
                      event.id != null
                        ? String(event.id)
                        : event.provider +
                          "-" +
                          (event.provider_event_id || index)
                    }
                    style={[
                      styles.errorCard,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <View style={styles.errorTop}>
                      <View style={styles.errorTitleWrap}>
                        <Text
                          style={[styles.errorType, { color: colors.accent }]}
                        >
                          {supportBillingEventLabel(
                            event.event_type,
                            event.provider_event_type,
                          )}{" "}
                          · {supportProviderLabel(event.provider)}
                        </Text>
                        <Text
                          style={[styles.errorMessage, { color: colors.text }]}
                        >
                          {formatTimestamp(event.occurred_at)}
                          {event.plan ? " · " + event.plan : ""}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.supportDetailList}>
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        Provider status: {event.status || "—"}
                      </Text>
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        Provider event: {event.provider_event_type || "—"}
                      </Text>
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        Subscription: {event.external_subscription_id || "—"}
                      </Text>
                      {event.previous_provider && (
                        <Text
                          style={[styles.metaText, { color: colors.textMuted }]}
                        >
                          Previous provider:{" "}
                          {supportProviderLabel(event.previous_provider)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <SectionTitle
              title="Subscription ledger"
              detail="Newest provider records first. Provider IDs are shown for support diagnosis."
            />
            {result.ledger_sources.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                No Briefly subscription ledger rows for this account yet.
              </Text>
            ) : (
              <View style={styles.errorList}>
                {result.ledger_sources.map((source, index) => (
                  <View
                    key={
                      source.id != null
                        ? String(source.id)
                        : source.provider +
                          "-" +
                          (source.external_subscription_id || index)
                    }
                    style={[
                      styles.errorCard,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <View style={styles.errorTop}>
                      <View style={styles.errorTitleWrap}>
                        <Text
                          style={[styles.errorType, { color: colors.accent }]}
                        >
                          {source.provider.toUpperCase()} ·{" "}
                          {source.is_active ? "ACTIVE" : "INACTIVE"}
                        </Text>
                        <Text
                          style={[styles.errorMessage, { color: colors.text }]}
                        >
                          {source.status || "unknown"}
                          {source.plan ? " · " + source.plan : ""}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.supportDetailList}>
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        Subscription: {source.external_subscription_id || "—"}
                      </Text>
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        Customer: {source.external_customer_id || "—"}
                      </Text>
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        Product: {source.product_id || "—"} · Price:{" "}
                        {source.price_id || "—"}
                      </Text>
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        Period end: {formatTimestamp(source.current_period_end)}
                      </Text>
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        Last event: {source.provider_event_type || "—"} ·{" "}
                        {formatTimestamp(source.provider_event_at)}
                      </Text>
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        Ledger updated: {formatTimestamp(source.updated_at)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
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
  const { width } = useWindowDimensions();
  const stackEmailEditor = width < 640;

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
          stackEmailEditor && styles.telemetryEmailRowStacked,
          { borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.telemetryEmailCopy}>
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
            stackEmailEditor && styles.telemetryEmailInputStacked,
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


function auditChangedFields(item: BetaDashboardAdminAuditItem) {
  const value = item.metadata?.changed_fields;
  if (!Array.isArray(value)) return [];
  return value.filter((field): field is string => typeof field === "string");
}

function RuntimeConfigHistoryPanel({
  page,
  loading,
  error,
  busyId,
  onRefresh,
  onRollback,
}: {
  page: BetaDashboardAdminAuditPage | null;
  loading: boolean;
  error: boolean;
  busyId: number | null;
  onRefresh: () => void;
  onRollback: (item: BetaDashboardAdminAuditItem) => void;
}) {
  const { colors } = useBrieflyTheme();

  return (
    <View
      style={[
        styles.configPanel,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={[styles.auditToolbar, { borderBottomColor: colors.border }]}>
        <View style={styles.auditToolbarCopy}>
          <Text style={[styles.configLabel, { color: colors.text }]}>
            Recent runtime changes
          </Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>
            Every saved change records the administrator, changed fields, and the
            previous configuration. Restore re-applies the state from before that
            change and creates a new audit event.
          </Text>
        </View>
        <Pressable
          disabled={loading}
          onPress={onRefresh}
          style={[styles.resolveButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.resolveText, { color: colors.text }]}>
            {loading ? "Refreshing…" : "Refresh"}
          </Text>
        </Pressable>
      </View>

      {loading && !page ? (
        <View style={styles.auditLoading}>
          <ActivityIndicator size="small" color={colors.textMuted} />
          <Text style={[styles.configStatus, { color: colors.textMuted }]}>
            Loading runtime history…
          </Text>
        </View>
      ) : error && !page ? (
        <Text style={[styles.promoEmpty, { color: colors.textMuted }]}>
          Runtime history is unavailable.
        </Text>
      ) : !page?.items.length ? (
        <Text style={[styles.promoEmpty, { color: colors.textMuted }]}>
          No runtime configuration changes have been recorded yet.
        </Text>
      ) : (
        <View style={styles.auditList}>
          {page.items.map((item) => {
            const changed = auditChangedFields(item);
            const rollbackSource = item.metadata?.rollback_of_audit_id;
            const canRollback =
              item.before_value !== null && busyId !== item.id;
            return (
              <View
                key={item.id}
                style={[styles.auditItem, { borderTopColor: colors.border }]}
              >
                <View style={styles.auditItemCopy}>
                  <Text style={[styles.configLabel, { color: colors.text }]}>
                    {item.action === "runtime_config.rollback"
                      ? "Runtime rollback"
                      : "Runtime configuration saved"}
                  </Text>
                  <Text style={[styles.configDetail, { color: colors.textMuted }]}>
                    {formatTimestamp(item.created_at)} ·{" "}
                    {item.actor_email || item.actor_user_id || "Unknown admin"}
                  </Text>
                  <Text style={[styles.configDetail, { color: colors.textMuted }]}>
                    {changed.length
                      ? "Changed: " + changed.join(", ")
                      : "No field-level differences recorded"}
                    {typeof rollbackSource === "number"
                      ? " · rollback of #" + rollbackSource
                      : ""}
                  </Text>
                </View>
                <Pressable
                  disabled={!canRollback}
                  onPress={() => onRollback(item)}
                  style={[
                    styles.resolveButton,
                    { borderColor: colors.border },
                    !canRollback && styles.disabled,
                  ]}
                >
                  <Text style={[styles.resolveText, { color: colors.text }]}>
                    {busyId === item.id ? "Restoring…" : "Restore previous"}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function AdminAuditLogPanel({
  page,
  loading,
  error,
  onRefresh,
}: {
  page: BetaDashboardAdminAuditPage | null;
  loading: boolean;
  error: boolean;
  onRefresh: () => void;
}) {
  const { colors } = useBrieflyTheme();

  return (
    <View
      style={[
        styles.configPanel,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={[styles.auditToolbar, { borderBottomColor: colors.border }]}>
        <View style={styles.auditToolbarCopy}>
          <Text style={[styles.configLabel, { color: colors.text }]}>
            Recent administrative actions
          </Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>
            Append-only history for runtime settings, telemetry controls,
            moderation, error resolution, and Briefly-managed Stripe promotions.
          </Text>
        </View>
        <Pressable
          disabled={loading}
          onPress={onRefresh}
          style={[styles.resolveButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.resolveText, { color: colors.text }]}>
            {loading ? "Refreshing…" : "Refresh"}
          </Text>
        </Pressable>
      </View>

      {loading && !page ? (
        <View style={styles.auditLoading}>
          <ActivityIndicator size="small" color={colors.textMuted} />
          <Text style={[styles.configStatus, { color: colors.textMuted }]}>
            Loading audit log…
          </Text>
        </View>
      ) : error && !page ? (
        <Text style={[styles.promoEmpty, { color: colors.textMuted }]}>
          Admin audit log is unavailable. Verify that Phase 29 admin audit storage
          has been applied to the backend database and is reachable.
        </Text>
      ) : !page?.items.length ? (
        <Text style={[styles.promoEmpty, { color: colors.textMuted }]}>
          No administrative actions have been recorded yet.
        </Text>
      ) : (
        <View style={styles.auditList}>
          {page.items.map((item) => {
            const changed = auditChangedFields(item);
            return (
              <View
                key={item.id}
                style={[styles.auditItem, { borderTopColor: colors.border }]}
              >
                <View style={styles.auditItemCopy}>
                  <Text style={[styles.configLabel, { color: colors.text }]}>
                    {item.action.replaceAll("_", " ").replaceAll(".", " · ")}
                  </Text>
                  <Text style={[styles.configDetail, { color: colors.textMuted }]}>
                    {item.resource_type}
                    {item.resource_key ? " · " + item.resource_key : ""}
                  </Text>
                  <Text style={[styles.configDetail, { color: colors.textMuted }]}>
                    {formatTimestamp(item.created_at)} ·{" "}
                    {item.actor_email || item.actor_user_id || "Unknown admin"}
                  </Text>
                  {!!changed.length && (
                    <Text style={[styles.configDetail, { color: colors.textMuted }]}>
                      Changed: {changed.join(", ")}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
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
  const { width } = useWindowDimensions();
  const stackWideFields = width < 640;

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
          stackWideFields && styles.configFieldRowStacked,
          { borderBottomColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.configCopy,
            stackWideFields && styles.configCopyStacked,
          ]}
        >
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
            stackWideFields && styles.configInputFullWidth,
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
          stackWideFields && styles.configFieldRowStacked,
          { borderBottomColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.configCopy,
            stackWideFields && styles.configCopyStacked,
          ]}
        >
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
            stackWideFields && styles.configInputFullWidth,
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
      <ConfigToggle
        label="Floating video"
        detail="Allow a playing source video to detach into a floating player while scrolling."
        value={config.floating_video_enabled}
        onValueChange={(value) => onChange("floating_video_enabled", value)}
      />

      <SectionTitle
        title="Remote operations"
        detail="Operational controls that can change without shipping a new app binary."
      />
      <ConfigToggle
        label="Maintenance mode"
        detail="Show a maintenance screen instead of the main news experience."
        value={config.maintenance_mode}
        onValueChange={(value) => onChange("maintenance_mode", value)}
      />
      <View style={[styles.configFieldRow, stackWideFields && styles.configFieldRowStacked, { borderBottomColor: colors.border }]}>
        <View style={[styles.configCopy, stackWideFields && styles.configCopyStacked]}>
          <Text style={[styles.configLabel, { color: colors.text }]}>Maintenance message</Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>Optional message shown while maintenance mode is enabled.</Text>
        </View>
        <TextInput
          value={config.maintenance_message ?? ""}
          onChangeText={(value) => onChange("maintenance_message", value || null)}
          multiline
          placeholder="Briefly is temporarily unavailable."
          placeholderTextColor={colors.textMuted}
          style={[styles.configInput, stackWideFields && styles.configInputFullWidth, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
        />
      </View>
      <ConfigToggle
        label="Announcement banner"
        detail="Show a short operational or product message on the home feed."
        value={config.announcement_enabled}
        onValueChange={(value) => onChange("announcement_enabled", value)}
      />
      <View style={[styles.configFieldRow, stackWideFields && styles.configFieldRowStacked, { borderBottomColor: colors.border }]}>
        <View style={[styles.configCopy, stackWideFields && styles.configCopyStacked]}>
          <Text style={[styles.configLabel, { color: colors.text }]}>Announcement text</Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>Keep this concise; it appears near the top of the feed.</Text>
        </View>
        <TextInput
          value={config.announcement_text ?? ""}
          onChangeText={(value) => onChange("announcement_text", value || null)}
          multiline
          placeholder="New Briefly features are now available."
          placeholderTextColor={colors.textMuted}
          style={[styles.configInput, stackWideFields && styles.configInputFullWidth, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
        />
      </View>

      <SectionTitle
        title="Story features"
        detail="Turn shipped Briefly features on or off remotely."
      />
      <ConfigToggle label="Community" detail="Show community perspectives and contributions." value={config.community_enabled} onValueChange={(value) => onChange("community_enabled", value)} />
      <ConfigToggle label="Evidence" detail="Show event evidence and uncertainty." value={config.evidence_enabled} onValueChange={(value) => onChange("evidence_enabled", value)} />
      <ConfigToggle label="Timeline" detail="Show event timelines in Story tools." value={config.timeline_enabled} onValueChange={(value) => onChange("timeline_enabled", value)} />
      <ConfigToggle label="Coverage" detail="Show publisher coverage inside Explore this event." value={config.coverage_enabled} onValueChange={(value) => onChange("coverage_enabled", value)} />
      <ConfigToggle label="Podcast" detail="Show Deeply podcast analysis controls." value={config.podcast_enabled} onValueChange={(value) => onChange("podcast_enabled", value)} />
      <ConfigToggle label="Translation" detail="Show Briefly translation controls and notices." value={config.translation_enabled} onValueChange={(value) => onChange("translation_enabled", value)} />
      <ConfigToggle label="Following" detail="Allow users to follow living events." value={config.following_enabled} onValueChange={(value) => onChange("following_enabled", value)} />
      <ConfigToggle label="Search" detail="Allow users to search the canonical event universe." value={config.search_enabled} onValueChange={(value) => onChange("search_enabled", value)} />

      <SectionTitle
        title="Home feeds"
        detail="Control which top-level news feeds are available."
      />
      <ConfigToggle label="Top feed" detail="Show the Top feed." value={config.top_feed_enabled} onValueChange={(value) => onChange("top_feed_enabled", value)} />
      <ConfigToggle label="National feed" detail="Show the National feed." value={config.national_feed_enabled} onValueChange={(value) => onChange("national_feed_enabled", value)} />
      <ConfigToggle label="Local feed" detail="Show the Local feed." value={config.local_feed_enabled} onValueChange={(value) => onChange("local_feed_enabled", value)} />
      <View style={[styles.configFieldRow, stackWideFields && styles.configFieldRowStacked, { borderBottomColor: colors.border }]}>
        <View style={[styles.configCopy, stackWideFields && styles.configCopyStacked]}>
          <Text style={[styles.configLabel, { color: colors.text }]}>Default feed</Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>Use top, national, or local. If disabled, Briefly falls back to the first enabled feed.</Text>
        </View>
        <TextInput
          value={config.default_feed_scope}
          onChangeText={(value) => onChange("default_feed_scope", value.toLowerCase().replace(/[^a-z]/g, "") as BrieflyAppConfig["default_feed_scope"])}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="top"
          placeholderTextColor={colors.textMuted}
          style={[styles.configInput, stackWideFields && styles.configInputFullWidth, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
        />
      </View>

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

function PromotionsEditor({
  config,
  loading,
  saving,
  error,
  saved,
  stripeItems,
  stripeLoading,
  stripeError,
  stripeCreating,
  busyStripeId,
  onChange,
  onSave,
  onCreateStripe,
  onDeactivateStripe,
}: {
  config: BrieflyAppConfig | null;
  loading: boolean;
  saving: boolean;
  error: boolean;
  saved: boolean;
  stripeItems: StripePromotion[];
  stripeLoading: boolean;
  stripeError: boolean;
  stripeCreating: boolean;
  busyStripeId: string | null;
  onChange: <K extends keyof BrieflyAppConfig>(
    key: K,
    value: BrieflyAppConfig[K],
  ) => void;
  onSave: () => void;
  onCreateStripe: (input: {
    code: string;
    percent_off: number;
    duration: "once" | "forever";
    max_redemptions: number | null;
  }) => void;
  onDeactivateStripe: (item: StripePromotion) => void;
}) {
  const { colors } = useBrieflyTheme();
  const { width } = useWindowDimensions();
  const stackWideFields = width < 640;

  if (loading && !config) {
    return <ScreenState loading message="Loading promotion controls…" />;
  }

  if (!config) {
    return (
      <Text style={[styles.empty, { color: colors.textMuted }]}>
        Promotion controls are unavailable.
      </Text>
    );
  }

  return (
    <View style={styles.promotionManager}>
      <View
        style={[
          styles.configPanel,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <View
          style={[
            styles.promotionGuide,
            { borderColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <Text style={[styles.promotionGuideTitle, { color: colors.text }]}>
            Start here — choose the platform you want to discount
          </Text>
          <Text style={[styles.promotionGuideIntro, { color: colors.textMuted }]}>
            Briefly controls when a campaign is shown and which native RevenueCat
            offering is selected. Apple and Google still control native prices and
            eligibility.
          </Text>

          <View style={styles.promotionGuideGrid}>
            <View style={[styles.promotionGuideCard, { borderColor: colors.border }]}>
              <Text style={[styles.promotionGuidePlatform, { color: colors.accent }]}>
                WEB · STRIPE
              </Text>
              <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
                1. Turn on “Accept Stripe promotion codes” below.
              </Text>
              <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
                2. Save promotion settings.
              </Text>
              <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
                3. In “Web / Stripe discount codes” in this same section, create a code such as SAVE20.
              </Text>
              <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
                4. Users enter that code in Stripe Checkout.
              </Text>
              <Text style={[styles.promotionGuideNote, { color: colors.textMuted }]}>
                Web is the only platform where Briefly directly creates the discount percentage.
              </Text>
            </View>

            <View style={[styles.promotionGuideCard, { borderColor: colors.border }]}>
              <Text style={[styles.promotionGuidePlatform, { color: colors.accent }]}>
                IOS · APP STORE + REVENUECAT
              </Text>
              <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
                1. Create the subscription offer or offer code in App Store Connect.
              </Text>
              <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
                2. Make that product/offer available through a RevenueCat offering.
              </Text>
              <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
                3. Paste the exact RevenueCat offering ID below.
              </Text>
              <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
                4. Turn on “Promotion campaign”, then save promotion settings.
              </Text>
              <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
                5. Turn on “iOS offer-code redemption” only when you want the Redeem offer code button.
              </Text>
            </View>

            <View style={[styles.promotionGuideCard, { borderColor: colors.border }]}>
              <Text style={[styles.promotionGuidePlatform, { color: colors.accent }]}>
                ANDROID · GOOGLE PLAY + REVENUECAT
              </Text>
              <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
                1. Create the subscription offer or promotion in Google Play.
              </Text>
              <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
                2. Make the promotional product available through a RevenueCat offering.
              </Text>
              <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
                3. Paste the exact RevenueCat offering ID below.
              </Text>
              <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
                4. Turn on “Promotion campaign”, then save promotion settings.
              </Text>
              <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
                5. “Android promo-code guidance” only explains redemption; it does not create the Google Play discount.
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.promotionSubheader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.promotionSubheaderTitle, { color: colors.text }]}>
            1. Campaign presentation
          </Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>
            These settings control what users see on the Briefly Pro upgrade screen.
          </Text>
        </View>

        <ConfigToggle
          label="Promotion campaign"
          detail="Show the campaign on the Pro upgrade screen. On iOS/Android, also use the RevenueCat offering ID below when one is provided."
          value={config.promotion_enabled}
          onValueChange={(value) => onChange("promotion_enabled", value)}
        />

        <View style={[styles.configFieldRow, stackWideFields && styles.configFieldRowStacked, { borderBottomColor: colors.border }]}>
          <View style={[styles.configCopy, stackWideFields && styles.configCopyStacked]}>
            <Text style={[styles.configLabel, { color: colors.text }]}>Promotion title</Text>
            <Text style={[styles.configDetail, { color: colors.textMuted }]}>
              Short marketing heading shown on the upgrade screen. Example: “Launch offer”.
            </Text>
          </View>
          <TextInput
            value={config.promotion_title ?? ""}
            onChangeText={(value) => onChange("promotion_title", value || null)}
            placeholder="Limited-time Briefly Pro offer"
            placeholderTextColor={colors.textMuted}
            style={[styles.configInput, stackWideFields && styles.configInputFullWidth, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
          />
        </View>

        <View style={[styles.configFieldRow, stackWideFields && styles.configFieldRowStacked, { borderBottomColor: colors.border }]}>
          <View style={[styles.configCopy, stackWideFields && styles.configCopyStacked]}>
            <Text style={[styles.configLabel, { color: colors.text }]}>Promotion message</Text>
            <Text style={[styles.configDetail, { color: colors.textMuted }]}>
              Supporting marketing text. Avoid hard-coding a native price because prices can vary by storefront and currency.
            </Text>
          </View>
          <TextInput
            value={config.promotion_message ?? ""}
            onChangeText={(value) => onChange("promotion_message", value || null)}
            multiline
            placeholder="Choose a plan to see the available offer."
            placeholderTextColor={colors.textMuted}
            style={[styles.configInput, styles.configInputMultiline, stackWideFields && styles.configInputFullWidth, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
          />
        </View>

        <View style={[styles.promotionSubheader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.promotionSubheaderTitle, { color: colors.text }]}>
            2. iOS / Android
          </Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>
            Configure the actual native offer in Apple/Google first, then connect it through RevenueCat here.
          </Text>
        </View>

        <View style={[styles.configFieldRow, stackWideFields && styles.configFieldRowStacked, { borderBottomColor: colors.border }]}>
          <View style={[styles.configCopy, stackWideFields && styles.configCopyStacked]}>
            <Text style={[styles.configLabel, { color: colors.text }]}>Native RevenueCat offering ID</Text>
            <Text style={[styles.configDetail, { color: colors.textMuted }]}>
              Exact RevenueCat offering identifier to use while Promotion campaign is ON. Example: briefly_promo. Leave blank to keep RevenueCat’s normal current offering.
            </Text>
          </View>
          <TextInput
            value={config.native_revenuecat_offering_id ?? ""}
            onChangeText={(value) => onChange("native_revenuecat_offering_id", value.trim() || null)}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="briefly_promo"
            placeholderTextColor={colors.textMuted}
            style={[styles.configInput, stackWideFields && styles.configInputFullWidth, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
          />
        </View>

        <ConfigToggle
          label="iOS offer-code redemption"
          detail="Show “Redeem offer code” on iOS. Apple’s system redemption sheet handles the code."
          value={config.ios_offer_code_redemption_enabled}
          onValueChange={(value) => onChange("ios_offer_code_redemption_enabled", value)}
        />
        <ConfigToggle
          label="Android promo-code guidance"
          detail="Show users guidance about Google Play promo-code redemption. This does not create or change a Google Play offer."
          value={config.android_promo_code_hint_enabled}
          onValueChange={(value) => onChange("android_promo_code_hint_enabled", value)}
        />

        <View style={[styles.promotionSubheader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.promotionSubheaderTitle, { color: colors.text }]}>
            3. Web / Stripe
          </Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>
            Briefly can create and manage Stripe percentage-off codes directly.
          </Text>
        </View>

        <ConfigToggle
          label="Accept Stripe promotion codes"
          detail="When ON, new Stripe Checkout sessions show a promotion-code field. Create the actual codes immediately below."
          value={config.web_promotion_codes_enabled}
          onValueChange={(value) => onChange("web_promotion_codes_enabled", value)}
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
                Save promotion settings
              </Text>
            )}
          </Pressable>
          {saved && !error && (
            <Text style={[styles.configStatus, { color: colors.textMuted }]}>
              Saved. Briefly clients pick up these settings through runtime config.
            </Text>
          )}
          {error && (
            <Text style={[styles.configStatus, { color: colors.accent }]}>
              Save failed. Promotion settings were not updated remotely.
            </Text>
          )}
        </View>
      </View>

      <View style={styles.promotionStripeSection}>
        <SectionTitle
          title="Web / Stripe discount codes"
          detail="Create, review, and deactivate the actual percentage-off codes used by Stripe Checkout."
        />
        <StripePromotionEditor
          items={stripeItems}
          loading={stripeLoading}
          error={stripeError}
          creating={stripeCreating}
          busyId={busyStripeId}
          onCreate={onCreateStripe}
          onDeactivate={onDeactivateStripe}
        />
      </View>
    </View>
  );
}

function StripePromotionEditor({
  items,
  loading,
  error,
  creating,
  busyId,
  onCreate,
  onDeactivate,
}: {
  items: StripePromotion[];
  loading: boolean;
  error: boolean;
  creating: boolean;
  busyId: string | null;
  onCreate: (input: {
    code: string;
    percent_off: number;
    duration: "once" | "forever";
    max_redemptions: number | null;
  }) => void;
  onDeactivate: (item: StripePromotion) => void;
}) {
  const { colors } = useBrieflyTheme();
  const { width } = useWindowDimensions();
  const stacked = width < 640;
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState("20");
  const [duration, setDuration] = useState<"once" | "forever">("once");
  const [maxRedemptions, setMaxRedemptions] = useState("");

  const normalizedPercent = Number(percentOff);
  const normalizedMax = maxRedemptions ? Number(maxRedemptions) : null;
  const canCreate =
    code.trim().length >= 3 &&
    Number.isFinite(normalizedPercent) &&
    normalizedPercent > 0 &&
    normalizedPercent <= 100 &&
    (normalizedMax === null ||
      (Number.isInteger(normalizedMax) && normalizedMax > 0));

  return (
    <View style={[styles.configPanel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View
        style={[
          styles.stripeGuide,
          { borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.promotionGuideTitle, { color: colors.text }]}>
          How to create a web discount code
        </Text>
        <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
          1. Enter the customer-facing code, for example SAVE20.
        </Text>
        <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
          2. Enter the percentage discount.
        </Text>
        <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
          3. Choose “First invoice” for a one-time discount or “Forever” for recurring discounted invoices.
        </Text>
        <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
          4. Optionally set a total redemption limit.
        </Text>
        <Text style={[styles.promotionGuideStep, { color: colors.text }]}>
          5. Press “Create Stripe code”. It becomes usable immediately in new Stripe Checkout sessions while “Accept Stripe promotion codes” is ON.
        </Text>
        <Text style={[styles.promotionGuideNote, { color: colors.textMuted }]}>
          Deactivating a code prevents new redemptions; it does not rewrite subscriptions that already used the code.
        </Text>
      </View>

      <View style={[styles.configFieldRow, stacked && styles.configFieldRowStacked, { borderBottomColor: colors.border }]}>
        <View style={[styles.configCopy, stacked && styles.configCopyStacked]}>
          <Text style={[styles.configLabel, { color: colors.text }]}>Promotion code</Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>Creates a Stripe coupon and customer-facing code restricted to Briefly Pro web subscription products.</Text>
        </View>
        <TextInput
          value={code}
          onChangeText={(value) => setCode(value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 64))}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="SAVE20"
          placeholderTextColor={colors.textMuted}
          style={[styles.configInput, stacked && styles.configInputFullWidth, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
        />
      </View>

      <View style={[styles.configFieldRow, stacked && styles.configFieldRowStacked, { borderBottomColor: colors.border }]}>
        <View style={[styles.configCopy, stacked && styles.configCopyStacked]}>
          <Text style={[styles.configLabel, { color: colors.text }]}>Discount percentage</Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>Percentage off for this Stripe code. Allowed: greater than 0 and up to 100.</Text>
        </View>
        <TextInput
          value={percentOff}
          onChangeText={(value) => setPercentOff(value.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          style={[styles.configInputSmall, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
        />
      </View>

      <View style={[styles.configFieldRow, stacked && styles.configFieldRowStacked, { borderBottomColor: colors.border }]}>
        <View style={[styles.configCopy, stacked && styles.configCopyStacked]}>
          <Text style={[styles.configLabel, { color: colors.text }]}>Duration</Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>Once discounts the first subscription invoice. Forever discounts recurring invoices while the subscription remains eligible.</Text>
        </View>
        <View style={styles.promoChoiceRow}>
          {(["once", "forever"] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setDuration(item)}
              style={[
                styles.promoChoice,
                {
                  borderColor: duration === item ? colors.text : colors.border,
                  backgroundColor: duration === item ? colors.text : colors.background,
                },
              ]}
            >
              <Text style={[styles.promoChoiceText, { color: duration === item ? colors.background : colors.text }]}>
                {item === "once" ? "First invoice" : "Forever"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.configFieldRow, stacked && styles.configFieldRowStacked, { borderBottomColor: colors.border }]}>
        <View style={[styles.configCopy, stacked && styles.configCopyStacked]}>
          <Text style={[styles.configLabel, { color: colors.text }]}>Maximum redemptions</Text>
          <Text style={[styles.configDetail, { color: colors.textMuted }]}>Optional total use limit. Leave blank for no explicit redemption cap.</Text>
        </View>
        <TextInput
          value={maxRedemptions}
          onChangeText={(value) => setMaxRedemptions(value.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          placeholder="Unlimited"
          placeholderTextColor={colors.textMuted}
          style={[styles.configInputSmall, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
        />
      </View>

      <View style={styles.configActions}>
        <Pressable
          disabled={!canCreate || creating}
          onPress={() =>
            onCreate({
              code: code.trim(),
              percent_off: normalizedPercent,
              duration,
              max_redemptions: normalizedMax,
            })
          }
          style={[
            styles.configSaveButton,
            { backgroundColor: colors.text, opacity: !canCreate || creating ? 0.5 : 1 },
          ]}
        >
          {creating ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={[styles.configSaveText, { color: colors.background }]}>Create Stripe code</Text>
          )}
        </Pressable>
        {error && <Text style={[styles.configStatus, { color: colors.accent }]}>Stripe promotion action failed.</Text>}
      </View>

      <View style={styles.promoList}>
        {loading ? (
          <View style={styles.promoLoading}>
            <ActivityIndicator size="small" color={colors.textMuted} />
            <Text style={[styles.configStatus, { color: colors.textMuted }]}>Loading Stripe codes…</Text>
          </View>
        ) : items.length === 0 ? (
          <Text style={[styles.promoEmpty, { color: colors.textMuted }]}>No Briefly-managed Stripe promotion codes yet.</Text>
        ) : (
          items.map((item) => (
            <View key={item.id} style={[styles.promoItem, { borderTopColor: colors.border }]}>
              <View style={styles.promoItemCopy}>
                <View style={styles.promoItemTitleRow}>
                  <Text style={[styles.configLabel, { color: colors.text }]}>{item.code}</Text>
                  <Text style={[styles.promoStatus, { color: item.active ? colors.accent : colors.textMuted }]}>
                    {item.active ? "ACTIVE" : "INACTIVE"}
                  </Text>
                </View>
                <Text style={[styles.configDetail, { color: colors.textMuted }]}>
                  {item.percent_off}% off · {item.duration === "forever" ? "recurring" : "first invoice"} · {item.times_redeemed} redeemed
                  {item.max_redemptions ? ` / ${item.max_redemptions}` : ""}
                </Text>
              </View>
              {item.active && (
                <Pressable
                  disabled={busyId === item.id}
                  onPress={() => onDeactivate(item)}
                  style={[styles.resolveButton, { borderColor: colors.border }, busyId === item.id && styles.disabled]}
                >
                  <Text style={[styles.resolveText, { color: colors.text }]}>
                    {busyId === item.id ? "…" : "Deactivate"}
                  </Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

export default function BetaDashboardScreen() {
  const { width } = useWindowDimensions();
  const { ready: authReady, user, account } = useBrieflyAuth();
  const { applyConfig: applyRuntimeConfig } = useBrieflyAppConfig();
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
  const [runtimeConfigHistory, setRuntimeConfigHistory] =
    useState<BetaDashboardAdminAuditPage | null>(null);
  const [runtimeConfigHistoryLoading, setRuntimeConfigHistoryLoading] =
    useState(true);
  const [runtimeConfigHistoryError, setRuntimeConfigHistoryError] =
    useState(false);
  const [adminAuditLog, setAdminAuditLog] =
    useState<BetaDashboardAdminAuditPage | null>(null);
  const [adminAuditLogLoading, setAdminAuditLogLoading] = useState(true);
  const [adminAuditLogError, setAdminAuditLogError] = useState(false);
  const [busyRollbackId, setBusyRollbackId] = useState<number | null>(null);
  const [stripePromotions, setStripePromotions] = useState<StripePromotion[]>([]);
  const [stripePromotionsLoading, setStripePromotionsLoading] = useState(true);
  const [stripePromotionsError, setStripePromotionsError] = useState(false);
  const [stripePromotionCreating, setStripePromotionCreating] = useState(false);
  const [busyStripePromotionId, setBusyStripePromotionId] = useState<string | null>(null);
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
  const communityEngagement =
    socialBeta.community_engagement ?? EMPTY_COMMUNITY_ENGAGEMENT;

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

  const refreshAdminHistory = useCallback(async () => {
    if (!user || account?.is_admin !== true) return;

    setRuntimeConfigHistoryLoading(true);
    setAdminAuditLogLoading(true);
    const [historyResult, auditResult] = await Promise.allSettled([
      getBetaDashboardAppConfigHistory(),
      getBetaDashboardAdminAuditLog(),
    ]);

    if (historyResult.status === "fulfilled") {
      setRuntimeConfigHistory(historyResult.value);
      setRuntimeConfigHistoryError(false);
    } else {
      setRuntimeConfigHistoryError(true);
    }
    setRuntimeConfigHistoryLoading(false);

    if (auditResult.status === "fulfilled") {
      setAdminAuditLog(auditResult.value);
      setAdminAuditLogError(false);
    } else {
      setAdminAuditLogError(true);
    }
    setAdminAuditLogLoading(false);
  }, [account?.is_admin, user]);

  useEffect(() => {
    if (!authReady || !user || account?.is_admin !== true) return;

    let active = true;

    void Promise.allSettled([
      getBetaDashboardAppConfigHistory(),
      getBetaDashboardAdminAuditLog(),
    ]).then(([historyResult, auditResult]) => {
      if (!active) return;

      if (historyResult.status === "fulfilled") {
        setRuntimeConfigHistory(historyResult.value);
        setRuntimeConfigHistoryError(false);
      } else {
        setRuntimeConfigHistoryError(true);
      }
      setRuntimeConfigHistoryLoading(false);

      if (auditResult.status === "fulfilled") {
        setAdminAuditLog(auditResult.value);
        setAdminAuditLogError(false);
      } else {
        setAdminAuditLogError(true);
      }
      setAdminAuditLogLoading(false);
    });

    return () => {
      active = false;
    };
  }, [account?.is_admin, authReady, user]);

  useEffect(() => {
    if (!authReady || !user || account?.is_admin !== true) return;

    let active = true;
    getBetaDashboardStripePromotions()
      .then((result) => {
        if (!active) return;
        setStripePromotions(result.items);
        setStripePromotionsError(false);
      })
      .catch(() => {
        if (active) setStripePromotionsError(true);
      })
      .finally(() => {
        if (active) setStripePromotionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [account?.is_admin, authReady, user]);

  useEffect(() => {
    if (!authReady || !user || account?.is_admin !== true) return;

    let active = true;

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
      await Promise.all([
        refreshCommunityModeration(),
        refreshAdminHistory(),
      ]);
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
      applyRuntimeConfig(savedConfig);
      setConfigSaved(true);
      await refreshAdminHistory();
    } catch {
      setConfigError(true);
    } finally {
      setConfigSaving(false);
    }
  };

  const createStripePromotion = async (input: {
    code: string;
    percent_off: number;
    duration: "once" | "forever";
    max_redemptions: number | null;
  }) => {
    setStripePromotionCreating(true);
    setStripePromotionsError(false);
    try {
      const created = await createBetaDashboardStripePromotion(input);
      setStripePromotions((current) => [
        created,
        ...current.filter((item) => item.id !== created.id),
      ]);
      await refreshAdminHistory();
    } catch {
      setStripePromotionsError(true);
    } finally {
      setStripePromotionCreating(false);
    }
  };

  const deactivateStripePromotion = async (item: StripePromotion) => {
    setBusyStripePromotionId(item.id);
    setStripePromotionsError(false);
    try {
      const updated = await deactivateBetaDashboardStripePromotion(item.id);
      setStripePromotions((current) =>
        current.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      );
      await refreshAdminHistory();
    } catch {
      setStripePromotionsError(true);
    } finally {
      setBusyStripePromotionId(null);
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
      await refreshAdminHistory();
    } catch {
      setTelemetryConfigError(true);
    } finally {
      setTelemetryConfigSaving(false);
    }
  };

  const performRuntimeRollback = async (
    item: BetaDashboardAdminAuditItem,
  ) => {
    setBusyRollbackId(item.id);
    setConfigError(false);
    try {
      const restored = await rollbackBetaDashboardAppConfig(item.id);
      setAppConfig(restored);
      applyRuntimeConfig(restored);
      setConfigSaved(true);
      await refreshAdminHistory();
    } catch {
      setConfigError(true);
    } finally {
      setBusyRollbackId(null);
    }
  };

  const confirmRuntimeRollback = (item: BetaDashboardAdminAuditItem) => {
    const changed = auditChangedFields(item);
    const message =
      "Restore the runtime configuration from before this change?" +
      (changed.length ? "\n\nFields: " + changed.join(", ") : "");

    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.confirm === "function"
    ) {
      if (window.confirm(message)) {
        void performRuntimeRollback(item);
      }
      return;
    }

    Alert.alert("Restore runtime configuration?", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Restore",
        style: "destructive",
        onPress: () => void performRuntimeRollback(item),
      },
    ]);
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

  const maxCommunityKindCount = useMemo(
    () =>
      Math.max(
        0,
        ...communityEngagement.kind_breakdown.map((item) => item.count),
      ),
    [communityEngagement.kind_breakdown],
  );
  const maxCommunityReactionCount = useMemo(
    () =>
      Math.max(
        0,
        ...communityEngagement.reaction_breakdown.map((item) => item.count),
      ),
    [communityEngagement.reaction_breakdown],
  );
  const maxCommunityReportCount = useMemo(
    () =>
      Math.max(
        0,
        ...communityEngagement.report_breakdown.map((item) => item.count),
      ),
    [communityEngagement.report_breakdown],
  );

  const subscriptionConversion =
    snapshot?.product.subscription_conversion;
  const maxSubscriptionPlanCount = useMemo(
    () =>
      Math.max(
        0,
        ...(subscriptionConversion?.plan_breakdown ?? []).map(
          (item) => item.count,
        ),
      ),
    [subscriptionConversion?.plan_breakdown],
  );
  const maxSubscriptionProviderCount = useMemo(
    () =>
      Math.max(
        0,
        ...(subscriptionConversion?.purchase_provider_breakdown ?? []).map(
          (item) => item.count,
        ),
      ),
    [subscriptionConversion?.purchase_provider_breakdown],
  );

  const toggleError = async (item: BetaDashboardErrorGroup) => {
    const resolved = item.unresolved_occurrences > 0;
    setBusyFingerprint(item.fingerprint);
    try {
      await setBetaDashboardErrorResolution(item.fingerprint, resolved);
      await Promise.all([refreshDashboard(), refreshAdminHistory()]);
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

                {socialBetaTab === "community" && (
                  <>
                    <View style={styles.funnelGrid}>
                      <MetricCard
                        label="Community-loaded sessions"
                        value={number(
                          communityEngagement.community_panel_load_sessions,
                        )}
                        detail={
                          number(communityEngagement.community_panel_load_users) +
                          " signed-in viewer(s) · panel load, not scroll visibility"
                        }
                      />
                      <MetricCard
                        label="Opened composer"
                        value={number(
                          communityEngagement.contribution_start_users,
                        )}
                        detail={
                          percentage(communityEngagement.panel_load_to_start_rate) +
                          " of signed-in viewers"
                        }
                      />
                      <MetricCard
                        label="Published"
                        value={number(communityEngagement.contributor_users)}
                        detail={
                          percentage(communityEngagement.participation_rate) +
                          " of signed-in viewers"
                        }
                      />
                      <MetricCard
                        label="Composer → publish"
                        value={percentage(
                          communityEngagement.start_to_publish_rate,
                        )}
                        detail={
                          number(
                            communityEngagement.contribution_create_events,
                          ) + " contribution event(s)"
                        }
                      />
                      <MetricCard
                        label="Reacted"
                        value={number(communityEngagement.reaction_users)}
                        detail={
                          percentage(communityEngagement.reaction_rate) +
                          " of signed-in viewers"
                        }
                      />
                      <MetricCard
                        label="Opened a Community source"
                        value={number(communityEngagement.source_open_users)}
                        detail={
                          percentage(communityEngagement.source_open_rate) +
                          " of signed-in viewers"
                        }
                      />
                      <MetricCard
                        label="Returning contributors"
                        value={number(
                          communityEngagement.returning_contributors,
                        )}
                        detail={
                          percentage(
                            communityEngagement.returning_contributor_rate,
                          ) + " of contributors"
                        }
                      />
                      <MetricCard
                        label="Source-backed contributions"
                        value={percentage(
                          communityEngagement.sourced_contribution_rate,
                        )}
                        detail={
                          number(
                            communityEngagement.sourced_contribution_events,
                          ) + " contribution(s)"
                        }
                      />
                      <MetricCard
                        label="Reports"
                        value={number(communityEngagement.report_users)}
                        detail={
                          percentage(communityEngagement.report_rate) +
                          " of signed-in viewers"
                        }
                      />
                      <MetricCard
                        label="Active events"
                        value={number(communityEngagement.active_events)}
                        detail="events with Community actions"
                      />
                    </View>

                    <View style={styles.twoColumn}>
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
                        <SectionTitle
                          title="Contribution types"
                          detail="Published Community contributions by type."
                        />
                        <View style={styles.activityList}>
                          {communityEngagement.kind_breakdown.length === 0 ? (
                            <Text
                              style={[styles.empty, { color: colors.textMuted }]}
                            >
                              No Community contributions yet.
                            </Text>
                          ) : (
                            communityEngagement.kind_breakdown.map((item) => (
                              <ActivityBar
                                key={item.name}
                                label={item.name}
                                value={item.count}
                                max={maxCommunityKindCount}
                                detail={number(item.users) + " users"}
                              />
                            ))
                          )}
                        </View>
                      </View>

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
                        <SectionTitle
                          title="Reaction actions"
                          detail="Reaction mutations, including removal when a reaction becomes none."
                        />
                        <View style={styles.activityList}>
                          {communityEngagement.reaction_breakdown.length === 0 ? (
                            <Text
                              style={[styles.empty, { color: colors.textMuted }]}
                            >
                              No Community reactions yet.
                            </Text>
                          ) : (
                            communityEngagement.reaction_breakdown.map((item) => (
                              <ActivityBar
                                key={item.name}
                                label={
                                  item.name === "up"
                                    ? "Helpful"
                                    : item.name === "down"
                                      ? "Not helpful"
                                      : item.name === "none"
                                        ? "Reaction removed"
                                        : item.name
                                }
                                value={item.count}
                                max={maxCommunityReactionCount}
                                detail={number(item.users) + " users"}
                              />
                            ))
                          )}
                        </View>
                      </View>
                    </View>

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
                      <SectionTitle
                        title="Report reasons"
                        detail="Safety signal only. Reports do not affect contribution ranking."
                      />
                      <View style={styles.activityList}>
                        {communityEngagement.report_breakdown.length === 0 ? (
                          <Text
                            style={[styles.empty, { color: colors.textMuted }]}
                          >
                            No Community reports yet.
                          </Text>
                        ) : (
                          communityEngagement.report_breakdown.map((item) => (
                            <ActivityBar
                              key={item.name}
                              label={item.name.replaceAll("_", " ")}
                              value={item.count}
                              max={maxCommunityReportCount}
                              detail={number(item.users) + " users"}
                            />
                          ))
                        )}
                      </View>
                    </View>
                  </>
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

              {dashboardTab === "subscriptions" &&
                subscriptionConversion && (
                <>
                  <View style={styles.section}>
                    <SectionTitle
                      title="Subscription conversion"
                      detail="Unique signed-in users in the selected window. Event counts are shown separately so repeated purchase attempts do not inflate conversion rates."
                    />
                    <View style={styles.funnelGrid}>
                      <MetricCard
                        label="Viewed upgrade"
                        value={number(subscriptionConversion.upgrade_view_users)}
                        detail={
                          number(subscriptionConversion.upgrade_view_events) +
                          " view event(s)"
                        }
                      />
                      <MetricCard
                        label="Selected a plan"
                        value={number(subscriptionConversion.plan_select_users)}
                        detail={
                          percentage(subscriptionConversion.upgrade_to_plan_rate) +
                          " of upgrade viewers"
                        }
                      />
                      <MetricCard
                        label="Started checkout"
                        value={number(subscriptionConversion.checkout_start_users)}
                        detail={
                          percentage(subscriptionConversion.plan_to_checkout_rate) +
                          " of plan selectors"
                        }
                      />
                      <MetricCard
                        label="Completed purchase"
                        value={number(
                          subscriptionConversion.purchase_complete_users,
                        )}
                        detail={
                          percentage(
                            subscriptionConversion.checkout_to_purchase_rate,
                          ) + " of checkout starters"
                        }
                      />
                      <MetricCard
                        label="Upgrade → paid"
                        value={percentage(
                          subscriptionConversion.upgrade_to_purchase_rate,
                        )}
                        detail={
                          number(
                            subscriptionConversion.purchase_complete_events,
                          ) + " completion event(s)"
                        }
                      />
                      <MetricCard
                        label="Checkout cancelled"
                        value={percentage(
                          subscriptionConversion.checkout_cancel_rate,
                        )}
                        detail={
                          number(subscriptionConversion.checkout_cancel_users) +
                          " user(s)"
                        }
                      />
                      <MetricCard
                        label="Restore success"
                        value={percentage(
                          subscriptionConversion.restore_success_rate,
                        )}
                        detail={
                          number(subscriptionConversion.restore_success_users) +
                          " of " +
                          number(subscriptionConversion.restore_start_users) +
                          " restore user(s)"
                        }
                      />
                      <MetricCard
                        label="Opened management"
                        value={number(subscriptionConversion.manage_open_users)}
                        detail="users who opened provider subscription management"
                      />
                    </View>
                  </View>

                  <View style={styles.twoColumn}>
                    <View
                      style={[
                        styles.panel,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <SectionTitle
                        title="Plan selections"
                        detail="Selection attempts before provider checkout."
                      />
                      <View style={styles.activityList}>
                        {subscriptionConversion.plan_breakdown.length === 0 ? (
                          <Text style={[styles.empty, { color: colors.textMuted }]}>
                            No subscription plan selections yet.
                          </Text>
                        ) : (
                          subscriptionConversion.plan_breakdown.map((item) => (
                            <ActivityBar
                              key={item.name}
                              label={
                                item.name === "yearly"
                                  ? "Yearly"
                                  : item.name === "monthly"
                                    ? "Monthly"
                                    : item.name
                              }
                              value={item.count}
                              max={maxSubscriptionPlanCount}
                              detail={number(item.users) + " users"}
                            />
                          ))
                        )}
                      </View>
                    </View>

                    <View
                      style={[
                        styles.panel,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <SectionTitle
                        title="Completed purchases by provider"
                        detail="Client-confirmed Briefly Pro purchase completions."
                      />
                      <View style={styles.activityList}>
                        {subscriptionConversion.purchase_provider_breakdown
                          .length === 0 ? (
                          <Text style={[styles.empty, { color: colors.textMuted }]}>
                            No completed purchases yet.
                          </Text>
                        ) : (
                          subscriptionConversion.purchase_provider_breakdown.map(
                            (item) => (
                              <ActivityBar
                                key={item.name}
                                label={
                                  item.name === "stripe"
                                    ? "Web / Stripe"
                                    : item.name === "app_store"
                                      ? "App Store"
                                      : item.name === "play_store"
                                        ? "Google Play"
                                        : item.name
                                }
                                value={item.count}
                                max={maxSubscriptionProviderCount}
                                detail={number(item.users) + " users"}
                              />
                            ),
                          )
                        )}
                      </View>
                    </View>
                  </View>
                </>
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

              {dashboardTab === "support" && (
                <View style={styles.section}>
                  <SectionTitle
                    title="Customer support"
                    detail="Account diagnostics, live provider health, and audited reconciliation for Briefly billing."
                  />
                  <CustomerSupportConsole />
                </View>
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
                      title="Runtime configuration history"
                      detail="Review who changed runtime controls and restore the state from before any recorded change."
                    />
                    <RuntimeConfigHistoryPanel
                      page={runtimeConfigHistory}
                      loading={runtimeConfigHistoryLoading}
                      error={runtimeConfigHistoryError}
                      busyId={busyRollbackId}
                      onRefresh={() => void refreshAdminHistory()}
                      onRollback={confirmRuntimeRollback}
                    />
                  </View>

                  <View style={styles.section}>
                    <SectionTitle
                      title="Promotions"
                      detail="One place to control campaign messaging, native App Store / Google Play offers through RevenueCat, and web Stripe discount codes."
                    />
                    <PromotionsEditor
                      config={appConfig}
                      loading={configLoading}
                      saving={configSaving}
                      error={configError}
                      saved={configSaved}
                      stripeItems={stripePromotions}
                      stripeLoading={stripePromotionsLoading}
                      stripeError={stripePromotionsError}
                      stripeCreating={stripePromotionCreating}
                      busyStripeId={busyStripePromotionId}
                      onChange={changeAppConfig}
                      onSave={() => void saveAppConfig()}
                      onCreateStripe={(input) => void createStripePromotion(input)}
                      onDeactivateStripe={(item) => void deactivateStripePromotion(item)}
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

                  <View style={styles.section}>
                    <SectionTitle
                      title="Admin audit log"
                      detail="Append-only accountability trail for state-changing Beta Dashboard actions."
                    />
                    <AdminAuditLogPanel
                      page={adminAuditLog}
                      loading={adminAuditLogLoading}
                      error={adminAuditLogError}
                      onRefresh={() => void refreshAdminHistory()}
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
  supportConsole: { gap: 18 },
  supportSearch: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  supportSearchCopy: { gap: 4 },
  supportSearchControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  supportSearchInput: {
    flexGrow: 1,
    flexBasis: 320,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 13,
  },
  supportSearchButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  supportDetailList: { gap: 7 },
  supportDetail: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  supportConsistency: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  supportIssue: { fontSize: 13, lineHeight: 20, fontWeight: "800" },
  supportWarning: { fontSize: 13, lineHeight: 20, fontWeight: "600" },
  configPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: "hidden",
  },
  auditToolbar: {
    minHeight: 78,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  auditToolbarCopy: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 420,
    gap: 4,
  },
  auditLoading: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  auditList: { paddingBottom: 4 },
  auditItem: {
    minHeight: 78,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  auditItemCopy: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 520,
    gap: 5,
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
  telemetryEmailCopy: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 280,
    gap: 4,
  },
  telemetryEmailRowStacked: {
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-start",
  },
  configFieldRowStacked: {
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-start",
  },
  configCopyStacked: {
    flexBasis: "auto",
    width: "100%",
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
  telemetryEmailInputStacked: {
    width: "100%",
    minWidth: 0,
  },
  configInputFullWidth: {
    width: "100%",
    minWidth: 0,
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
  promotionManager: { gap: 18 },
  promotionStripeSection: { gap: 10 },
  promotionSubheader: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  promotionSubheaderTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
  },
  promotionGuide: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  promotionGuideTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
  },
  promotionGuideIntro: {
    fontSize: 12,
    lineHeight: 18,
  },
  promotionGuideGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  promotionGuideCard: {
    flexGrow: 1,
    flexBasis: 280,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  promotionGuidePlatform: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  promotionGuideStep: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "650",
  },
  promotionGuideNote: {
    fontSize: 11,
    lineHeight: 17,
  },
  promotionGuideSummary: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 5,
  },
  promotionGuideSummaryTitle: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "900",
  },
  stripeGuide: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  promoChoiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  promoChoice: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  promoChoiceText: { fontSize: 12, fontWeight: "800" },
  promoList: { paddingBottom: 4 },
  promoLoading: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  promoEmpty: { paddingHorizontal: 16, paddingVertical: 18, fontSize: 13 },
  promoItem: {
    minHeight: 70,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  promoItemCopy: { flex: 1, minWidth: 220, gap: 5 },
  promoItemTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  promoStatus: { fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
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

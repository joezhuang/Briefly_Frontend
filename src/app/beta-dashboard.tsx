import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getBetaDashboard,
  setBetaDashboardErrorResolution,
  type BetaDashboardErrorGroup,
  type BetaDashboardSnapshot,
} from "@/api/briefly";
import { AppHeader } from "@/components/app-header";
import { ScreenState } from "@/components/screen-state";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyTheme } from "@/context/theme";
import { layout } from "@/theme/tokens";

const WINDOWS = [7, 30, 90] as const;

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

  const maxDailySessions = useMemo(
    () =>
      Math.max(
        0,
        ...(snapshot?.product.daily_usage ?? []).map((item) => item.sessions),
      ),
    [snapshot],
  );

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

              <View
                style={[
                  styles.panel,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              >
                <SectionTitle title="Daily sessions" />
                <View style={styles.activityList}>
                  {snapshot.product.daily_usage.map((item) => (
                    <ActivityBar
                      key={item.day}
                      label={item.day}
                      value={item.sessions}
                      max={maxDailySessions}
                      detail={number(item.events) + " events"}
                    />
                  ))}
                </View>
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

import { router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";

import { getChartReviewQueue, type ChartReviewQueue } from "@/api/briefly";
import { chartReviewStoryHref } from "@/utils/chart-review-link";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyTheme } from "@/context/theme";

function queueSignature(queue: ChartReviewQueue): string {
  return queue.items
    .map((item) => item.event_id + ":" + item.article_version_id + ":" + item.updated_at)
    .join("|");
}

export function AdminChartReviewNotification() {
  const { ready, user, account } = useBrieflyAuth();
  const { colors } = useBrieflyTheme();
  const pathname = usePathname();
  const [queueByUser, setQueueByUser] = useState<{
    userId: string;
    queue: ChartReviewQueue;
  } | null>(null);
  const [dismissed, setDismissed] = useState<{
    userId: string;
    signature: string;
  } | null>(null);
  const enabled = ready && !!user && account?.is_admin === true;
  const userId = user?.id ?? "";
  // A previous admin's queue must never show during another login.
  const queue = queueByUser?.userId === userId ? queueByUser.queue : null;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const refresh = async () => {
      try {
        const next = await getChartReviewQueue();
        if (active) setQueueByUser({ userId, queue: next });
      } catch {
        // Do not interrupt news reading when admin analytics are unavailable.
      }
    };
    void refresh(); // First admin app load: no dashboard visit required.
    const interval = setInterval(() => void refresh(), 60000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled, userId, pathname]);

  if (!enabled || !queue?.pending_count || pathname.startsWith("/beta-dashboard")) return null;
  const signature = queueSignature(queue);
  if (dismissed?.userId === userId && dismissed.signature === signature) return null;

  return (
    <View pointerEvents="box-none" style={styles.position}>
      <View style={[styles.notice, { backgroundColor: colors.surface,
        borderColor: colors.border }]}>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]}>
            {queue.pending_count} new chart {queue.pending_count === 1 ? "set" : "sets"} awaiting review
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Admin-only · Review and release before public display.
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button"
            onPress={() => router.push((queue.items[0]?.event_id
              ? chartReviewStoryHref(queue.items[0].event_id)
              : "/beta-dashboard?tab=charts") as never)}
            style={[styles.openButton, { backgroundColor: colors.text }]}>
            <Text style={[styles.openLabel, { color: colors.background }]}>Review</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss chart notification"
            onPress={() => setDismissed({ userId, signature })} style={styles.dismiss}>
            <Text style={[styles.dismissLabel, { color: colors.textMuted }]}>×</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  position: { position: "absolute", bottom: 82, left: 12, right: 12,
    alignItems: "flex-end", zIndex: 100 },
  notice: { borderWidth: 1, borderRadius: 16, padding: 13,
    maxWidth: 450, width: "100%", flexDirection: "row", flexWrap: "wrap",
    alignItems: "center", gap: 12 },
  copy: { flex: 1, minWidth: 170, gap: 4 },
  title: { fontSize: 14, fontWeight: "900" },
  subtitle: { fontSize: 12, lineHeight: 16 },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  openButton: { minHeight: 40, borderRadius: 999, paddingHorizontal: 15,
    justifyContent: "center" },
  openLabel: { fontSize: 12, fontWeight: "900" },
  dismiss: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  dismissLabel: { fontSize: 22 },
});

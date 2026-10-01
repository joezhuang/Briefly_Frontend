import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  followEvent,
  getEventFollowState,
  unfollowEvent,
} from "@/api/event-follow";
import { trackProductEvent } from "@/analytics/product-analytics";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

const copy = {
  en: { follow: "Follow event", actionFollow: "Follow", following: "Following", updates: "Updates", error: "Could not update this event. Please try again." },
  es: { follow: "Seguir evento", actionFollow: "Seguir", following: "Siguiendo", updates: "Actualizaciones", error: "No se pudo actualizar este evento. Inténtalo de nuevo." },
  ja: { follow: "イベントをフォロー", actionFollow: "フォロー", following: "フォロー中", updates: "更新", error: "このイベントを更新できませんでした。もう一度お試しください。" },
  "zh-CN": { follow: "关注事件", actionFollow: "关注", following: "已关注", updates: "更新", error: "无法更新此事件，请重试。" },
  "zh-TW": { follow: "關注事件", actionFollow: "關注", following: "已關注", updates: "更新", error: "無法更新此事件，請再試一次。" },
} as const;

export function EventFollowButton({
  eventId,
  returnTo,
  variant = "event",
}: {
  eventId: string;
  returnTo: string;
  variant?: "event" | "storyAction";
}) {
  const { ready, user } = useBrieflyAuth();
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const text = copy[language] ?? copy.en;
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;

    let active = true;
    getEventFollowState(eventId)
      .then((state) => {
        if (active) setFollowing(state.following);
      })
      .catch(() => {
        if (active) setFollowing(null);
      });

    return () => {
      active = false;
    };
  }, [eventId, ready, user]);

  const onPress = async () => {
    if (!user) {
      router.push(`/sign-in?returnTo=${encodeURIComponent(returnTo)}` as never);
      return;
    }

    if (busy) return;
    const next = following !== true;
    const previous = following;
    setFollowing(next);
    setBusy(true);

    try {
      if (next) {
        await followEvent(eventId);
      } else {
        await unfollowEvent(eventId);
      }
    } catch {
      setFollowing(previous);
      Alert.alert("Briefly", text.error);
      setBusy(false);
      return;
    }

    setBusy(false);
    trackProductEvent(next ? "event_follow" : "event_unfollow", {
      eventId,
      properties: { source: "story" },
    });
  };

  const active = !!user && following === true;
  const isStoryAction = variant === "storyAction";

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active, busy }}
        disabled={!ready || busy}
        onPress={() => void onPress()}
        style={({ pressed }) => [
          styles.button,
          isStoryAction && styles.storyActionButton,
          {
            borderColor: isStoryAction
              ? (active ? colors.text : colors.accent)
              : (active ? colors.text : colors.border),
            backgroundColor: isStoryAction
              ? (active ? colors.text : colors.accent)
              : (active ? colors.text : colors.surface),
            opacity: !ready || busy ? 0.6 : pressed ? 0.7 : 1,
          },
        ]}
      >
        {busy && (
          <ActivityIndicator
            size="small"
            color={isStoryAction || active ? colors.background : colors.text}
          />
        )}
        <Text
          style={[
            styles.label,
            isStoryAction && styles.storyActionLabel,
            { color: isStoryAction || active ? colors.background : colors.text },
          ]}
        >
          {active ? text.following : isStoryAction ? text.actionFollow : text.follow}
        </Text>
      </Pressable>

      {active && !isStoryAction && (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/following" as never)}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[styles.updates, { color: colors.accent }]}>{text.updates}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  button: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
  },
  storyActionButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  storyActionLabel: {
    fontSize: 14,
  },
  updates: {
    fontSize: 12,
    fontWeight: "800",
  },
});

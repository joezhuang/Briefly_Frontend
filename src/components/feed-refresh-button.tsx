import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from "react-native";

import { useBrieflyTheme } from "@/context/theme";

type Props = {
  label: string;
  refreshing: boolean;
  disabled?: boolean;
  onRefresh: () => void;
};

export function FeedRefreshButton({ label, refreshing, disabled = false, onRefresh }: Props) {
  const { colors } = useBrieflyTheme();
  // Native feeds already use RefreshControl; browser and installed PWA need an explicit action.
  if (Platform.OS !== "web") return null;
  const unavailable = disabled || refreshing;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: unavailable, busy: refreshing }}
      disabled={unavailable}
      onPress={onRefresh}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { borderColor: colors.border },
        unavailable && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {refreshing
        ? <ActivityIndicator size="small" color={colors.textMuted} />
        : <Text style={[styles.icon, { color: colors.text }]}>↻</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32, height: 32, flexShrink: 0, borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center", justifyContent: "center",
  },
  icon: { fontSize: 18, lineHeight: 22, fontWeight: "600" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
});

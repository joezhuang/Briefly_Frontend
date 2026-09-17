import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { HomepageFeedScope } from "@/api/briefly";
import { useBrieflyTheme } from "@/context/theme";
import type {
  FeedLocation,
  NewsLocationMode,
} from "@/services/feed-location";

type Props = {
  scope: Exclude<HomepageFeedScope, "top">;
  mode: NewsLocationMode;
  location: FeedLocation | null;
  busy?: boolean;
  error?: string | null;
  onEnableAuto: () => void;
  onSaveManual: (input: { country: string; region: string }) => void;
  onDisable: () => void;
};

export function NewsLocationGate({
  scope,
  mode,
  location,
  busy = false,
  error,
  onEnableAuto,
  onSaveManual,
  onDisable,
}: Props) {
  const { colors } = useBrieflyTheme();
  const [editingManual, setEditingManual] = useState(mode === "manual");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");

  useEffect(() => {
    if (location) {
      setCountry(location.country);
      setRegion(location.region ?? "");
    }
    if (mode === "manual") setEditingManual(true);
    if (mode === "off") setEditingManual(false);
  }, [location, mode]);

  const localName = location?.region || location?.city || "";
  const usable =
    !!location?.country && (scope === "national" || !!localName);
  const locationText = !location
    ? null
    : scope === "national"
      ? location.country
      : [localName, location.country].filter(Boolean).join(" · ");
  const visualMode: NewsLocationMode = editingManual ? "manual" : mode;

  const modeButton = (
    value: NewsLocationMode,
    label: string,
    onPress: () => void,
  ) => {
    const selected = visualMode === value;
    return (
      <Pressable
        key={value}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        disabled={busy}
        onPress={onPress}
        style={({ pressed }) => [
          styles.modeButton,
          {
            borderColor: selected ? colors.text : colors.border,
            backgroundColor: selected ? colors.text : "transparent",
            opacity: pressed || busy ? 0.65 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.modeText,
            { color: selected ? colors.background : colors.text },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.textMuted }]}>NEWS LOCATION</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {scope === "national" ? "National news" : "Local news"}
          </Text>
          {!!locationText && mode !== "off" && !editingManual && (
            <Text style={[styles.current, { color: colors.textMuted }]}>{locationText}</Text>
          )}
        </View>
        {busy && <ActivityIndicator size="small" color={colors.textMuted} />}
      </View>

      <View style={styles.modeRow}>
        {modeButton("auto", "Auto", () => {
          setEditingManual(false);
          onEnableAuto();
        })}
        {modeButton("manual", "Manual", () => {
          if (!location) {
            setCountry("");
            setRegion("");
          } else {
            setCountry(location.country);
            setRegion(location.region ?? "");
          }
          setEditingManual(true);
        })}
        {modeButton("off", "Off", () => {
          setEditingManual(false);
          onDisable();
        })}
      </View>

      {mode === "off" && !editingManual && (
        <Text style={[styles.body, { color: colors.textMuted }]}> 
          National and Local personalization is off. Top news still works normally.
        </Text>
      )}

      {mode === "auto" && !editingManual && (
        <Text style={[styles.body, { color: colors.textMuted }]}> 
          {usable
            ? "Briefly uses your device location for news relevance. Tap Auto again to update your current location."
            : "Tap Auto to allow location access. Briefly will only request device location after you choose this mode."}
        </Text>
      )}

      {editingManual && (
        <View style={styles.manual}>
          <TextInput
            value={country}
            onChangeText={setCountry}
            placeholder="Country, e.g. Canada"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border },
            ]}
          />
          <TextInput
            value={region}
            onChangeText={setRegion}
            placeholder={
              scope === "local"
                ? "State / province / region, e.g. British Columbia"
                : "State / province / region (optional)"
            }
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            disabled={
              busy || !country.trim() || (scope === "local" && !region.trim())
            }
            onPress={() =>
              onSaveManual({ country: country.trim(), region: region.trim() })
            }
            style={({ pressed }) => [
              styles.saveButton,
              {
                backgroundColor: colors.text,
                opacity:
                  pressed ||
                  busy ||
                  !country.trim() ||
                  (scope === "local" && !region.trim())
                    ? 0.55
                    : 1,
              },
            ]}
          >
            <Text style={[styles.saveText, { color: colors.background }]}>Save location</Text>
          </Pressable>
        </View>
      )}

      {mode !== "off" && !editingManual && !usable && (
        <Text style={[styles.notice, { color: colors.textMuted }]}> 
          {scope === "national"
            ? "Set a country before loading National news."
            : "Set a state, province or region before loading Local news."}
        </Text>
      )}

      {!!error && <Text style={[styles.error, { color: colors.textMuted }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    gap: 11,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  title: { fontSize: 18, lineHeight: 23, fontWeight: "900" },
  current: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modeButton: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modeText: { fontSize: 12, fontWeight: "800" },
  body: { fontSize: 13, lineHeight: 19 },
  manual: { gap: 10 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    fontSize: 15,
  },
  saveButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontSize: 13, fontWeight: "800" },
  notice: { fontSize: 12, lineHeight: 18 },
  error: { fontSize: 12, lineHeight: 18 },
});

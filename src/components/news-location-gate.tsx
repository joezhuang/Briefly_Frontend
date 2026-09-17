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
import type { FeedLocation } from "@/services/feed-location";

type Props = {
  scope: Exclude<HomepageFeedScope, "top">;
  location: FeedLocation | null;
  busy?: boolean;
  error?: string | null;
  onUseLocation: () => void;
  onSaveManual: (input: {
    country: string;
    region: string;
  }) => void;
  onChangeLocation: () => void;
};

export function NewsLocationGate({
  scope,
  location,
  busy = false,
  error,
  onUseLocation,
  onSaveManual,
  onChangeLocation,
}: Props) {
  const { colors } = useBrieflyTheme();
  const [manualOpen, setManualOpen] = useState(false);
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");

  useEffect(() => {
    if (!location) return;
    setCountry(location.country);
    setRegion(location.region ?? "");
    setManualOpen(false);
  }, [location]);

  const usable =
    !!location?.country && (scope === "national" || !!location.region);

  if (usable && location) {
    const value =
      scope === "national"
        ? location.country
        : [location.region, location.country].filter(Boolean).join(" · ");

    return (
      <View style={[styles.activeRow, { borderColor: colors.border }]}> 
        <View style={styles.activeCopy}>
          <Text style={[styles.activeLabel, { color: colors.textMuted }]}> 
            {scope === "national" ? "NATIONAL NEWS" : "LOCAL NEWS"}
          </Text>
          <Text style={[styles.activeValue, { color: colors.text }]}>{value}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onChangeLocation}
          style={({ pressed }) => [
            styles.smallButton,
            { borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Text style={[styles.smallButtonText, { color: colors.text }]}>Change</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}> 
        {scope === "national" ? "Set your national news location" : "Set your local news location"}
      </Text>
      <Text style={[styles.body, { color: colors.textMuted }]}> 
        {scope === "national"
          ? "Briefly only uses location after you choose to. Allow location to detect your country, or choose it manually."
          : "Briefly only uses location after you choose to. Allow location to detect your state, province or region, or choose it manually."}
      </Text>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onUseLocation}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.text, opacity: pressed || busy ? 0.7 : 1 },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={[styles.primaryText, { color: colors.background }]}>Use my location</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => setManualOpen((value) => !value)}
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: colors.border, opacity: pressed || busy ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.secondaryText, { color: colors.text }]}>Choose manually</Text>
        </Pressable>
      </View>

      {manualOpen && (
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
            <Text style={[styles.primaryText, { color: colors.background }]}>Save news location</Text>
          </Pressable>
        </View>
      )}

      {!!error && <Text style={[styles.error, { color: colors.textMuted }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    gap: 10,
  },
  title: { fontSize: 20, lineHeight: 25, fontWeight: "900" },
  body: { fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  primaryButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: 14, fontWeight: "800" },
  secondaryText: { fontSize: 14, fontWeight: "800" },
  manual: { gap: 10, marginTop: 4 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    fontSize: 15,
  },
  saveButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { fontSize: 13, lineHeight: 19 },
  activeRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 18,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  activeCopy: { flex: 1, gap: 2 },
  activeLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  activeValue: { fontSize: 15, fontWeight: "800" },
  smallButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  smallButtonText: { fontSize: 12, fontWeight: "800" },
});

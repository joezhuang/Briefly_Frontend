import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  getNewsLocationCountries,
  getNewsLocationRegions,
  type HomepageFeedScope,
  type NewsLocationCountryOption,
  type NewsLocationRegionOption,
} from "@/api/briefly";
import { useBrieflyTheme } from "@/context/theme";
import type {
  FeedLocation,
  NewsLocationMode,
} from "@/services/feed-location";

type ManualInput = {
  country: string;
  countryCode: string | null;
  region: string;
  regionCode: string | null;
};

type Props = {
  scope: Exclude<HomepageFeedScope, "top">;
  mode: NewsLocationMode;
  location: FeedLocation | null;
  busy?: boolean;
  error?: string | null;
  onEnableAuto: () => void;
  onSaveManual: (input: ManualInput) => void;
  onDisable: () => void;
};

type PickerKind = "country" | "region" | null;

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

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
  const [modalOpen, setModalOpen] = useState(false);
  const [manualMode, setManualMode] = useState(mode === "manual");
  const [picker, setPicker] = useState<PickerKind>(null);
  const [search, setSearch] = useState("");
  const [countries, setCountries] = useState<NewsLocationCountryOption[]>([]);
  const [regions, setRegions] = useState<NewsLocationRegionOption[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [country, setCountry] = useState<NewsLocationCountryOption | null>(null);
  const [region, setRegion] = useState<NewsLocationRegionOption | null>(null);

  const localName = location?.region || location?.city || "";
  const usable =
    mode !== "off" &&
    !!location?.country &&
    (scope === "national" || !!localName);

  const compactLocation =
    scope === "national"
      ? location?.country || ""
      : [location?.region || location?.city, location?.country]
          .filter(Boolean)
          .join(" · ");

  const modeLabel = mode === "auto" ? "Auto" : mode === "manual" ? "Manual" : "Off";

  const loadCountries = useCallback(async () => {
    if (countries.length || loadingCountries) return;
    setLoadingCountries(true);
    setOptionsError(null);
    try {
      const result = await getNewsLocationCountries();
      setCountries(result.countries ?? []);
    } catch (err: unknown) {
      setOptionsError(
        err instanceof Error ? err.message : "Unable to load countries.",
      );
    } finally {
      setLoadingCountries(false);
    }
  }, [countries.length, loadingCountries]);

  const loadRegions = useCallback(async (countryCode: string) => {
    setLoadingRegions(true);
    setOptionsError(null);
    try {
      const result = await getNewsLocationRegions(countryCode);
      setRegions(result.regions ?? []);
    } catch (err: unknown) {
      setRegions([]);
      setOptionsError(
        err instanceof Error ? err.message : "Unable to load regions.",
      );
    } finally {
      setLoadingRegions(false);
    }
  }, []);

  const openSettings = useCallback((forceManual = false) => {
    const countryCode = location?.countryCode ?? null;
    const regionCode = location?.regionCode ?? null;
    setCountry(
      location?.country
        ? { code: countryCode ?? "", name: location.country }
        : null,
    );
    setRegion(
      location?.region
        ? {
            code: regionCode ?? "",
            iso_code:
              countryCode && regionCode ? `${countryCode}-${regionCode}` : "",
            name: location.region,
            type: null,
          }
        : null,
    );
    setManualMode(forceManual || mode === "manual");
    setPicker(null);
    setSearch("");
    setOptionsError(null);
    setModalOpen(true);
    void loadCountries();
    if (countryCode) void loadRegions(countryCode);
  }, [loadCountries, loadRegions, location, mode]);

  useEffect(() => {
    if (!modalOpen) return;
    if (manualMode) void loadCountries();
  }, [loadCountries, manualMode, modalOpen]);

  const filteredCountries = useMemo(() => {
    const query = normalize(search);
    return countries
      .filter((item) => {
        if (!query) return true;
        return (
          normalize(item.name).includes(query) ||
          normalize(item.code).includes(query)
        );
      })
      .slice(0, 60);
  }, [countries, search]);

  const filteredRegions = useMemo(() => {
    const query = normalize(search);
    return regions
      .filter((item) => {
        if (!query) return true;
        return (
          normalize(item.name).includes(query) ||
          normalize(item.code).includes(query)
        );
      })
      .slice(0, 80);
  }, [regions, search]);

  const chooseCountry = (item: NewsLocationCountryOption) => {
    setCountry(item);
    setRegion(null);
    setRegions([]);
    setSearch("");
    setPicker(null);
    void loadRegions(item.code);
  };

  const chooseRegion = (item: NewsLocationRegionOption) => {
    setRegion(item);
    setSearch("");
    setPicker(null);
  };

  const saveManual = () => {
    if (!country?.name || !country.code) return;
    if (scope === "local" && !region?.name) return;
    onSaveManual({
      country: country.name,
      countryCode: country.code,
      region: region?.name ?? "",
      regionCode: region?.code ?? null,
    });
    setModalOpen(false);
  };

  const modeButton = (
    value: NewsLocationMode,
    label: string,
    selected: boolean,
    onPress: () => void,
  ) => (
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

  if (usable && !error) {
    return (
      <>
        <View style={[styles.compactBar, { borderColor: colors.border }]}> 
          <Text
            style={[styles.compactLocation, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {compactLocation}
          </Text>
          <View style={styles.compactActions}>
            <Text style={[styles.compactMode, { color: colors.textMuted }]}> 
              {modeLabel}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => openSettings(false)}
              hitSlop={8}
            >
              <Text style={[styles.changeText, { color: colors.accent }]}>Change</Text>
            </Pressable>
          </View>
        </View>
        <LocationModal
          visible={modalOpen}
          scope={scope}
          mode={mode}
          busy={busy}
          manualMode={manualMode}
          setManualMode={setManualMode}
          picker={picker}
          setPicker={setPicker}
          search={search}
          setSearch={setSearch}
          country={country}
          region={region}
          loadingCountries={loadingCountries}
          loadingRegions={loadingRegions}
          filteredCountries={filteredCountries}
          filteredRegions={filteredRegions}
          optionsError={optionsError}
          onChooseCountry={chooseCountry}
          onChooseRegion={chooseRegion}
          onEnableAuto={() => {
            setModalOpen(false);
            onEnableAuto();
          }}
          onDisable={() => {
            setModalOpen(false);
            onDisable();
          }}
          onSaveManual={saveManual}
          onClose={() => setModalOpen(false)}
          modeButton={modeButton}
        />
      </>
    );
  }

  return (
    <>
      <View
        style={[
          styles.setupCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.setupHeader}>
          <View style={styles.setupCopy}>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>NEWS LOCATION</Text>
            <Text style={[styles.title, { color: colors.text }]}> 
              {scope === "national" ? "Set National news location" : "Set Local news location"}
            </Text>
            <Text style={[styles.body, { color: colors.textMuted }]}> 
              {error ||
                "Choose automatic location, select a location manually, or keep location off."}
            </Text>
          </View>
          {busy && <ActivityIndicator size="small" color={colors.textMuted} />}
        </View>

        <View style={styles.modeRow}>
          {modeButton("auto", "Use current location", mode === "auto", onEnableAuto)}
          {modeButton("manual", "Choose manually", mode === "manual", () => openSettings(true))}
          {modeButton("off", "Off", mode === "off", onDisable)}
        </View>
      </View>

      <LocationModal
        visible={modalOpen}
        scope={scope}
        mode={mode}
        busy={busy}
        manualMode={manualMode}
        setManualMode={setManualMode}
        picker={picker}
        setPicker={setPicker}
        search={search}
        setSearch={setSearch}
        country={country}
        region={region}
        loadingCountries={loadingCountries}
        loadingRegions={loadingRegions}
        filteredCountries={filteredCountries}
        filteredRegions={filteredRegions}
        optionsError={optionsError}
        onChooseCountry={chooseCountry}
        onChooseRegion={chooseRegion}
        onEnableAuto={() => {
          setModalOpen(false);
          onEnableAuto();
        }}
        onDisable={() => {
          setModalOpen(false);
          onDisable();
        }}
        onSaveManual={saveManual}
        onClose={() => setModalOpen(false)}
        modeButton={modeButton}
      />
    </>
  );
}

type ModalProps = {
  visible: boolean;
  scope: Exclude<HomepageFeedScope, "top">;
  mode: NewsLocationMode;
  busy: boolean;
  manualMode: boolean;
  setManualMode: (value: boolean) => void;
  picker: PickerKind;
  setPicker: (value: PickerKind) => void;
  search: string;
  setSearch: (value: string) => void;
  country: NewsLocationCountryOption | null;
  region: NewsLocationRegionOption | null;
  loadingCountries: boolean;
  loadingRegions: boolean;
  filteredCountries: NewsLocationCountryOption[];
  filteredRegions: NewsLocationRegionOption[];
  optionsError: string | null;
  onChooseCountry: (item: NewsLocationCountryOption) => void;
  onChooseRegion: (item: NewsLocationRegionOption) => void;
  onEnableAuto: () => void;
  onDisable: () => void;
  onSaveManual: () => void;
  onClose: () => void;
  modeButton: (
    value: NewsLocationMode,
    label: string,
    selected: boolean,
    onPress: () => void,
  ) => ReactNode;
};

function LocationModal({
  visible,
  scope,
  mode,
  busy,
  manualMode,
  setManualMode,
  picker,
  setPicker,
  search,
  setSearch,
  country,
  region,
  loadingCountries,
  loadingRegions,
  filteredCountries,
  filteredRegions,
  optionsError,
  onChooseCountry,
  onChooseRegion,
  onEnableAuto,
  onDisable,
  onSaveManual,
  onClose,
  modeButton,
}: ModalProps) {
  const { colors } = useBrieflyTheme();
  const manualSelected = manualMode || mode === "manual";
  const pickerItems = picker === "country" ? filteredCountries : filteredRegions;
  const pickerLoading = picker === "country" ? loadingCountries : loadingRegions;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.modalCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.textMuted }]}>NEWS LOCATION</Text>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Change location</Text>
            </View>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={onClose}>
              <Text style={[styles.closeText, { color: colors.textMuted }]}>×</Text>
            </Pressable>
          </View>

          <View style={styles.modeRow}>
            {modeButton("auto", "Auto", !manualMode && mode === "auto", onEnableAuto)}
            {modeButton("manual", "Manual", manualSelected, () => {
              setManualMode(true);
              setPicker(null);
              setSearch("");
            })}
            {modeButton("off", "Off", !manualMode && mode === "off", onDisable)}
          </View>

          {manualMode && (
            <View style={styles.manualArea}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>COUNTRY</Text>
              <Pressable
                onPress={() => {
                  setPicker("country");
                  setSearch("");
                }}
                style={[styles.select, { borderColor: colors.border }]}
              >
                <Text style={[styles.selectText, { color: country ? colors.text : colors.textMuted }]}> 
                  {country?.name || "Choose country"}
                </Text>
                <Text style={[styles.chevron, { color: colors.textMuted }]}>⌄</Text>
              </Pressable>

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>REGION</Text>
              <Pressable
                disabled={!country?.code || loadingRegions}
                onPress={() => {
                  setPicker("region");
                  setSearch("");
                }}
                style={[
                  styles.select,
                  { borderColor: colors.border },
                  (!country?.code || loadingRegions) && styles.disabled,
                ]}
              >
                <Text style={[styles.selectText, { color: region ? colors.text : colors.textMuted }]}> 
                  {loadingRegions
                    ? "Loading regions…"
                    : region?.name ||
                      (country?.code ? "Choose state / province / region" : "Choose country first")}
                </Text>
                <Text style={[styles.chevron, { color: colors.textMuted }]}>⌄</Text>
              </Pressable>

              {scope === "national" && (
                <Text style={[styles.helper, { color: colors.textMuted }]}> 
                  Region is optional for National news but will also configure Local news.
                </Text>
              )}

              {!!optionsError && (
                <Text style={[styles.helper, { color: colors.textMuted }]}>{optionsError}</Text>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={
                  busy ||
                  !country?.code ||
                  !country.name ||
                  (scope === "local" && !region?.name)
                }
                onPress={onSaveManual}
                style={({ pressed }) => [
                  styles.saveButton,
                  {
                    backgroundColor: colors.text,
                    opacity:
                      pressed ||
                      busy ||
                      !country?.code ||
                      !country.name ||
                      (scope === "local" && !region?.name)
                        ? 0.5
                        : 1,
                  },
                ]}
              >
                <Text style={[styles.saveText, { color: colors.background }]}>Save location</Text>
              </Pressable>
            </View>
          )}

          {picker && (
            <View style={[styles.pickerPanel, { borderColor: colors.border }]}> 
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: colors.text }]}> 
                  {picker === "country" ? "Choose country" : "Choose region"}
                </Text>
                <Pressable onPress={() => setPicker(null)} hitSlop={8}>
                  <Text style={[styles.pickerDone, { color: colors.accent }]}>Done</Text>
                </Pressable>
              </View>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={picker === "country" ? "Search countries" : "Search regions"}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.searchInput,
                  { color: colors.text, borderColor: colors.border },
                ]}
              />

              {pickerLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={colors.textMuted} />
                </View>
              ) : (
                <ScrollView
                  style={styles.optionList}
                  keyboardShouldPersistTaps="handled"
                >
                  {pickerItems.map((item) => (
                    <Pressable
                      key={`${picker}-${item.code}-${item.name}`}
                      onPress={() => {
                        if (picker === "country") {
                          onChooseCountry(item as NewsLocationCountryOption);
                        } else {
                          onChooseRegion(item as NewsLocationRegionOption);
                        }
                      }}
                      style={({ pressed }) => [
                        styles.optionRow,
                        { borderBottomColor: colors.border },
                        pressed && styles.optionPressed,
                      ]}
                    >
                      <Text style={[styles.optionName, { color: colors.text }]}> 
                        {item.name}
                      </Text>
                      <Text style={[styles.optionCode, { color: colors.textMuted }]}> 
                        {item.code}
                      </Text>
                    </Pressable>
                  ))}
                  {!pickerItems.length && (
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}> 
                      No matching {picker === "country" ? "countries" : "regions"}.
                    </Text>
                  )}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  compactBar: {
    minHeight: 34,
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
  },
  compactLocation: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: "700" },
  compactActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  compactMode: { fontSize: 11, fontWeight: "700" },
  changeText: { fontSize: 12, fontWeight: "800" },
  setupCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    gap: 12,
  },
  setupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  setupCopy: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "900" },
  body: { fontSize: 13, lineHeight: 19 },
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.46)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "88%",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  modalTitle: { marginTop: 2, fontSize: 22, lineHeight: 28, fontWeight: "900" },
  closeText: { fontSize: 28, lineHeight: 30 },
  manualArea: { gap: 8 },
  fieldLabel: { marginTop: 3, fontSize: 10, fontWeight: "900", letterSpacing: 0.9 },
  select: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectText: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "700" },
  chevron: { fontSize: 18 },
  disabled: { opacity: 0.45 },
  helper: { fontSize: 11, lineHeight: 16 },
  saveButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  saveText: { fontSize: 13, fontWeight: "800" },
  pickerPanel: {
    minHeight: 220,
    maxHeight: 390,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 10,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerTitle: { fontSize: 16, fontWeight: "900" },
  pickerDone: { fontSize: 13, fontWeight: "800" },
  searchInput: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  loadingBox: { minHeight: 120, alignItems: "center", justifyContent: "center" },
  optionList: { maxHeight: 280 },
  optionRow: {
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 9,
  },
  optionPressed: { opacity: 0.65 },
  optionName: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "700" },
  optionCode: { fontSize: 11, fontWeight: "800" },
  emptyText: { paddingVertical: 24, textAlign: "center", fontSize: 13 },
});

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
import { useBrieflyLanguage } from "@/context/language";
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

const locationCopy = {
  en: {
    eyebrow: "NEWS LOCATION",
    setNational: "Set National news location",
    setLocal: "Set Local news location",
    setupBody: "Choose automatic location, select a location manually, or keep location off.",
    auto: "Auto",
    manual: "Manual",
    off: "Off",
    useCurrent: "Use current location",
    chooseManually: "Choose manually",
    change: "Change",
    changeLocation: "Change location",
    country: "COUNTRY",
    region: "REGION",
    chooseCountry: "Choose country",
    chooseRegion: "Choose region",
    loadingRegions: "Loading regions…",
    chooseArea: "Choose state / province / region",
    chooseCountryFirst: "Choose country first",
    nationalRegionHelper: "Region is optional for National news but will also configure Local news.",
    saveLocation: "Save location",
    done: "Done",
    searchCountries: "Search countries",
    searchRegions: "Search regions",
    noMatchingCountries: "No matching countries.",
    noMatchingRegions: "No matching regions.",
    unableCountries: "Unable to load countries.",
    unableRegions: "Unable to load regions.",
    permissionError: "Location permission is unavailable or was not granted. Choose Manual or Off, or enable location permission in your device settings.",
    saveError: "Unable to save news location.",
  },
  es: {
    eyebrow: "UBICACIÓN DE NOTICIAS",
    setNational: "Configurar ubicación de noticias nacionales",
    setLocal: "Configurar ubicación de noticias locales",
    setupBody: "Usa la ubicación automática, elige una manualmente o mantén la ubicación desactivada.",
    auto: "Auto",
    manual: "Manual",
    off: "Desactivado",
    useCurrent: "Usar ubicación actual",
    chooseManually: "Elegir manualmente",
    change: "Cambiar",
    changeLocation: "Cambiar ubicación",
    country: "PAÍS",
    region: "REGIÓN",
    chooseCountry: "Elegir país",
    chooseRegion: "Elegir región",
    loadingRegions: "Cargando regiones…",
    chooseArea: "Elegir estado / provincia / región",
    chooseCountryFirst: "Elige primero un país",
    nationalRegionHelper: "La región es opcional para las noticias nacionales, pero también configurará las noticias locales.",
    saveLocation: "Guardar ubicación",
    done: "Listo",
    searchCountries: "Buscar países",
    searchRegions: "Buscar regiones",
    noMatchingCountries: "No hay países coincidentes.",
    noMatchingRegions: "No hay regiones coincidentes.",
    unableCountries: "No se pudieron cargar los países.",
    unableRegions: "No se pudieron cargar las regiones.",
    permissionError: "El permiso de ubicación no está disponible o no fue concedido. Elige Manual o Desactivado, o habilita el permiso de ubicación en los ajustes del dispositivo.",
    saveError: "No se pudo guardar la ubicación de noticias.",
  },
  ja: {
    eyebrow: "ニュース地域",
    setNational: "国内ニュースの地域を設定",
    setLocal: "地域ニュースの場所を設定",
    setupBody: "現在地を自動使用するか、手動で選択するか、位置情報をオフにできます。",
    auto: "自動",
    manual: "手動",
    off: "オフ",
    useCurrent: "現在地を使用",
    chooseManually: "手動で選択",
    change: "変更",
    changeLocation: "地域を変更",
    country: "国",
    region: "地域",
    chooseCountry: "国を選択",
    chooseRegion: "地域を選択",
    loadingRegions: "地域を読み込み中…",
    chooseArea: "州 / 県 / 地域を選択",
    chooseCountryFirst: "先に国を選択してください",
    nationalRegionHelper: "国内ニュースでは地域の選択は任意ですが、地域ニュースにも同じ設定が使われます。",
    saveLocation: "地域を保存",
    done: "完了",
    searchCountries: "国を検索",
    searchRegions: "地域を検索",
    noMatchingCountries: "一致する国がありません。",
    noMatchingRegions: "一致する地域がありません。",
    unableCountries: "国の一覧を読み込めませんでした。",
    unableRegions: "地域の一覧を読み込めませんでした。",
    permissionError: "位置情報の権限を利用できないか、許可されていません。手動またはオフを選ぶか、端末設定で位置情報の権限を有効にしてください。",
    saveError: "ニュース地域を保存できませんでした。",
  },
  "zh-CN": {
    eyebrow: "新闻位置",
    setNational: "设置全国新闻位置",
    setLocal: "设置本地新闻位置",
    setupBody: "可使用自动定位、手动选择位置，或关闭位置功能。",
    auto: "自动",
    manual: "手动",
    off: "关闭",
    useCurrent: "使用当前位置",
    chooseManually: "手动选择",
    change: "更改",
    changeLocation: "更改位置",
    country: "国家",
    region: "地区",
    chooseCountry: "选择国家",
    chooseRegion: "选择地区",
    loadingRegions: "正在加载地区…",
    chooseArea: "选择州 / 省 / 地区",
    chooseCountryFirst: "请先选择国家",
    nationalRegionHelper: "全国新闻可不选择地区；选择后也会同时配置本地新闻。",
    saveLocation: "保存位置",
    done: "完成",
    searchCountries: "搜索国家",
    searchRegions: "搜索地区",
    noMatchingCountries: "没有匹配的国家。",
    noMatchingRegions: "没有匹配的地区。",
    unableCountries: "无法加载国家列表。",
    unableRegions: "无法加载地区列表。",
    permissionError: "位置权限不可用或未获授权。请选择手动或关闭，或在设备设置中启用位置权限。",
    saveError: "无法保存新闻位置。",
  },
  "zh-TW": {
    eyebrow: "新聞位置",
    setNational: "設定全國新聞位置",
    setLocal: "設定本地新聞位置",
    setupBody: "可使用自動定位、手動選擇位置，或關閉位置功能。",
    auto: "自動",
    manual: "手動",
    off: "關閉",
    useCurrent: "使用目前位置",
    chooseManually: "手動選擇",
    change: "更改",
    changeLocation: "更改位置",
    country: "國家",
    region: "地區",
    chooseCountry: "選擇國家",
    chooseRegion: "選擇地區",
    loadingRegions: "正在載入地區…",
    chooseArea: "選擇州 / 省 / 地區",
    chooseCountryFirst: "請先選擇國家",
    nationalRegionHelper: "全國新聞可不選擇地區；選擇後也會同時設定本地新聞。",
    saveLocation: "儲存位置",
    done: "完成",
    searchCountries: "搜尋國家",
    searchRegions: "搜尋地區",
    noMatchingCountries: "沒有符合的國家。",
    noMatchingRegions: "沒有符合的地區。",
    unableCountries: "無法載入國家清單。",
    unableRegions: "無法載入地區清單。",
    permissionError: "位置權限不可用或未獲授權。請選擇手動或關閉，或在裝置設定中啟用位置權限。",
    saveError: "無法儲存新聞位置。",
  },
} as const;

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
  const { language } = useBrieflyLanguage();
  const labels = locationCopy[language] ?? locationCopy.en;
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

  const modeLabel =
    mode === "auto" ? labels.auto : mode === "manual" ? labels.manual : labels.off;
  const displayedError = error?.startsWith("Location permission")
    ? labels.permissionError
    : error === "Unable to save news location."
      ? labels.saveError
      : error;

  const loadCountries = useCallback(async () => {
    if (countries.length || loadingCountries) return;
    setLoadingCountries(true);
    setOptionsError(null);
    try {
      const result = await getNewsLocationCountries();
      setCountries(result.countries ?? []);
    } catch {
      setOptionsError(labels.unableCountries);
    } finally {
      setLoadingCountries(false);
    }
  }, [countries.length, labels.unableCountries, loadingCountries]);

  const loadRegions = useCallback(async (countryCode: string) => {
    setLoadingRegions(true);
    setOptionsError(null);
    try {
      const result = await getNewsLocationRegions(countryCode);
      setRegions(result.regions ?? []);
    } catch {
      setRegions([]);
      setOptionsError(labels.unableRegions);
    } finally {
      setLoadingRegions(false);
    }
  }, [labels.unableRegions]);

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

  if (usable && !displayedError) {
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
              <Text style={[styles.changeText, { color: colors.accent }]}>{labels.change}</Text>
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
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{labels.eyebrow}</Text>
            <Text style={[styles.title, { color: colors.text }]}> 
              {scope === "national" ? labels.setNational : labels.setLocal}
            </Text>
            <Text style={[styles.body, { color: colors.textMuted }]}> 
              {displayedError || labels.setupBody}
            </Text>
          </View>
          {busy && <ActivityIndicator size="small" color={colors.textMuted} />}
        </View>

        <View style={styles.modeRow}>
          {modeButton("auto", labels.useCurrent, mode === "auto", onEnableAuto)}
          {modeButton("manual", labels.chooseManually, mode === "manual", () => openSettings(true))}
          {modeButton("off", labels.off, mode === "off", onDisable)}
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
  const { language } = useBrieflyLanguage();
  const labels = locationCopy[language] ?? locationCopy.en;
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
              <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{labels.eyebrow}</Text>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{labels.changeLocation}</Text>
            </View>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={onClose}>
              <Text style={[styles.closeText, { color: colors.textMuted }]}>×</Text>
            </Pressable>
          </View>

          <View style={styles.modeRow}>
            {modeButton("auto", labels.auto, !manualMode && mode === "auto", onEnableAuto)}
            {modeButton("manual", labels.manual, manualSelected, () => {
              setManualMode(true);
              setPicker(null);
              setSearch("");
            })}
            {modeButton("off", labels.off, !manualMode && mode === "off", onDisable)}
          </View>

          {manualMode && (
            <View style={styles.manualArea}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{labels.country}</Text>
              <Pressable
                onPress={() => {
                  setPicker("country");
                  setSearch("");
                }}
                style={[styles.select, { borderColor: colors.border }]}
              >
                <Text style={[styles.selectText, { color: country ? colors.text : colors.textMuted }]}> 
                  {country?.name || labels.chooseCountry}
                </Text>
                <Text style={[styles.chevron, { color: colors.textMuted }]}>⌄</Text>
              </Pressable>

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{labels.region}</Text>
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
                    ? labels.loadingRegions
                    : region?.name ||
                      (country?.code ? labels.chooseArea : labels.chooseCountryFirst)}
                </Text>
                <Text style={[styles.chevron, { color: colors.textMuted }]}>⌄</Text>
              </Pressable>

              {scope === "national" && (
                <Text style={[styles.helper, { color: colors.textMuted }]}> 
                  {labels.nationalRegionHelper}
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
                <Text style={[styles.saveText, { color: colors.background }]}>{labels.saveLocation}</Text>
              </Pressable>
            </View>
          )}

          {picker && (
            <View style={[styles.pickerPanel, { borderColor: colors.border }]}> 
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: colors.text }]}> 
                  {picker === "country" ? labels.chooseCountry : labels.chooseRegion}
                </Text>
                <Pressable onPress={() => setPicker(null)} hitSlop={8}>
                  <Text style={[styles.pickerDone, { color: colors.accent }]}>{labels.done}</Text>
                </Pressable>
              </View>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={picker === "country" ? labels.searchCountries : labels.searchRegions}
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
                      {picker === "country" ? labels.noMatchingCountries : labels.noMatchingRegions}
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

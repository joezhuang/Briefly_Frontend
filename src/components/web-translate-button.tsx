import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

const READING_LANGUAGE_STORAGE_KEY = "briefly.reading-language.v1";

const READING_LANGUAGES = [
  { code: "ar", label: "Arabic" },
  { code: "bn", label: "Bengali" },
  { code: "bg", label: "Bulgarian" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "zh-TW", label: "Chinese (Traditional)" },
  { code: "hr", label: "Croatian" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "nl", label: "Dutch" },
  { code: "en", label: "English" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "gu", label: "Gujarati" },
  { code: "he", label: "Hebrew" },
  { code: "hi", label: "Hindi" },
  { code: "hu", label: "Hungarian" },
  { code: "id", label: "Indonesian" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "kn", label: "Kannada" },
  { code: "ko", label: "Korean" },
  { code: "ms", label: "Malay" },
  { code: "ml", label: "Malayalam" },
  { code: "mr", label: "Marathi" },
  { code: "no", label: "Norwegian" },
  { code: "fa", label: "Persian" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "pa", label: "Punjabi" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sr", label: "Serbian" },
  { code: "sk", label: "Slovak" },
  { code: "sl", label: "Slovenian" },
  { code: "es", label: "Spanish" },
  { code: "sw", label: "Swahili" },
  { code: "sv", label: "Swedish" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "th", label: "Thai" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "ur", label: "Urdu" },
  { code: "vi", label: "Vietnamese" },
] as const;

type ReadingLanguage = (typeof READING_LANGUAGES)[number]["code"];

const copy = {
  en: {
    title: "Reading language",
    sameAsUi: "Same as interface",
    hint: "Saved on this device. It does not change the Briefly interface.",
    choose: "Choose reading language",
    close: "Close",
    readWithGoogle: (name: string) => `Read in ${name} with Google`,
    sharedHint: (name: string) =>
      `Reading language for this story: ${name}. Your saved preference is unchanged.`,
    englishHint: "Choose another reading language to use Google Translate.",
    localHint: "For local development, use your browser's Translate page option.",
  },
  es: {
    title: "Idioma de lectura",
    sameAsUi: "Igual que la interfaz",
    hint: "Se guarda en este dispositivo y no cambia la interfaz de Briefly.",
    choose: "Elegir idioma de lectura",
    close: "Cerrar",
    readWithGoogle: (name: string) => `Leer en ${name} con Google`,
    sharedHint: (name: string) =>
      `Idioma de lectura de esta historia: ${name}. Tu preferencia guardada no cambia.`,
    englishHint: "Elige otro idioma de lectura para usar Google Translate.",
    localHint: "En desarrollo local, usa la opción Traducir página de tu navegador.",
  },
  ja: {
    title: "読む言語",
    sameAsUi: "インターフェースと同じ",
    hint: "この端末に保存されます。Brieflyの表示言語は変わりません。",
    choose: "読む言語を選択",
    close: "閉じる",
    readWithGoogle: (name: string) => `Googleで${name}で読む`,
    sharedHint: (name: string) =>
      `このストーリーの読む言語: ${name}。保存済みの設定は変更されません。`,
    englishHint: "Google翻訳を使うには別の読む言語を選択してください。",
    localHint: "ローカル開発では、ブラウザの「ページを翻訳」機能を使用してください。",
  },
  "zh-CN": {
    title: "阅读语言",
    sameAsUi: "跟随界面语言",
    hint: "保存在此设备上，不会更改 Briefly 的界面语言。",
    choose: "选择阅读语言",
    close: "关闭",
    readWithGoogle: (name: string) => `使用 Google 阅读${name}`,
    sharedHint: (name: string) =>
      `此报道的阅读语言：${name}。不会更改你已保存的阅读语言。`,
    englishHint: "选择其他阅读语言即可使用 Google 翻译。",
    localHint: "本地开发环境请使用浏览器自带的“翻译此页面”功能。",
  },
  "zh-TW": {
    title: "閱讀語言",
    sameAsUi: "跟隨介面語言",
    hint: "儲存在此裝置上，不會更改 Briefly 的介面語言。",
    choose: "選擇閱讀語言",
    close: "關閉",
    readWithGoogle: (name: string) => `使用 Google 閱讀${name}`,
    sharedHint: (name: string) =>
      `此報導的閱讀語言：${name}。不會更改你已儲存的閱讀語言。`,
    englishHint: "選擇其他閱讀語言即可使用 Google 翻譯。",
    localHint: "本機開發環境請使用瀏覽器內建的「翻譯此頁面」功能。",
  },
} as const;

function isReadingLanguage(value: string | null): value is ReadingLanguage {
  return READING_LANGUAGES.some((item) => item.code === value);
}

function normalizedReadingLanguage(
  value: string | null | undefined,
): ReadingLanguage | null {
  const candidate = value ?? null;
  return isReadingLanguage(candidate) ? candidate : null;
}

function googleTranslateUrl(sourceUrl: string, targetLanguage: string) {
  return (
    "https://translate.google.com/translate" +
    `?sl=auto&tl=${encodeURIComponent(targetLanguage)}` +
    `&u=${encodeURIComponent(sourceUrl)}`
  );
}

function isPrivateWebUrl(sourceUrl: string) {
  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase();

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return true;
    }

    if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) {
      return true;
    }

    const match = hostname.match(/^172\.(\d{1,3})\./);
    if (match) {
      const secondOctet = Number(match[1]);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }

    return hostname.endsWith(".local");
  } catch {
    return true;
  }
}

export function WebTranslateButton({
  sourceUrl,
  contentLanguage,
  initialReadingLanguage,
}: {
  sourceUrl: string;
  contentLanguage?: string | null;
  initialReadingLanguage?: string | null;
}) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const labels = copy[language] ?? copy.en;
  const [savedReadingLanguage, setSavedReadingLanguage] =
    useState<ReadingLanguage | null>(null);
  const [readingLanguageOverride, setReadingLanguageOverride] =
    useState<ReadingLanguage | null | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [showLocalHint, setShowLocalHint] = useState(false);
  const privateUrl = isPrivateWebUrl(sourceUrl);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(READING_LANGUAGE_STORAGE_KEY).then((stored) => {
      if (active && isReadingLanguage(stored)) {
        setSavedReadingLanguage(stored);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const sharedReadingLanguage =
    readingLanguageOverride === undefined
      ? normalizedReadingLanguage(initialReadingLanguage)
      : null;
  const readingLanguage: ReadingLanguage =
    readingLanguageOverride !== undefined
      ? readingLanguageOverride ?? language
      : sharedReadingLanguage ??
        (isReadingLanguage(savedReadingLanguage) ? savedReadingLanguage : language);
  const displayedContentLanguage = String(contentLanguage ?? "en").trim();
  const needsGoogleTranslation =
    readingLanguage !== "en" && readingLanguage !== displayedContentLanguage;

  const selected = useMemo(
    () =>
      READING_LANGUAGES.find((item) => item.code === readingLanguage) ??
      READING_LANGUAGES.find((item) => item.code === "en")!,
    [readingLanguage],
  );

  const selectLanguage = (next: ReadingLanguage | null) => {
    setReadingLanguageOverride(next);
    setSavedReadingLanguage(next);
    setPickerOpen(false);
    setShowLocalHint(false);
    if (next) {
      void AsyncStorage.setItem(READING_LANGUAGE_STORAGE_KEY, next);
    } else {
      void AsyncStorage.removeItem(READING_LANGUAGE_STORAGE_KEY);
    }
  };

  const handlePress = () => {
    if (privateUrl) {
      setShowLocalHint(true);
      return;
    }

    setShowLocalHint(false);
    try {
      const translatedSource = new URL(sourceUrl);
      translatedSource.searchParams.set("read", readingLanguage);
      void Linking.openURL(
        googleTranslateUrl(translatedSource.toString(), readingLanguage),
      );
    } catch {
      void Linking.openURL(googleTranslateUrl(sourceUrl, readingLanguage));
    }
  };

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.headingRow}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.textMuted }]}>
          {labels.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={labels.choose}
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [
            styles.selector,
            {
              borderColor: colors.border,
              backgroundColor: colors.surfaceMuted,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text numberOfLines={1} style={[styles.selectorText, { color: colors.text }]}>
            {selected.label} ▾
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={labels.hint}
          accessibilityState={{ expanded: infoOpen }}
          onPress={() => setInfoOpen((open) => !open)}
          style={[styles.infoButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.infoIcon, { color: colors.textMuted }]}>ⓘ</Text>
        </Pressable>
      </View>
      {infoOpen && (
        <View style={styles.infoDetails}>
          <Text style={[styles.hint, { color: colors.textMuted }]}>{labels.hint}</Text>
          {sharedReadingLanguage ? (
            <Text style={[styles.sharedHint, { color: colors.accent }]}>
              {labels.sharedHint(selected.label)}
            </Text>
          ) : null}
          {!needsGoogleTranslation && (
            <Text style={[styles.englishHint, { color: colors.textMuted }]}>
              {labels.englishHint}
            </Text>
          )}
        </View>
      )}

      {needsGoogleTranslation ? (
        <Pressable
          accessibilityRole={privateUrl ? "button" : "link"}
          accessibilityLabel={labels.readWithGoogle(selected.label)}
          onPress={handlePress}
          style={({ pressed }) => [
            styles.button,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.label, { color: colors.text }]}>
            {labels.readWithGoogle(selected.label)}
            {privateUrl ? "" : " ↗"}
          </Text>
        </Pressable>
      ) : null}

      {showLocalHint && (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {labels.localHint}
        </Text>
      )}

      <Modal
        animationType="fade"
        transparent
        visible={pickerOpen}
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {labels.choose}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPickerOpen(false)}
              >
                <Text style={[styles.close, { color: colors.accent }]}>
                  {labels.close}
                </Text>
              </Pressable>
            </View>
            <ScrollView style={styles.languageList}>
              <Pressable
                accessibilityRole="button"
                onPress={() => selectLanguage(null)}
                style={[
                  styles.languageRow,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.languageName, { color: colors.text }]}>
                  {labels.sameAsUi}
                </Text>
                {savedReadingLanguage === null ? (
                  <Text style={[styles.check, { color: colors.accent }]}>✓</Text>
                ) : null}
              </Pressable>
              {READING_LANGUAGES.map((item) => (
                <Pressable
                  key={item.code}
                  accessibilityRole="button"
                  onPress={() => selectLanguage(item.code)}
                  style={[
                    styles.languageRow,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <Text style={[styles.languageName, { color: colors.text }]}>
                    {item.label}
                  </Text>
                  {savedReadingLanguage === item.code ? (
                    <Text style={[styles.check, { color: colors.accent }]}>✓</Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: 520,
    minWidth: 0,
    alignSelf: "stretch",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 9,
    gap: 5,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  selector: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
  },
  selectorText: {
    fontSize: 13,
    fontWeight: "800",
    flexShrink: 1,
  },
  infoButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  infoIcon: {
    fontSize: 19,
    fontWeight: "700",
  },
  infoDetails: { gap: 4, paddingHorizontal: 3, paddingVertical: 3 },
  button: {
    maxWidth: "100%",
    minWidth: 0,
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    flexShrink: 1,
    textAlign: "center",
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
  },
  sharedHint: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  englishHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    minWidth: 0,
    maxWidth: 520,
    maxHeight: "80%",
    alignSelf: "center",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingBottom: 10,
  },
  modalTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontWeight: "900",
  },
  close: {
    fontSize: 14,
    fontWeight: "800",
  },
  languageList: {
    maxHeight: 520,
  },
  languageRow: {
    minHeight: 46,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  languageName: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
  },
  check: {
    fontSize: 16,
    fontWeight: "900",
  },
});

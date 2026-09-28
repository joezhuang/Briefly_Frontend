import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { trackProductEvent } from "@/analytics/product-analytics";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";
import { shareBrieflyStory } from "@/navigation/platform-share";
import { buildPublicStoryShareUrl } from "@/navigation/story-share";

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
    shareIn: (name: string) => `Share in ${name}`,
    sharedHint: (name: string) =>
      `This story was shared for reading in ${name}. Your saved preference is unchanged.`,
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
    shareIn: (name: string) => `Compartir en ${name}`,
    sharedHint: (name: string) =>
      `Esta historia se compartió para leerla en ${name}. Tu preferencia guardada no cambia.`,
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
    shareIn: (name: string) => `${name}で共有`,
    sharedHint: (name: string) =>
      `このストーリーは${name}で読むために共有されました。保存済みの設定は変更されません。`,
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
    shareIn: (name: string) => `以${name}分享`,
    sharedHint: (name: string) =>
      `此报道以${name}阅读方式分享。不会更改你已保存的阅读语言。`,
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
    shareIn: (name: string) => `以${name}分享`,
    sharedHint: (name: string) =>
      `此報導以${name}閱讀方式分享。不會更改你已儲存的閱讀語言。`,
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
  shareArticle,
  shareHref,
  initialReadingLanguage,
}: {
  sourceUrl: string;
  shareArticle: CanonicalArticle;
  shareHref?: string;
  initialReadingLanguage?: string | null;
}) {
  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const labels = copy[language] ?? copy.en;
  const [savedReadingLanguage, setSavedReadingLanguage] =
    useState<ReadingLanguage | null>(null);
  const [sharedReadingLanguage, setSharedReadingLanguage] =
    useState<ReadingLanguage | null>(
      normalizedReadingLanguage(initialReadingLanguage),
    );
  const [pickerOpen, setPickerOpen] = useState(false);
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

  useEffect(() => {
    setSharedReadingLanguage(
      normalizedReadingLanguage(initialReadingLanguage),
    );
  }, [initialReadingLanguage]);

  const readingLanguage: ReadingLanguage = sharedReadingLanguage ??
    (isReadingLanguage(savedReadingLanguage) ? savedReadingLanguage : language);
  const contentLanguage = String(
    shareArticle.content_language ?? shareArticle.language ?? "en",
  ).trim();
  const needsGoogleTranslation =
    readingLanguage !== "en" && readingLanguage !== contentLanguage;

  const selected = useMemo(
    () =>
      READING_LANGUAGES.find((item) => item.code === readingLanguage) ??
      READING_LANGUAGES.find((item) => item.code === "en")!,
    [readingLanguage],
  );

  const selectLanguage = (next: ReadingLanguage | null) => {
    setSharedReadingLanguage(null);
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
    void Linking.openURL(googleTranslateUrl(sourceUrl, readingLanguage));
  };

  const handleShare = async () => {
    const url = buildPublicStoryShareUrl(
      shareArticle,
      shareHref,
      language,
      readingLanguage,
      "en",
    );
    if (!url) {
      Alert.alert("Briefly", t.shareConfigMissing);
      return;
    }

    const result = await shareBrieflyStory({
      headline: shareArticle.headline,
      url,
    });
    if (result === "copied") {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(t.shareLinkCopied);
      } else {
        Alert.alert("Briefly", t.shareLinkCopied);
      }
    }
    if (result !== "dismissed") {
      trackProductEvent("story_share", {
        eventId: shareArticle.event_id,
        articleVersionId: shareArticle.article_version_id,
        properties: {
          source: "story_reading_language",
          reading_language: readingLanguage,
        },
      });
    }
  };

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>
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
        <Text style={[styles.selectorText, { color: colors.text }]}>
          {selected.label} ▾
        </Text>
      </Pressable>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {labels.hint}
      </Text>
      {sharedReadingLanguage ? (
        <Text style={[styles.sharedHint, { color: colors.accent }]}>
          {labels.sharedHint(selected.label)}
        </Text>
      ) : null}

      {needsGoogleTranslation ? (
        <View style={styles.buttonRow}>
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={labels.shareIn(selected.label)}
            onPress={() => void handleShare()}
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
              {labels.shareIn(selected.label)}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Text style={[styles.englishHint, { color: colors.textMuted }]}>
          {labels.englishHint}
        </Text>
      )}

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
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "900",
  },
  selector: {
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
  },
  selectorText: {
    fontSize: 14,
    fontWeight: "800",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  button: {
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
    fontSize: 15,
  },
  check: {
    fontSize: 16,
    fontWeight: "900",
  },
});

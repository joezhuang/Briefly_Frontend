import { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useEnglishSpeech } from "@/context/english-speech";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

// Text-to-speech is device-provided and free for all readers. The English
// source is passed explicitly, independent of the visible reading/UI language.
const copy = {
  en: { listen: "Listen to English", stop: "Stop English", shortListen: "Listen", shortStop: "Stop", currentListen: "Listen to current language", currentStop: "Stop listening", voice: "English voice", pick: "Choose English voice", xFallback: "Open in browser to listen", xHint: "X's built-in browser does not support this free speech feature reliably. Use the X menu and choose Open in browser, then listen in Safari or Chrome." },
  es: { listen: "Escuchar en inglés", stop: "Detener inglés", shortListen: "Escuchar", shortStop: "Detener", currentListen: "Escuchar el idioma actual", currentStop: "Detener la lectura", voice: "Voz inglesa", pick: "Elegir voz inglesa", xFallback: "Abrir en el navegador para escuchar", xHint: "El navegador integrado de X no admite esta función de voz gratuita de forma fiable. Usa el menú de X y elige Abrir en el navegador." },
  ja: { listen: "英語を聴く", stop: "英語の再生を停止", shortListen: "聴く", shortStop: "停止", currentListen: "表示中の言語を聴く", currentStop: "読み上げを停止", voice: "英語の音声", pick: "英語の音声を選ぶ", xFallback: "ブラウザで開いて聴く", xHint: "Xの内蔵ブラウザでは無料の読み上げ機能が安定して動作しません。Xのメニューからブラウザで開き、SafariまたはChromeで聴いてください。" },
  "zh-CN": { listen: "收听英语", stop: "停止英语朗读", shortListen: "收听", shortStop: "停止", currentListen: "朗读当前语言", currentStop: "停止朗读", voice: "英语音色", pick: "选择英语音色", xFallback: "在浏览器中打开后收听", xHint: "X 内置浏览器无法可靠支持此免费朗读功能。请使用 X 菜单选择“在浏览器中打开”，然后在 Safari 或 Chrome 中收听。" },
  "zh-TW": { listen: "收聽英語", stop: "停止英語朗讀", shortListen: "收聽", shortStop: "停止", currentListen: "朗讀目前語言", currentStop: "停止朗讀", voice: "英語音色", pick: "選擇英語音色", xFallback: "在瀏覽器中開啟後收聽", xHint: "X 內建瀏覽器無法可靠支援此免費朗讀功能。請使用 X 選單選擇「在瀏覽器中開啟」，然後在 Safari 或 Chrome 中收聽。" },
} as const;

function isXInAppBrowser(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  return /TwitterAndroid|Twitter for iPhone/i.test(userAgent);
}

function XBrowserSpeechFallback() {
  const { colors } = useBrieflyTheme();
  const { language } = useBrieflyLanguage();
  const labels = copy[language] ?? copy.en;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={labels.xFallback}
      onPress={() => Alert.alert(labels.xFallback, labels.xHint)}
      style={[
        styles.button,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.symbol, { color: colors.accent }]}>↗</Text>
        <Text style={[styles.label, { color: colors.accent }]}>
          {labels.xFallback}
        </Text>
      </View>
    </Pressable>
  );
}


export function EnglishSpeechButton({
  passageId,
  english,
  compact = false,
}: {
  passageId: string;
  english: string;
  compact?: boolean;
}) {
  const { colors } = useBrieflyTheme();
  const { language } = useBrieflyLanguage();
  const { activePassage, toggle } = useEnglishSpeech();
  const text = String(english || "").trim();
  if (!text) return null;
  if (isXInAppBrowser()) return <XBrowserSpeechFallback />;
  const labels = copy[language] ?? copy.en;
  const playing = activePassage === passageId;
  const actionLabel = playing
    ? (compact ? labels.shortStop : labels.stop)
    : (compact ? labels.shortListen : labels.listen);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? labels.stop : labels.listen}
      accessibilityState={{ selected: playing }}
      onPress={() => toggle(passageId, text, "en-US")}
      style={[styles.button, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <View style={styles.content}>
        <Text style={[styles.symbol, { color: colors.accent }]}>
          {playing ? "■" : "🔊"}
        </Text>
        <Text style={[styles.label, { color: colors.accent }]}>{actionLabel}</Text>
      </View>
    </Pressable>
  );
}

export function LanguageSpeechButton({
  passageId,
  text,
  locale,
  compact = true,
}: {
  passageId: string;
  text: string;
  locale: string;
  compact?: boolean;
}) {
  const { colors } = useBrieflyTheme();
  const { language } = useBrieflyLanguage();
  const { activePassage, toggle } = useEnglishSpeech();
  const speechText = String(text || "").trim();
  if (!speechText) return null;
  if (isXInAppBrowser()) return <XBrowserSpeechFallback />;

  const labels = copy[language] ?? copy.en;
  const playing = activePassage === passageId;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? labels.currentStop : labels.currentListen}
      accessibilityState={{ selected: playing }}
      onPress={() => toggle(passageId, speechText, locale)}
      style={[
        styles.button,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.symbol, { color: colors.accent }]}>
          {playing ? "■" : "🔊"}
        </Text>
        <Text style={[styles.label, { color: colors.accent }]}>
          {playing ? labels.shortStop : labels.shortListen}
        </Text>
      </View>
    </Pressable>
  );
}

/** A lightweight on-device/browser voice chooser: no external TTS provider.
 * Visible only when the platform exposes more than one English voice. */
export function EnglishVoicePicker() {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const { voices, selectedVoice, setVoice } = useEnglishSpeech();
  const [expanded, setExpanded] = useState(false);
  if (isXInAppBrowser() || voices.length < 2) return null;
  const labels = copy[language] ?? copy.en;
  const current = voices.find((voice) => voice.identifier === selectedVoice);
  return (
    <View style={[styles.voicePicker, { borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={labels.pick}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((open) => !open)}
        style={styles.voicePickerTrigger}
      >
        <Text numberOfLines={1} style={[styles.voicePickerTitle, { color: colors.text }]}>
          {labels.voice}: {current?.name ?? voices[0]?.name} {expanded ? "▴" : "▾"}
        </Text>
      </Pressable>
      {expanded && (
        <ScrollView nestedScrollEnabled style={styles.voiceList}>
          {voices.map((voice) => (
            <Pressable
              key={voice.identifier}
              accessibilityRole="button"
              accessibilityLabel={voice.name}
              accessibilityState={{ selected: voice.identifier === selectedVoice }}
              onPress={() => {
                setVoice(voice.identifier);
                setExpanded(false);
              }}
              style={[styles.voiceOption, {
                backgroundColor: voice.identifier === selectedVoice
                  ? colors.surfaceMuted
                  : colors.surface,
              }]}
            >
              <Text style={[styles.voiceOptionText, { color: colors.text }]}>
                {voice.identifier === selectedVoice ? "✓ " : ""}
                {voice.name} ({voice.language})
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    alignSelf: "flex-start",
    justifyContent: "center",
    paddingHorizontal: 11,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: { flexDirection: "row", alignItems: "center", gap: 5 },
  symbol: { fontSize: 14, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "700" },
  voicePicker: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, alignSelf: "flex-start", maxWidth: "100%", marginBottom: 10 },
  voicePickerTrigger: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" },
  voicePickerTitle: { fontSize: 12, fontWeight: "600" },
  voiceList: { maxHeight: 250, minWidth: 220 },
  voiceOption: { minHeight: 44, justifyContent: "center", paddingVertical: 9, paddingHorizontal: 12 },
  voiceOptionText: { fontSize: 12 },

});

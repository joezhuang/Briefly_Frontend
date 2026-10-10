import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useEnglishSpeech } from "@/context/english-speech";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

// Text-to-speech is device-provided and free for all readers. The English
// source is passed explicitly, independent of the visible reading/UI language.
const copy = {
  en: { listen: "Listen to English", stop: "Stop English", shortListen: "Listen", shortStop: "Stop", listenBoth: "Listen to both languages", voice: "English voice", pick: "Choose English voice" },
  es: { listen: "Escuchar en inglés", stop: "Detener inglés", shortListen: "Escuchar", shortStop: "Detener", listenBoth: "Escuchar ambos idiomas", voice: "Voz inglesa", pick: "Elegir voz inglesa" },
  ja: { listen: "英語を聴く", stop: "英語の再生を停止", shortListen: "聴く", shortStop: "停止", listenBoth: "両方の言語を聴く", voice: "英語の音声", pick: "英語の音声を選ぶ" },
  "zh-CN": { listen: "收听英语", stop: "停止英语朗读", shortListen: "收听", shortStop: "停止", listenBoth: "收听双语", voice: "英语音色", pick: "选择英语音色" },
  "zh-TW": { listen: "收聽英語", stop: "停止英語朗讀", shortListen: "收聽", shortStop: "停止", listenBoth: "收聽雙語", voice: "英語音色", pick: "選擇英語音色" },
} as const;

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

export function BilingualSpeechButton({
  passageId,
  translated,
  english,
  translatedLanguage,
  compact = true,
}: {
  passageId: string;
  translated: string;
  english: string;
  translatedLanguage: string;
  compact?: boolean;
}) {
  const { colors } = useBrieflyTheme();
  const { language } = useBrieflyLanguage();
  const { activePassage, toggleSequence } = useEnglishSpeech();
  const translatedText = String(translated || "").trim();
  const englishText = String(english || "").trim();
  if (!translatedText && !englishText) return null;

  const labels = copy[language] ?? copy.en;
  const playing = activePassage === passageId;
  const segments = [
    ...(translatedText
      ? [{ text: translatedText, locale: translatedLanguage }]
      : []),
    ...(englishText ? [{ text: englishText, locale: "en-US" }] : []),
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? labels.stop : labels.listenBoth}
      accessibilityState={{ selected: playing }}
      onPress={() => toggleSequence(passageId, segments)}
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
          {playing
            ? (compact ? labels.shortStop : labels.stop)
            : (compact ? labels.shortListen : labels.listenBoth)}
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
  if (voices.length < 2) return null;
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

import { Pressable, StyleSheet, Text, View } from "react-native";

import { useEnglishSpeech } from "@/context/english-speech";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

// Text-to-speech is device-provided and free for all readers. The English
// source is passed explicitly, independent of the visible reading/UI language.
const copy = {
  en: { listen: "Listen to English", stop: "Stop English", shortListen: "Listen", shortStop: "Stop" },
  es: { listen: "Escuchar en inglés", stop: "Detener inglés", shortListen: "Escuchar", shortStop: "Detener" },
  ja: { listen: "英語を聴く", stop: "英語の再生を停止", shortListen: "聴く", shortStop: "停止" },
  "zh-CN": { listen: "收听英语", stop: "停止英语朗读", shortListen: "收听", shortStop: "停止" },
  "zh-TW": { listen: "收聽英語", stop: "停止英語朗讀", shortListen: "收聽", shortStop: "停止" },
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
});

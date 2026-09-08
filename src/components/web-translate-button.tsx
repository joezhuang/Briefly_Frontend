import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

const copy = {
  en: "Translate this page",
  es: "Traducir esta página",
  ja: "このページを翻訳",
  "zh-CN": "翻译此页面",
  "zh-TW": "翻譯此頁面",
} as const;

function googleTranslateUrl(sourceUrl: string, targetLanguage: string) {
  return (
    "https://translate.google.com/translate" +
    `?sl=en&tl=${encodeURIComponent(targetLanguage)}` +
    `&u=${encodeURIComponent(sourceUrl)}`
  );
}

export function WebTranslateButton({ sourceUrl }: { sourceUrl: string }) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const label = copy[language] ?? copy.en;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface }]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        onPress={() => void Linking.openURL(googleTranslateUrl(sourceUrl, language))}
        style={({ pressed }) => [
          styles.button,
          {
            borderColor: colors.border,
            backgroundColor: colors.surface,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={[styles.label, { color: colors.text }]}>{label} ↗</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 2,
  },
  button: {
    minHeight: 36,
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
  },
});

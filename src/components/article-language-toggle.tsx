import { Pressable, StyleSheet, Text, View } from "react-native";

import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

export type ArticleLanguageMode = "localized" | "original" | "bilingual";

const copy = {
  en: { localized: "Localized", original: "Original English", bilingual: "Bilingual" },
  es: { localized: "Localizado", original: "Inglés original", bilingual: "Bilingüe" },
  ja: { localized: "翻訳版", original: "英語原文", bilingual: "二言語" },
  "zh-CN": { localized: "本地化版本", original: "英文原文", bilingual: "双语" },
  "zh-TW": { localized: "本地化版本", original: "英文原文", bilingual: "雙語" },
} as const;

export function ArticleLanguageToggle({
  mode,
  onChange,
  includeBilingual = false,
}: {
  mode: ArticleLanguageMode;
  onChange: (mode: ArticleLanguageMode) => void;
  includeBilingual?: boolean;
}) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const labels = copy[language] ?? copy.en;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {(["localized", "original", ...(includeBilingual ? ["bilingual"] as const : [])] as ArticleLanguageMode[]).map((item) => {
        const selected = item === mode;
        return (
          <Pressable
            key={item}
            onPress={() => onChange(item)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.option,
              selected && { backgroundColor: colors.text },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? colors.background : colors.textMuted },
              ]}
            >
              {labels[item]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "center",
    flexDirection: "row",
    width: "100%",
    maxWidth: 520,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 2,
    padding: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  option: {
    minHeight: 34,
    paddingHorizontal: 7,
    flex: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 12, fontWeight: "800", textAlign: "center", flexShrink: 1 },
});

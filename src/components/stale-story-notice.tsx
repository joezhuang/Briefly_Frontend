import { router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";

const copy = {
  en: {
    updating: "Newer source coverage exists. Briefly Pro is updating this story…",
    stale: "Newer source coverage exists, but Briefly has not synthesized it into a newer article yet.",
    pro: "Newer source coverage exists. Briefly Pro can rebuild this story with the latest evidence.",
    upgrade: "Upgrade to update this story",
  },
  es: {
    updating: "Hay cobertura más reciente. Briefly Pro está actualizando esta historia…",
    stale: "Hay cobertura más reciente, pero Briefly aún no la ha sintetizado en una nueva versión del artículo.",
    pro: "Hay cobertura más reciente. Briefly Pro puede reconstruir esta historia con la evidencia más reciente.",
    upgrade: "Mejorar para actualizar esta historia",
  },
  ja: {
    updating: "より新しい報道があります。Briefly Pro がこの記事を更新しています…",
    stale: "より新しい報道がありますが、Briefly はまだ新しい記事版に反映していません。",
    pro: "より新しい報道があります。Briefly Pro なら最新の根拠からこの記事を再構成できます。",
    upgrade: "Proでこの記事を更新",
  },
  "zh-CN": {
    updating: "已有更新的来源报道。Briefly Pro 正在更新这篇报道…",
    stale: "已有更新的来源报道，但 Briefly 尚未将其整理成更新的文章版本。",
    pro: "已有更新的来源报道。Briefly Pro 可根据最新证据重新生成这篇报道。",
    upgrade: "升级 Pro 以更新这篇报道",
  },
  "zh-TW": {
    updating: "已有更新的來源報導。Briefly Pro 正在更新這篇報導…",
    stale: "已有更新的來源報導，但 Briefly 尚未將其整理成更新的文章版本。",
    pro: "已有更新的來源報導。Briefly Pro 可根據最新證據重新產生這篇報導。",
    upgrade: "升級 Pro 以更新這篇報導",
  },
} as const;

export function StaleStoryNotice({ article }: { article: CanonicalArticle }) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const labels = copy[language] ?? copy.en;

  if (!article.canonical_stale) return null;

  const processing = article.generation_status === "processing";
  const proRequired = article.generation_status === "pro_required";

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surfaceMuted }]}>
      {processing && <ActivityIndicator size="small" color={colors.accent} />}
      <View style={styles.copy}>
        <Text style={[styles.text, { color: colors.textMuted }]}>
          {processing ? labels.updating : proRequired ? labels.pro : labels.stale}
        </Text>
        {proRequired && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/upgrade")}
            style={({ pressed }) => [
              styles.upgrade,
              { backgroundColor: colors.text, opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <Text style={[styles.upgradeText, { color: colors.background }]}>
              {labels.upgrade}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  copy: { flex: 1, gap: 9 },
  text: { fontSize: 13, lineHeight: 19 },
  upgrade: {
    alignSelf: "flex-start",
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeText: { fontSize: 12, fontWeight: "800" },
});

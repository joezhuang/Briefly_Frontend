import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import type { CanonicalArticle } from "@/models/article";

const copy = {
  en: {
    updating: "Newer source coverage is available. Briefly Pro is generating an updated version…",
    pro: "Newer source coverage is available. Open the timeline to review the latest developments or generate an updated Briefly version.",
    free: "Newer source coverage is available. Open the timeline to review the latest developments. Briefly Pro can generate an updated article from the newest evidence.",
  },
  es: {
    updating: "Hay cobertura más reciente. Briefly Pro está generando una versión actualizada…",
    pro: "Hay cobertura más reciente. Abre la cronología para revisar las últimas novedades o generar una versión actualizada de Briefly.",
    free: "Hay cobertura más reciente. Abre la cronología para revisar las últimas novedades. Briefly Pro puede generar un artículo actualizado con la evidencia más reciente.",
  },
  ja: {
    updating: "より新しい報道があります。Briefly Pro が更新版を生成しています…",
    pro: "より新しい報道があります。タイムラインで最新の動きを確認するか、Briefly の更新版を生成できます。",
    free: "より新しい報道があります。タイムラインで最新の動きを確認できます。Briefly Pro なら最新の根拠から更新版の記事を生成できます。",
  },
  "zh-CN": {
    updating: "已有更新的来源报道。Briefly Pro 正在生成更新版本…",
    pro: "已有更新的来源报道。打开时间线可查看最新进展，或生成更新后的 Briefly 版本。",
    free: "已有更新的来源报道。打开时间线可查看最新进展。Briefly Pro 可根据最新证据生成更新后的文章。",
  },
  "zh-TW": {
    updating: "已有更新的來源報導。Briefly Pro 正在產生更新版本…",
    pro: "已有更新的來源報導。開啟時間線可查看最新進展，或產生更新後的 Briefly 版本。",
    free: "已有更新的來源報導。開啟時間線可查看最新進展。Briefly Pro 可根據最新證據產生更新後的文章。",
  },
} as const;

export function StaleStoryNotice({ article }: { article: CanonicalArticle }) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const labels = copy[language] ?? copy.en;

  if (!article.canonical_stale) return null;

  const processing = article.generation_status === "processing";
  const canRefresh = article.stale_refresh_entitled === true;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surfaceMuted }]}>
      {processing && <ActivityIndicator size="small" color={colors.accent} />}
      <Text style={[styles.text, { color: colors.textMuted }]}>
        {processing ? labels.updating : canRefresh ? labels.pro : labels.free}
      </Text>
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
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});

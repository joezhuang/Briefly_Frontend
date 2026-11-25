import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { VerifiedDataChart } from "@/api/briefly";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import { shareBrieflyText } from "@/navigation/platform-share";
import { formatChartText, type ChartTextFormat, type ChartTextLabels } from "@/services/chart-text-export";

const strings = {
  en: { open:"Share published charts as text", all:"All charts", one:"Choose a chart", plain:"Plain text", markdown:"Markdown", share:"Share text", copy:"Copy text", copied:"Copied", close:"Close", hint:"Select the text to copy manually if needed.", error:"Unable to share or copy. Select the text to copy manually.", item:"Item", value:"Value", start:"Start", increase:"Increase", decrease:"Decrease", end:"End" },
  es: { open:"Compartir gráficos publicados como texto", all:"Todos los gráficos", one:"Elegir gráfico", plain:"Texto plano", markdown:"Markdown", share:"Compartir texto", copy:"Copiar texto", copied:"Copiado", close:"Cerrar", hint:"Selecciona el texto para copiarlo manualmente.", error:"No se pudo compartir o copiar. Selecciona el texto.", item:"Elemento", value:"Valor", start:"Inicio", increase:"Aumento", decrease:"Disminución", end:"Fin" },
  ja: { open:"公開グラフをテキストで共有", all:"すべてのグラフ", one:"グラフを選択", plain:"プレーンテキスト", markdown:"Markdown", share:"テキストを共有", copy:"コピー", copied:"コピーしました", close:"閉じる", hint:"必要に応じてテキストを選択してコピーできます。", error:"共有またはコピーできませんでした。テキストを選択してください。", item:"項目", value:"数値", start:"開始", increase:"増加", decrease:"減少", end:"終了" },
  "zh-CN": { open:"以文本分享已发布图表", all:"全部图表", one:"选择图表", plain:"纯文本", markdown:"Markdown", share:"分享文本", copy:"复制文本", copied:"已复制", close:"关闭", hint:"如有需要，可选择文本手动复制。", error:"无法分享或复制，请选择文本手动复制。", item:"项目", value:"数值", start:"起始", increase:"增加", decrease:"减少", end:"结束" },
  "zh-TW": { open:"以文字分享已發布圖表", all:"全部圖表", one:"選擇圖表", plain:"純文字", markdown:"Markdown", share:"分享文字", copy:"複製文字", copied:"已複製", close:"關閉", hint:"如有需要，可選取文字手動複製。", error:"無法分享或複製，請選取文字手動複製。", item:"項目", value:"數值", start:"起始", increase:"增加", decrease:"減少", end:"結束" },
} as const;

export function ChartTextExport({ charts, headline, labels }: {
  charts: VerifiedDataChart[]; headline: string;
  labels: Pick<ChartTextLabels, "forecast" | "proposal" | "target" | "partial" | "derived">;
}) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const copy = strings[language] ?? strings.en;
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ChartTextFormat>("plain");
  const [selection, setSelection] = useState<number | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{text: string; result: string} | null>(null);
  const chosen = selection === null ? charts : charts.slice(selection, selection + 1);
  const text = formatChartText(chosen, { format, headline, labels: { ...copy, ...labels } });
  const run = async (action: "share" | "copy") => {
    if (busy || !chosen.length) return;
    setBusy(true);
    setFeedback(null);
    try {
      if (action === "copy") {
        if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(text);
        setFeedback({ text, result: copy.copied });
      } else {
        const result = await shareBrieflyText(headline, text);
        if (result === "copied") setFeedback({ text, result: copy.copied });
      }
    } catch {
      setFeedback({ text, result: copy.error });
    } finally {
      setBusy(false);
    }
  };
  const pill = (label: string, action: () => void, selected = false) => (
    <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected }}
      onPress={action} disabled={busy}
      style={[styles.pill, { borderColor: colors.border }, selected && { backgroundColor: colors.text }]}>
      <Text style={[styles.label, { color: selected ? colors.background : colors.text }]}>{label}</Text>
    </Pressable>
  );
  if (!charts.length) return null;
  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
        onPress={() => setOpen(value => !value)} style={styles.trigger}>
        <Text style={[styles.label, { color: colors.accent }]}>{copy.open} {open ? "−" : "+"}</Text>
      </Pressable>
      {open && (
        <View style={[styles.panel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.row}>
            {pill(copy.all, () => { setSelection(null); setChoosing(false); }, selection === null)}
            {pill(selection === null ? copy.one : charts[selection]?.title ?? copy.one, () => setChoosing(value => !value), selection !== null)}
          </View>
          {choosing && <ScrollView style={styles.options} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {charts.map((chart, index) => <Pressable key={index} accessibilityRole="button"
              accessibilityState={{ selected: index === selection }}
              onPress={() => { setSelection(index); setChoosing(false); }}
              style={styles.option}>
              <Text style={[styles.label, { color: index === selection ? colors.accent : colors.text }]}>{chart.title}</Text>
            </Pressable>)}
          </ScrollView>}
          <View style={styles.row}>
            {pill(copy.plain, () => setFormat("plain"), format === "plain")}
            {pill(copy.markdown, () => setFormat("markdown"), format === "markdown")}
          </View>
          <ScrollView style={styles.preview} nestedScrollEnabled>
            <Text selectable style={[styles.previewText, { color: colors.text }]}>{text}</Text>
          </ScrollView>
          <View style={styles.row}>
            {pill(copy.share, () => void run("share"), true)}
            {Platform.OS === "web" && pill(copy.copy, () => void run("copy"))}
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]} accessibilityLiveRegion="polite">
            {feedback?.text === text ? feedback.result : copy.hint}
          </Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container:{ gap:6 },
  trigger:{ minHeight:44, justifyContent:"center", alignSelf:"flex-start" },
  panel:{ borderWidth:StyleSheet.hairlineWidth, borderRadius:12, padding:12, gap:10 },
  row:{ flexDirection:"row", flexWrap:"wrap", gap:8 },
  pill:{ borderWidth:StyleSheet.hairlineWidth, borderRadius:999, paddingHorizontal:12, minHeight:44, justifyContent:"center", maxWidth:"100%" },
  label:{ fontSize:13, fontWeight:"700" },
  options:{ maxHeight:180 },
  option:{ minHeight:44, justifyContent:"center", paddingVertical:6 },
  preview:{ maxHeight:300 },
  previewText:{ fontSize:13, lineHeight:20 },
  hint:{ fontSize:12, lineHeight:17 },
});

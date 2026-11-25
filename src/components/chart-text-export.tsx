import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { VerifiedDataChart } from "@/api/briefly";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import { shareBrieflyText } from "@/navigation/platform-share";
import { formatChartText, selectedExportCharts, toggleExportChart, type ChartExportSelection, type ChartTextFormat, type ChartTextLabels } from "@/services/chart-text-export";

const strings = {
  en: { pick:"Select charts", clear:"Clear all", selected:"selected", empty:"Select at least one chart.", simple:"Simple", references:"With references", sources:"Sources", open:"Share published charts as text", all:"All charts", plain:"Plain text", markdown:"Markdown", share:"Share text", copy:"Copy text", copied:"Copied", close:"Close", hint:"Select the text to copy manually if needed.", error:"Unable to share or copy. Select the text to copy manually.", item:"Item", value:"Value", start:"Start", increase:"Increase", decrease:"Decrease", end:"End" },
  es: { pick:"Seleccionar gráficos", clear:"Quitar selección", selected:"seleccionados", empty:"Selecciona al menos un gráfico.", simple:"Simple", references:"Con referencias", sources:"Fuentes", open:"Compartir gráficos publicados como texto", all:"Todos los gráficos", plain:"Texto plano", markdown:"Markdown", share:"Compartir texto", copy:"Copiar texto", copied:"Copiado", close:"Cerrar", hint:"Selecciona el texto para copiarlo manualmente.", error:"No se pudo compartir o copiar. Selecciona el texto.", item:"Elemento", value:"Valor", start:"Inicio", increase:"Aumento", decrease:"Disminución", end:"Fin" },
  ja: { pick:"グラフを選択", clear:"すべて解除", selected:"選択済み", empty:"グラフを1つ以上選択してください。", simple:"シンプル", references:"出典付き", sources:"出典", open:"公開グラフをテキストで共有", all:"すべてのグラフ", plain:"プレーンテキスト", markdown:"Markdown", share:"テキストを共有", copy:"コピー", copied:"コピーしました", close:"閉じる", hint:"必要に応じてテキストを選択してコピーできます。", error:"共有またはコピーできませんでした。テキストを選択してください。", item:"項目", value:"数値", start:"開始", increase:"増加", decrease:"減少", end:"終了" },
  "zh-CN": { pick:"选择图表", clear:"取消全选", selected:"已选", empty:"请至少选择一个图表。", simple:"简洁版", references:"附参考来源", sources:"来源", open:"以文本分享已发布图表", all:"全部图表", plain:"纯文本", markdown:"Markdown", share:"分享文本", copy:"复制文本", copied:"已复制", close:"关闭", hint:"如有需要，可选择文本手动复制。", error:"无法分享或复制，请选择文本手动复制。", item:"项目", value:"数值", start:"起始", increase:"增加", decrease:"减少", end:"结束" },
  "zh-TW": { pick:"選擇圖表", clear:"取消全選", selected:"已選", empty:"請至少選擇一個圖表。", simple:"簡潔版", references:"附參考來源", sources:"來源", open:"以文字分享已發布圖表", all:"全部圖表", plain:"純文字", markdown:"Markdown", share:"分享文字", copy:"複製文字", copied:"已複製", close:"關閉", hint:"如有需要，可選取文字手動複製。", error:"無法分享或複製，請選取文字手動複製。", item:"項目", value:"數值", start:"起始", increase:"增加", decrease:"減少", end:"結束" },
} as const;

export function ChartTextExport({ charts, headline, storyUrl, labels }: {
  charts: VerifiedDataChart[]; headline: string; storyUrl: string | null;
  labels: Pick<ChartTextLabels, "source" | "forecast" | "proposal" | "target" | "partial" | "derived">;
}) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const copy = strings[language] ?? strings.en;
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ChartTextFormat>("plain");
  const [includeReferences, setIncludeReferences] = useState(false);
  const [selection, setSelection] = useState<ChartExportSelection>(null);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{text: string; result: string} | null>(null);
  const chosen = selectedExportCharts(charts, selection);
  const allSelected = chosen.length === charts.length;
  const text = chosen.length ? formatChartText(chosen, { format, headline, storyUrl, includeReferences, labels: { ...copy, ...labels } }) : "";
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
  const pill = (label: string, action: () => void, selected = false, disabled = false) => (
    <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected, disabled: busy || disabled }}
      onPress={action} disabled={busy || disabled}
      style={[styles.pill, { borderColor: colors.border }, selected && { backgroundColor: colors.text }, (busy || disabled) && styles.disabled]}>
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
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: choosing, disabled: busy }}
            disabled={busy} onPress={() => setChoosing(value => !value)} style={styles.selectionTrigger}>
            <Text style={[styles.label, { color: colors.text }]}>{copy.pick} · {allSelected ? copy.all : copy.selected + " " + chosen.length + "/" + charts.length}</Text>
            <Text style={[styles.label, { color: colors.accent }]}>{choosing ? "−" : "+"}</Text>
          </Pressable>
          {choosing && (
            <View style={styles.selectionPanel}>
              <View style={styles.row}>
                {pill(copy.all, () => setSelection(null), allSelected, allSelected)}
                {pill(copy.clear, () => setSelection([]), false, !chosen.length)}
              </View>
              <ScrollView style={styles.options} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {charts.map((chart, index) => {
                  const checked = selection === null || selection.includes(index);
                  return <Pressable key={index} accessibilityRole="checkbox"
                    accessibilityState={{ checked, disabled: busy }} disabled={busy}
                    onPress={() => setSelection(current => toggleExportChart(current, index, charts.length))}
                    style={styles.option}>
                    <View style={[styles.checkbox, { borderColor: checked ? colors.accent : colors.border },
                      checked && { backgroundColor: colors.accent }]}>
                      {checked && <Text style={[styles.checkmark, { color: colors.surface }]}>✓</Text>}
                    </View>
                    <Text style={[styles.label, styles.optionLabel, { color: colors.text }]}>{chart.title}</Text>
                  </Pressable>;
                })}
              </ScrollView>
              {pill(copy.close, () => setChoosing(false))}
            </View>
          )}
          <View style={styles.row}>
            {pill(copy.plain, () => setFormat("plain"), format === "plain")}
            {pill(copy.markdown, () => setFormat("markdown"), format === "markdown")}
          </View>
          <View style={styles.row}>
            {pill(copy.simple, () => setIncludeReferences(false), !includeReferences)}
            {pill(copy.references, () => setIncludeReferences(true), includeReferences)}
          </View>
          <ScrollView style={styles.preview} nestedScrollEnabled>
            <Text selectable style={[styles.previewText, { color: chosen.length ? colors.text : colors.textMuted }]}>{chosen.length ? text : copy.empty}</Text>
          </ScrollView>
          <View style={styles.row}>
            {pill(copy.share, () => void run("share"), true, !chosen.length)}
            {Platform.OS === "web" && pill(copy.copy, () => void run("copy"), false, !chosen.length)}
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
  disabled:{ opacity:0.45 },
  selectionTrigger:{ minHeight:44, flexDirection:"row", alignItems:"center", justifyContent:"space-between", gap:8 },
  selectionPanel:{ gap:8 },
  options:{ maxHeight:240 },
  option:{ minHeight:44, flexDirection:"row", alignItems:"center", gap:10, paddingVertical:6 },
  optionLabel:{ flex:1 },
  checkbox:{ width:22, height:22, borderWidth:1, borderRadius:5, alignItems:"center", justifyContent:"center" },
  checkmark:{ fontSize:15, fontWeight:"800" },
  preview:{ maxHeight:300 },
  previewText:{ fontSize:13, lineHeight:20 },
  hint:{ fontSize:12, lineHeight:17 },
});

import { useEffect, useState } from "react";
import { useBrieflyAppConfig } from "@/context/app-config";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getClusterDataCharts,
  requestClusterDataCharts,
  type ClusterDataChartStatus,
  type VerifiedDataChart,
} from "@/api/briefly";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

const chartCopy = {
  en: {
    title: "Explore the data",
    details: "Source-verified figures from this news event",
    generate: "Extract charts",
    processing: "Checking original reports for comparable data…",
    insufficient: "These reports do not contain enough verified, comparable figures to chart.",
    retry: "Try extraction again",
    source: "Source",
    evidence: "Reported evidence",
    showSources: "View sources and numerical evidence",
    hideSources: "Hide source evidence",
    error: "Chart availability could not be checked. Confirm the updated backend and chart database migration are running, then retry.",
    checking: "Checking chart availability…",
    access: "The server has not enabled chart generation for this account. Check your signed-in role and the dashboard setting.",
    refresh: "Check again",
  },
  es: {
    title: "Explorar los datos",
    details: "Cifras verificadas en las fuentes de esta noticia",
    generate: "Extraer gráficos",
    processing: "Comprobando los datos en las fuentes originales…",
    insufficient: "No hay suficientes cifras comparables y verificadas para crear un gráfico.",
    retry: "Volver a intentar",
    source: "Fuente",
    evidence: "Datos reportados",
    showSources: "Ver fuentes y cifras",
    hideSources: "Ocultar fuentes",
    error: "No se pudo comprobar la disponibilidad. Comprueba el servidor y la migración de datos, y vuelve a intentarlo.",
    checking: "Comprobando disponibilidad…",
    access: "El servidor no ha habilitado la generación para esta cuenta. Comprueba los permisos y los ajustes.",
    refresh: "Comprobar de nuevo",
  },
  ja: {
    title: "データを詳しく見る",
    details: "報道元で確認された数値",
    generate: "グラフを作成",
    processing: "元記事の比較可能な数値を確認中…",
    insufficient: "検証済みの比較可能な数値が十分にありません。",
    retry: "再試行",
    source: "出典",
    evidence: "出典の記述",
    showSources: "出典と数値の根拠を見る",
    hideSources: "出典を閉じる",
    error: "グラフ機能を確認できません。バックエンドの更新とデータベース移行を確認してから再試行してください。",
    checking: "グラフ機能を確認中…",
    access: "サーバー側でこのアカウントの生成権限が確認できません。管理設定とログイン状態をご確認ください。",
    refresh: "もう一度確認",
  },
  "zh-CN": {
    title: "探索数据",
    details: "来自原始报道并经过核验的数值",
    generate: "提取图表",
    processing: "正在核对原始报道中的可比较数据…",
    insufficient: "报道中没有足够经过核验的可比较数据。",
    retry: "重新尝试",
    source: "来源",
    evidence: "原文依据",
    showSources: "查看来源和数值依据",
    hideSources: "收起来源依据",
    error: "无法检查图表功能。请确认后端已更新且完成数据库迁移，然后重试。",
    checking: "正在检查图表功能…",
    access: "服务器尚未授予此账户图表生成权限。请检查登录身份与后台设置。",
    refresh: "重新检查",
  },
  "zh-TW": {
    title: "探索數據",
    details: "來自原始報導並經過核實的數值",
    generate: "擷取圖表",
    processing: "正在核對原始報導中的可比較數據…",
    insufficient: "報導中沒有足夠經核實的可比較數據。",
    retry: "重新嘗試",
    source: "來源",
    evidence: "原文依據",
    showSources: "查看來源與數值依據",
    hideSources: "收起來源依據",
    error: "無法檢查圖表功能。請確認後端已更新且完成資料庫遷移，然後重試。",
    checking: "正在檢查圖表功能…",
    access: "伺服器尚未授予此帳戶圖表產生權限。請檢查登入身分與後台設定。",
    refresh: "重新檢查",
  },
} as const;

function ChartBars({ chart, evidenceLabel, sourceLabel, showSourcesLabel, hideSourcesLabel }: {
  chart: VerifiedDataChart;
  evidenceLabel: string;
  sourceLabel: string;
  showSourcesLabel: string;
  hideSourcesLabel: string;
}) {
  const { colors } = useBrieflyTheme();
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const max = Math.max(1, ...chart.points.map((point) => Math.max(0, point.value)));
  return (
    <View style={styles.chart}>
      <Text style={[styles.chartTitle, { color: colors.text }]}>{chart.title}</Text>
      <Text style={[styles.unit, { color: colors.textMuted }]}>{chart.unit}</Text>
      {chart.points.map((point, index) => {
        const width = Math.max(0, Math.min(100, point.value / max * 100));
        return (
          <View key={`${point.label}-${index}`} style={styles.barItem}>
            <View style={styles.barHeading}>
              <Text style={[styles.barLabel, { color: colors.text }]}>{point.label}</Text>
              <Text style={[styles.barValue, { color: colors.text }]}>
                {Number(point.value).toLocaleString()}
              </Text>
            </View>
            <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.barFill, {
                backgroundColor: colors.accent,
                width: `${width}%` as `${number}%`,
              }]} />
            </View>
          </View>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: sourcesExpanded }}
        onPress={() => setSourcesExpanded((open) => !open)}
        style={styles.sourceDisclosure}
      >
        <Text style={[styles.source, { color: colors.accent }]}>
          {sourcesExpanded ? hideSourcesLabel : showSourcesLabel}
          {sourcesExpanded ? " −" : " +"}
        </Text>
      </Pressable>
      {sourcesExpanded && chart.points.map((point, index) => {
        const sourceUrl = /^https?:\/\//i.test(point.source_url) ? point.source_url : null;
        return (
          <View key={`${point.label}-source-${index}`} style={styles.sourceDetails}>
            {sourceUrl ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${sourceLabel}: ${point.source}`}
                onPress={() => void Linking.openURL(sourceUrl)}
              >
                <Text style={[styles.source, { color: colors.accent }]}>
                  {point.label} · {sourceLabel}: {point.source} ↗
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.source, { color: colors.textMuted }]}>
                {point.label} · {sourceLabel}: {point.source}
              </Text>
            )}
            <Text
              style={[styles.evidence, { color: colors.textMuted }]}
              accessibilityLabel={`${evidenceLabel}: ${point.evidence_quote}`}
            >
              “{point.evidence_quote}”
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function ClusterDataCharts({ eventId, articleVersionId }: {
  eventId: string;
  articleVersionId: number | null;
}) {
  const { user, account } = useBrieflyAuth();
  const { config } = useBrieflyAppConfig();
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const copy = chartCopy[language] ?? chartCopy.en;
  const [status, setStatus] = useState<ClusterDataChartStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // Public cached results are fetched even for signed-out users. Only the
  // backend decides whether the current authenticated reader may generate.
  useEffect(() => {
    let active = true;
    setStatus(null);
    setError(false);
    if (!eventId || !articleVersionId) return () => { active = false; };
    void getClusterDataCharts(eventId)
      .then((next) => { if (active) setStatus(next); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [eventId, articleVersionId, user?.id, account?.translation_entitled, account?.is_admin]);

  useEffect(() => {
    if (status?.status !== "processing" || !eventId) return;
    let active = true;
    const id = setInterval(() => {
      void getClusterDataCharts(eventId)
        .then((next) => { if (active) setStatus(next); })
        .catch(() => {});
    }, 5000);
    return () => { active = false; clearInterval(id); };
  }, [eventId, status?.status]);

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const next = await requestClusterDataCharts(eventId);
      setStatus(next);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const retryStatus = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      setStatus(await getClusterDataCharts(eventId));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const readyCharts =
    status?.status === "ready" && Array.isArray(status.charts)
      ? status.charts
      : [];
  const canGenerate = status?.can_generate === true;
  // Keep an eligible reader's entry point visible when the backend fails.
  // The API remains authoritative: only can_generate=true offers extraction.
  const privilegedViewer = account?.is_admin === true ||
    (Boolean(user) && account?.translation_entitled === true &&
      config?.data_charts_access_mode === "admin_and_pro");

  if (!readyCharts.length && !privilegedViewer && !canGenerate
      && status?.status !== "processing" && status?.status !== "insufficient") {
    return null;
  }
  return (
    <View style={[styles.panel, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
      <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
      <Text style={[styles.detail, { color: colors.textMuted }]}>{copy.details}</Text>
      {readyCharts.map((chart, index) => (
        <ChartBars key={`${chart.title}-${index}`} chart={chart}
          evidenceLabel={copy.evidence} sourceLabel={copy.source}
          showSourcesLabel={copy.showSources} hideSourcesLabel={copy.hideSources} />
      ))}
      {status?.status === "processing" && (
        <View style={styles.progress}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.progressText, { color: colors.textMuted }]}>{copy.processing}</Text>
        </View>
      )}
      {status?.status === "insufficient" && (
        <Text style={[styles.detail, { color: colors.textMuted }]}>{copy.insufficient}</Text>
      )}
      {privilegedViewer && !status && !error && (
        <View style={styles.progress}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.progressText, { color: colors.textMuted }]}>{copy.checking}</Text>
        </View>
      )}
      {privilegedViewer && error && (
        <Text style={[styles.detail, { color: colors.textMuted }]}>{copy.error}</Text>
      )}
      {privilegedViewer && !error && status?.status === "not_generated" && !canGenerate && (
        <Text style={[styles.detail, { color: colors.textMuted }]}>{copy.access}</Text>
      )}
      {privilegedViewer && (error || (status?.status === "not_generated" && !canGenerate)) && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void retryStatus()}
          style={[styles.generateButton, { backgroundColor: colors.text, opacity: busy ? 0.55 : 1 }]}
        >
          {busy && <ActivityIndicator size="small" color={colors.background} />}
          <Text style={[styles.generateText, { color: colors.background }]}>{copy.refresh}</Text>
        </Pressable>
      )}
      {canGenerate && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={status?.status === "failed" ? copy.retry : copy.generate}
          disabled={busy}
          onPress={() => void generate()}
          style={[styles.generateButton, {
            backgroundColor: colors.text,
            opacity: busy ? 0.55 : 1,
          }]}
        >
          {busy && <ActivityIndicator size="small" color={colors.background} />}
          <Text style={[styles.generateText, { color: colors.background }]}>
            {status?.status === "failed" ? copy.retry : copy.generate}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 24, padding: 18, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  title: { fontSize: 22, fontWeight: "900" },
  detail: { fontSize: 13, lineHeight: 20 },
  chart: { gap: 9, paddingTop: 14, borderTopWidth: 0 },
  chartTitle: { fontSize: 17, fontWeight: "800" },
  unit: { fontSize: 12, lineHeight: 18 },
  barItem: { gap: 6, marginVertical: 5 },
  barHeading: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
  barLabel: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: "700" },
  barValue: { fontSize: 13, fontWeight: "900" },
  barTrack: { width: "100%", height: 11, borderRadius: 7, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 7 },
  sourceDisclosure: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", marginTop: 4 },
  sourceDetails: { gap: 4, paddingVertical: 6 },
  source: { fontSize: 12, fontWeight: "700", lineHeight: 17 },
  evidence: { fontSize: 12, lineHeight: 18 },
  progress: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressText: { fontSize: 13, flex: 1 },
  generateButton: { alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 18,
    paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 999 },
  generateText: { fontSize: 13, fontWeight: "800" },
});

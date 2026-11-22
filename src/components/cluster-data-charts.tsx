import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { useBrieflyAppConfig } from "@/context/app-config";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { SmartChartVisual } from "@/components/smart-chart-visual";
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
    keyFigures: "Key figures",
    comparisons: "Comparisons",
    showMore: "Show all comparisons",
    showLess: "Show fewer comparisons",
    details: "Source-verified figures from this news event",
    generate: "Extract charts",
    update: "Refresh charts with latest extraction",
    updating: "Updating verified charts…",
    awaitingReview: "Draft charts are awaiting admin review. They are not public yet.",
    usage: "Your chart extractions used in the past 24 hours",
    limitReached: "Daily chart extraction allowance reached. Try again after earlier attempts expire.",
    reviewAdmin: "Open chart review",
    processing: "Checking original reports for comparable data…",
    insufficient: "No figures could be source-verified for publication from the available original reports.",
    retry: "Try extraction again",
    source: "Source",
    evidence: "Reported evidence",
    showSources: "View sources and numerical evidence",
    hideSources: "Hide source evidence",
    error: "Chart availability could not be checked. Confirm the updated backend and chart database migration are running, then retry.",
    checking: "Checking chart availability…",
    access: "The server has not enabled chart generation for this account. Check your signed-in role and the dashboard setting.",
    refresh: "Check again",
    partial: "Verified subset — some proposed figures could not be checked.",
    derived: "Calculated from verified figures",
    forecast: "Forecast",
    proposal: "Proposed policy",
    target: "Target",
  },
  es: {
    title: "Explorar los datos",
    keyFigures: "Cifras clave",
    comparisons: "Comparaciones",
    showMore: "Ver todas las comparaciones",
    showLess: "Mostrar menos",
    details: "Cifras verificadas en las fuentes de esta noticia",
    generate: "Extraer gráficos",
    update: "Actualizar los gráficos",
    updating: "Actualizando cifras verificadas…",
    awaitingReview: "Los gráficos están pendientes de revisión administrativa y aún no son públicos.",
    usage: "Extracciones de gráficos usadas en 24 horas",
    limitReached: "Has alcanzado el límite. Puedes volver a intentarlo cuando expire una solicitud anterior.",
    reviewAdmin: "Revisar gráficos",
    processing: "Comprobando los datos en las fuentes originales…",
    insufficient: "No se pudieron verificar cifras publicables en las fuentes originales disponibles.",
    retry: "Volver a intentar",
    source: "Fuente",
    evidence: "Datos reportados",
    showSources: "Ver fuentes y cifras",
    hideSources: "Ocultar fuentes",
    error: "No se pudo comprobar la disponibilidad. Comprueba el servidor y la migración de datos, y vuelve a intentarlo.",
    checking: "Comprobando disponibilidad…",
    access: "El servidor no ha habilitado la generación para esta cuenta. Comprueba los permisos y los ajustes.",
    refresh: "Comprobar de nuevo",
    partial: "Solo datos verificados; algunas cifras no se confirmaron.",
    derived: "Calculado con cifras verificadas",
    forecast: "Previsión",
    proposal: "Propuesta",
    target: "Objetivo",
  },
  ja: {
    title: "データを詳しく見る",
    keyFigures: "主要な数値",
    comparisons: "比較データ",
    showMore: "比較をすべて表示",
    showLess: "表示を減らす",
    details: "報道元で確認された数値",
    generate: "グラフを作成",
    update: "グラフを最新の抽出で更新",
    updating: "検証済みグラフを更新中…",
    awaitingReview: "グラフは管理者の確認待ちです。まだ公開されていません。",
    usage: "過去24時間のグラフ抽出利用",
    limitReached: "抽出回数の上限です。過去の利用枠が更新されてから再試行してください。",
    reviewAdmin: "グラフを確認",
    processing: "元記事の比較可能な数値を確認中…",
    insufficient: "参照できた元記事から公開可能な数値を検証できませんでした。",
    retry: "再試行",
    source: "出典",
    evidence: "出典の記述",
    showSources: "出典と数値の根拠を見る",
    hideSources: "出典を閉じる",
    error: "グラフ機能を確認できません。バックエンドの更新とデータベース移行を確認してから再試行してください。",
    checking: "グラフ機能を確認中…",
    access: "サーバー側でこのアカウントの生成権限が確認できません。管理設定とログイン状態をご確認ください。",
    refresh: "もう一度確認",
    partial: "確認済みの一部の数値のみ表示しています。",
    derived: "確認済みの数値から算出",
    forecast: "予測",
    proposal: "政策案",
    target: "目標",
  },
  "zh-CN": {
    title: "探索数据",
    keyFigures: "关键数据",
    comparisons: "数据对比",
    showMore: "查看全部对比",
    showLess: "收起部分对比",
    details: "来自原始报道并经过核验的数值",
    generate: "提取图表",
    update: "使用最新分析更新图表",
    updating: "正在更新已核实图表…",
    awaitingReview: "图表草稿等待管理员审核，尚未公开。",
    usage: "过去24小时的图表提取次数",
    limitReached: "已达到提取次数上限。请等使用额度恢复后重试。",
    reviewAdmin: "审核图表",
    processing: "正在核对原始报道中的可比较数据…",
    insufficient: "未能从可获取的原始报道中核实适合公开的统计数据。",
    retry: "重新尝试",
    source: "来源",
    evidence: "原文依据",
    showSources: "查看来源和数值依据",
    hideSources: "收起来源依据",
    error: "无法检查图表功能。请确认后端已更新且完成数据库迁移，然后重试。",
    checking: "正在检查图表功能…",
    access: "服务器尚未授予此账户图表生成权限。请检查登录身份与后台设置。",
    refresh: "重新检查",
    partial: "仅显示已核实的数据，部分数值未能确认。",
    derived: "根据已核实的数据计算",
    forecast: "预测",
    proposal: "政策提案",
    target: "目标",
  },
  "zh-TW": {
    title: "探索數據",
    keyFigures: "關鍵數據",
    comparisons: "數據比較",
    showMore: "查看全部比較",
    showLess: "收起部分比較",
    details: "來自原始報導並經過核實的數值",
    generate: "擷取圖表",
    update: "使用最新分析更新圖表",
    updating: "正在更新已核實圖表…",
    awaitingReview: "圖表草稿等待管理員審核，尚未公開。",
    usage: "過去24小時的圖表擷取次數",
    limitReached: "已達到擷取次數上限。請等使用額度恢復後再試。",
    reviewAdmin: "審核圖表",
    processing: "正在核對原始報導中的可比較數據…",
    insufficient: "未能從可取得的原始報導中核實適合公開的統計數據。",
    retry: "重新嘗試",
    source: "來源",
    evidence: "原文依據",
    showSources: "查看來源與數值依據",
    hideSources: "收起來源依據",
    error: "無法檢查圖表功能。請確認後端已更新且完成資料庫遷移，然後重試。",
    checking: "正在檢查圖表功能…",
    access: "伺服器尚未授予此帳戶圖表產生權限。請檢查登入身分與後台設定。",
    refresh: "重新檢查",
    partial: "僅顯示已核實的數據，部分數值未能確認。",
    derived: "根據已核實的數據計算",
    forecast: "預測",
    proposal: "政策建議",
    target: "目標",
  },
} as const;

function formatVerifiedValue(value: number, unit: string): string {
  const amount = Number(value).toLocaleString();
  const currency = unit.match(/^(A\$|US\$|NZ\$|CA\$|£|€|\$|¥)\s*/i);
  if (currency) return currency[1] + amount + " " + unit.slice(currency[0].length).trim();
  if (unit.startsWith("%")) return amount + unit;
  return amount + " " + unit;
}

function TrendPlot({ chart, accent, border, textColor }: {
  chart: VerifiedDataChart;
  accent: string;
  border: string;
  textColor: string;
}) {
  const [width, setWidth] = useState(0);
  const maximum = Math.max(Number.EPSILON, ...chart.points.map((point) => point.value));
  // Use actual year intervals rather than treating an uneven time series
  // as if every observation were equally spaced.
  const years = chart.points.map((point) => {
    const match = point.label.match(/\b(?:19|20|21)\d{2}\b/);
    return match ? Number(match[0]) : null;
  });
  const yearValues = years.filter((year): year is number => year != null);
  const realYears = yearValues.length === years.length && new Set(yearValues).size > 1;
  const firstYear = realYears ? Math.min(...yearValues) : 0;
  const yearSpan = realYears ? Math.max(...yearValues) - firstYear : 1;
  const coordinates = chart.points.map((point, index) => ({
    x: 10 + Math.max(0, width - 20) *
      (realYears ? ((years[index] as number) - firstYear) / yearSpan
        : index / Math.max(1, chart.points.length - 1)),
    y: 10 + 125 * (1 - point.value / maximum),
  }));
  return (
    <View>
      <View
        style={[styles.trendPlot, { borderBottomColor: border }]}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          setWidth((current) => Math.abs(current - next) > 1 ? next : current);
        }}
      >
        {width > 0 && coordinates.slice(1).map((point, i) => {
          const previous = coordinates[i];
          const dx = point.x - previous.x;
          const dy = point.y - previous.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          return <View key={"segment-" + i} style={{
            position: "absolute", width: length, height: 3,
            left: (point.x + previous.x - length) / 2,
            top: (point.y + previous.y - 3) / 2,
            backgroundColor: accent, borderRadius: 2,
            transform: [{ rotate: ((Math.atan2(dy, dx) * 180 / Math.PI) + "deg") as `${number}deg` }],
          }} />;
        })}
        {width > 0 && coordinates.map((point, i) =>
          <View key={"dot-" + i} style={{
            position: "absolute", width: 9, height: 9, borderRadius: 5,
            backgroundColor: accent, left: point.x - 4.5, top: point.y - 4.5,
          }} />
        )}
      </View>
      <View style={styles.trendLabels}>
        {width > 0 && chart.points.map((point, i) => {
          const interval = Math.max(1, Math.ceil(chart.points.length / 5));
          if (i !== 0 && i !== chart.points.length - 1 && i % interval !== 0) return null;
          return (
            <View key={"year-" + i} style={[
              styles.trendLabelItem,
              { left: Math.max(0, Math.min(width - 56, coordinates[i].x - 28)) },
            ]}>
              <Text style={[styles.trendYear, { color: textColor }]}>{point.label}</Text>
              <Text style={[styles.trendValue, { color: textColor }]}>
                {Number(point.value).toLocaleString()}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ChartBars({ chart, copy }: {
  chart: VerifiedDataChart;
  copy: { partial: string; derived: string; forecast: string; proposal: string; target: string };
}) {
  const { colors } = useBrieflyTheme();
  const max = Math.max(Number.EPSILON, ...chart.points.map((point) => Math.max(0, point.value)));
  const qualifier = chart.qualifier === 'forecast' ? copy.forecast
    : chart.qualifier === 'proposal' ? copy.proposal
    : chart.qualifier === 'target' ? copy.target : null;
  return (
    <View style={styles.chart}>
      {chart.chart_type !== "kpi" && (
        <>
          <Text style={[styles.chartTitle, { color: colors.text }]}>{chart.title}</Text>
          <Text style={[styles.unit, { color: colors.textMuted }]}>{chart.unit}{qualifier ? " · " + qualifier : ""}</Text>
        </>
      )}
      {chart.partial && <Text style={[styles.note, { color: colors.textMuted }]}>{copy.partial}</Text>}
      {chart.chart_type === "kpi" ? (
        <View style={styles.kpiCompact}>
          <Text style={[styles.kpiValue, { color: colors.accent }]}>
            {formatVerifiedValue(chart.points[0].value, chart.unit)}
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.text }]}>{chart.title}</Text>
          {chart.points[0].label !== chart.title && (
            <Text style={[styles.kpiDetail, { color: colors.textMuted }]}>{chart.points[0].label}</Text>
          )}
          {qualifier && <Text style={[styles.kpiQualifier, { color: colors.textMuted }]}>{qualifier}</Text>}
        </View>
      ) : (chart.chart_type === "donut" ||
        chart.chart_type === "stacked" ||
        chart.chart_type === "grouped" ||
        chart.chart_type === "dumbbell" ||
        chart.chart_type === "waterfall") ? (
        <SmartChartVisual chart={chart} />
      ) : chart.chart_type === "line" ? (
        <TrendPlot chart={chart} accent={colors.accent}
          border={colors.border} textColor={colors.text} />
      ) : chart.points.map((point, index) => {
        const width = Math.max(0, Math.min(100, point.value / max * 100));
        return (
          <View key={point.label + "-" + index} style={styles.barItem}>
            <View style={styles.barHeading}>
              <Text style={[styles.barLabel, { color: colors.text }]}>{point.label}</Text>
              <Text style={[styles.barValue, { color: colors.text }]}>
                {Number(point.value).toLocaleString()}
              </Text>
            </View>
            <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.barFill, {
                backgroundColor: colors.accent,
                width: (width + "%") as `${number}%`,
              }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ChartEvidence({ chart, evidenceLabel, sourceLabel, derivedLabel }: {
  chart: VerifiedDataChart;
  evidenceLabel: string;
  sourceLabel: string;
  derivedLabel: string;
}) {
  const { colors } = useBrieflyTheme();
  return (
    <View style={[styles.evidenceGroup, { borderBottomColor: colors.border }]}>
      <Text style={[styles.evidenceGroupTitle, { color: colors.text }]}>{chart.title}</Text>
      {chart.points.map((point, index) => {
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
              {point.derived ? derivedLabel + ": " : ""}“{point.evidence_quote}”
            </Text>
            {point.derived && point.derivation_source_quote && (
              <Text style={[styles.evidence, { color: colors.textMuted }]}>
                “{point.derivation_source_quote}”
              </Text>
            )}
            {point.derived && point.composition_source_quote && (
              <Text style={[styles.evidence, { color: colors.textMuted }]}>
                “{point.composition_source_quote}”
              </Text>
            )}
          </View>
        );
      })}
      {chart.relationship_quote && (
        <View style={styles.sourceDetails}>
          <Text style={[styles.evidence, { color: colors.textMuted }]}>
            “{chart.relationship_quote}”
          </Text>
          {chart.relationship_source_url && /^https?:\/\//i.test(chart.relationship_source_url) && (
            <Pressable accessibilityRole="link"
              onPress={() => void Linking.openURL(chart.relationship_source_url!)}>
              <Text style={[styles.source, { color: colors.accent }]}>{sourceLabel} ↗</Text>
            </Pressable>
          )}
        </View>
      )}
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
  const { width: screenWidth } = useWindowDimensions();
  const copy = chartCopy[language] ?? chartCopy.en;
  const [sourceDisclosure, setSourceDisclosure] = useState({ eventId: "", expanded: false });
  const [comparisonDisclosure, setComparisonDisclosure] = useState({ eventId: "", expanded: false });
  const sourcesExpanded = sourceDisclosure.eventId === eventId && sourceDisclosure.expanded;
  const showMoreComparisons = comparisonDisclosure.eventId === eventId && comparisonDisclosure.expanded;
  const chartKey = [eventId, articleVersionId ?? "", user?.id ?? "",
    account?.translation_entitled === true ? "pro" : "free",
    account?.is_admin === true ? "admin" : "reader"].join(":");
  const [response, setResponse] = useState<{
    key: string; value: ClusterDataChartStatus;
  } | null>(null);
  const status = response?.key === chartKey ? response.value : null;
  const setStatus = useCallback((next: ClusterDataChartStatus) => {
    setResponse({ key: chartKey, value: next });
  }, [chartKey]);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const error = errorKey === chartKey;
  const setError = useCallback((next: boolean) => {
    setErrorKey(next ? chartKey : null);
  }, [chartKey]);
  const [busy, setBusy] = useState(false);

  // Stale cached data from another story or login is never rendered.
  // The fetch resolves asynchronously, so the effect has no sync state reset.
  useEffect(() => {
    let active = true;
    if (!eventId || !articleVersionId) return () => { active = false; };
    void getClusterDataCharts(eventId)
      .then((next) => {
        if (active) {
          setStatus(next);
          setError(false);
        }
      })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [eventId, articleVersionId, chartKey, setStatus, setError]);

  useEffect(() => {
    if ((status?.status !== "processing" && !status?.refreshing) || !eventId) return;
    let active = true;
    const id = setInterval(() => {
      void getClusterDataCharts(eventId)
        .then((next) => { if (active) setStatus(next); })
        .catch(() => {});
    }, 5000);
    return () => { active = false; clearInterval(id); };
  }, [eventId, status?.status, status?.refreshing, setStatus]);

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const next = await requestClusterDataCharts(eventId);
      setStatus(next);
    } catch (caught) {
      setError(true);
      if (String(caught).includes("429")) {
        try {
          setStatus(await getClusterDataCharts(eventId));
          setError(false);
        } catch { /* Keep error state */ }
      }
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
  const keyFigures = readyCharts.filter((chart) => chart.chart_type === "kpi" && chart.points.length === 1);
  const comparisons = readyCharts.filter((chart) => chart.chart_type !== "kpi");
  const shownComparisons = showMoreComparisons ? comparisons : comparisons.slice(0, 2);
  const keyCardWidth = screenWidth >= 960 ? "31.5%" : "48.5%";
  const comparisonWidth = screenWidth >= 1030 ? "48.5%" : "100%";
  const quota = account?.is_admin === true ? null : status?.quota;
  const quotaExhausted = Boolean(quota && quota.remaining <= 0);
  const canGenerate = status?.can_generate === true && !quotaExhausted;
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
      {!!quota && (
        <Text style={[styles.detail, { color: colors.textMuted }]}>
          {copy.usage}: {quota.used}/{quota.limit} · {quota.remaining} remaining
        </Text>
      )}
      {quotaExhausted && (
        <Text style={[styles.detail, { color: colors.accent }]}>{copy.limitReached}</Text>
      )}
      {status?.awaiting_review && (
        <Text style={[styles.detail, { color: colors.textMuted }]}>{copy.awaitingReview}</Text>
      )}
      {account?.is_admin === true && (status?.awaiting_review || status?.published) && (
        <Pressable accessibilityRole="button" style={styles.reviewLink}
          onPress={() => router.push(("/beta-dashboard?tab=charts&eventId=" +
            encodeURIComponent(eventId)) as never)}>
          <Text style={[styles.source, { color: colors.accent }]}>{copy.reviewAdmin} ↗</Text>
        </Pressable>
      )}
      {keyFigures.length > 0 && (
        <View style={styles.dataGroup}>
          <Text style={[styles.groupHeading, { color: colors.text }]}>{copy.keyFigures}</Text>
          <View style={styles.figureGrid}>
            {keyFigures.map((chart, index) => (
              <View key={chart.title + "-figure-" + index} style={[
                styles.figureCard, { width: keyCardWidth, backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
                <ChartBars chart={chart} copy={copy} />
              </View>
            ))}
          </View>
        </View>
      )}
      {comparisons.length > 0 && (
        <View style={styles.dataGroup}>
          <Text style={[styles.groupHeading, { color: colors.text }]}>{copy.comparisons}</Text>
          <View style={styles.comparisonGrid}>
            {shownComparisons.map((chart, index) => (
              <View key={chart.title + "-comparison-" + index} style={[
                styles.comparisonCard, { width: comparisonWidth, backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
                <ChartBars chart={chart} copy={copy} />
              </View>
            ))}
          </View>
          {comparisons.length > 2 && (
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showMoreComparisons }}
              onPress={() => setComparisonDisclosure({ eventId, expanded: !showMoreComparisons })}
              style={styles.moreButton}
            >
              <Text style={[styles.source, { color: colors.accent }]}>
                {showMoreComparisons ? copy.showLess : copy.showMore}
                {showMoreComparisons ? " −" : " +"}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      {readyCharts.length > 0 && (
        <View style={[styles.sharedSourceRow, { borderTopColor: colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: sourcesExpanded }}
            onPress={() => setSourceDisclosure({ eventId, expanded: !sourcesExpanded })}
            style={styles.sharedSourceTrigger}
          >
            <Text style={[styles.source, { color: colors.accent }]}>
              {sourcesExpanded ? copy.hideSources : copy.showSources}
            </Text>
            <Text style={[styles.expandGlyph, { color: colors.accent }]}>
              {sourcesExpanded ? "−" : "+"}
            </Text>
          </Pressable>
          {sourcesExpanded && (
            <View style={styles.evidenceList}>
              {readyCharts.map((chart, index) => (
                <ChartEvidence
                  key={chart.title + "-source-details-" + index}
                  chart={chart}
                  evidenceLabel={copy.evidence}
                  sourceLabel={copy.source}
                  derivedLabel={copy.derived}
                />
              ))}
            </View>
          )}
        </View>
      )}
      {(status?.status === "processing" || status?.refreshing) && (
        <View style={styles.progress}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.progressText, { color: colors.textMuted }]}>
            {status?.refreshing ? copy.updating : copy.processing}
          </Text>
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
      {privilegedViewer && (error || ((status?.status === "not_generated" || status?.status === "insufficient") && !canGenerate)) && (
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
          accessibilityLabel={status?.status === "ready" ? copy.update :
            status?.status === "failed" ? copy.retry : copy.generate}
          disabled={busy}
          onPress={() => void generate()}
          style={[styles.generateButton, {
            backgroundColor: colors.text,
            opacity: busy ? 0.55 : 1,
          }]}
        >
          {busy && <ActivityIndicator size="small" color={colors.background} />}
          <Text style={[styles.generateText, { color: colors.background }]}>
            {status?.status === "ready" ? copy.update :
              status?.status === "failed" ? copy.retry : copy.generate}
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
  chart: { gap: 8 },
  dataGroup: { gap: 12, marginTop: 8 },
  reviewLink: { alignSelf: "flex-start", minHeight: 40, justifyContent: "center" },
  groupHeading: { fontSize: 15, fontWeight: "900", letterSpacing: 0.2 },
  figureGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  figureCard: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, minHeight: 130 },
  comparisonGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  comparisonCard: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  moreButton: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center" },
  sharedSourceRow: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 4 },
  evidenceList: { gap: 4, paddingTop: 6 },
  evidenceGroup: { gap: 7, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  evidenceGroupTitle: { fontSize: 13, fontWeight: "900" },
  sharedSourceTrigger: { minHeight: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  expandGlyph: { fontSize: 20, fontWeight: "800" },
  kpiCompact: { gap: 7 },
  kpiDetail: { fontSize: 12, lineHeight: 17 },
  kpiQualifier: { fontSize: 11, fontWeight: "700" },
  note: { fontSize: 12, lineHeight: 18 },
  kpi: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 5 },
  kpiValue: { fontSize: 22, lineHeight: 28, fontWeight: "900" },
  kpiLabel: { fontSize: 13, lineHeight: 19, fontWeight: "800" },
  trendPlot: { position: "relative", width: "100%", height: 152, borderBottomWidth: 1, marginTop: 8 },
  trendLabels: { position: "relative", minHeight: 40, marginTop: 8 },
  trendLabelItem: { position: "absolute", width: 56, alignItems: "center" },
  trendYear: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  trendValue: { fontSize: 11, fontWeight: "800", textAlign: "center", marginTop: 3 },
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

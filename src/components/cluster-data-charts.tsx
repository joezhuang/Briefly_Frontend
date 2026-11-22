import { useCallback, useEffect, useState } from "react";
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
  getChartReview,
  removeChartFromDraft,
  releaseChartDraft,
  requestClusterDataCharts,
  type ChartReviewDraft,
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

const reviewCopy = {
  "en": {
    draft: "Draft preview",
    public: "Public view",
    label: "Admin chart review · private",
    intro: "Preview charts in the exact public layout. Draft edits are not public until released.",
    noPublic: "No public charts have been released.",
    remove: "Remove chart",
    removeConfirm: "Remove this chart from the draft?",
    confirmRemove: "Confirm removal",
    cancel: "Cancel",
    release: "Release selected charts",
    withdraw: "Withdraw public charts",
    releaseConfirm: "Publish this selection to everyone?",
    withdrawConfirm: "Withdraw the currently public charts?",
    confirmRelease: "Confirm release",
    busy: "Saving…",
    error: "Review changed or action failed. Please reload before retrying.",
    loading: "Loading chart review…",
  },
  "es": {
    draft: "Vista del borrador",
    public: "Vista pública",
    label: "Revisión administrativa · privada",
    intro: "Vista previa con el mismo diseño público. Los cambios requieren publicación.",
    noPublic: "Aún no hay gráficos publicados.",
    remove: "Quitar gráfico",
    removeConfirm: "¿Quitar este gráfico del borrador?",
    confirmRemove: "Confirmar eliminación",
    cancel: "Cancelar",
    release: "Publicar gráficos seleccionados",
    withdraw: "Retirar gráficos públicos",
    releaseConfirm: "¿Publicar esta selección para todos?",
    withdrawConfirm: "¿Retirar los gráficos públicos?",
    confirmRelease: "Confirmar publicación",
    busy: "Guardando…",
    error: "La revisión cambió o la acción falló. Actualiza el borrador.",
    loading: "Cargando revisión…",
  },
  "ja": {
    draft: "下書きプレビュー",
    public: "公開表示",
    label: "管理者レビュー · 非公開",
    intro: "公開版と同じ表示で確認できます。公開まで変更は反映されません。",
    noPublic: "公開済みグラフはまだありません。",
    remove: "グラフを削除",
    removeConfirm: "下書きから削除しますか？",
    confirmRemove: "削除を確認",
    cancel: "キャンセル",
    release: "選択したグラフを公開",
    withdraw: "公開グラフを取り下げ",
    releaseConfirm: "この内容を全読者に公開しますか？",
    withdrawConfirm: "公開グラフを取り下げますか？",
    confirmRelease: "公開を確定",
    busy: "保存中…",
    error: "変更を保存できません。下書きを再読み込みしてください。",
    loading: "レビューを読み込み中…",
  },
  "zh-CN": {
    draft: "草稿预览",
    public: "公开版本",
    label: "管理员审核 · 未公开",
    intro: "图表以正式阅读布局显示，发布前不会影响公开版本。",
    noPublic: "尚无已发布图表。",
    remove: "移除图表",
    removeConfirm: "从草稿中移除此图表？",
    confirmRemove: "确认移除",
    cancel: "取消",
    release: "发布所选图表",
    withdraw: "撤回公开图表",
    releaseConfirm: "将此选择发布给所有读者？",
    withdrawConfirm: "撤回已发布的图表？",
    confirmRelease: "确认发布",
    busy: "正在保存…",
    error: "审核版本已变化或操作失败，请重新加载。",
    loading: "正在加载审核…",
  },
  "zh-TW": {
    draft: "草稿預覽",
    public: "公開版本",
    label: "管理員審核 · 未公開",
    intro: "圖表以正式閱讀版面顯示，發布前不會影響公開版本。",
    noPublic: "尚無已發布圖表。",
    remove: "移除圖表",
    removeConfirm: "從草稿中移除此圖表？",
    confirmRemove: "確認移除",
    cancel: "取消",
    release: "發布所選圖表",
    withdraw: "撤回公開圖表",
    releaseConfirm: "將此選擇發布給所有讀者？",
    withdrawConfirm: "撤回已發布的圖表？",
    confirmRelease: "確認發布",
    busy: "正在儲存…",
    error: "審核版本已變更或操作失敗，請重新載入。",
    loading: "正在載入審核…",
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

export function ClusterDataCharts({ eventId, articleVersionId, reviewRequested = false }: {
  eventId: string;
  articleVersionId: number | null;
  reviewRequested?: boolean;
}) {
  const { user, account } = useBrieflyAuth();
  const { config } = useBrieflyAppConfig();
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const { width: screenWidth } = useWindowDimensions();
  const copy = chartCopy[language] ?? chartCopy.en;
  const reviewText = reviewCopy[language] ?? reviewCopy.en;
  const isAdmin = account?.is_admin === true;
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
  const [reviewResponse, setReviewResponse] = useState<{
    key: string; value: ChartReviewDraft;
  } | null>(null);
  const review = isAdmin && reviewResponse?.key === chartKey &&
    reviewResponse.value.article_version_id === articleVersionId
      ? reviewResponse.value : null;
  const [reviewView, setReviewView] = useState<{
    key: string; mode: "draft" | "public";
  } | null>(null);
  const [removeConfirmation, setRemoveConfirmation] = useState<{
    key: string; index: number;
  } | null>(null);
  const [releaseConfirmation, setReleaseConfirmation] = useState<string | null>(null);
  const [moderating, setModerating] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const reviewMode = isAdmin && Boolean(review?.ready) &&
    (reviewView?.key === chartKey
      ? reviewView.mode === "draft"
      : reviewRequested || status?.awaiting_review === true);
  const reviewError = moderationError === chartKey;
  const confirmingRelease = releaseConfirmation === chartKey;

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
    if (!isAdmin || !eventId || !articleVersionId) return;
    let active = true;
    void getChartReview(eventId)
      .then((next) => {
        if (active && next.article_version_id === articleVersionId) {
          setReviewResponse({ key: chartKey, value: next });
        }
      })
      .catch(() => {
        if (active) setModerationError(chartKey);
      });
    return () => { active = false; };
  }, [isAdmin, eventId, articleVersionId, chartKey, status?.status, status?.awaiting_review]);

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

  const moderateChart = async (action: "remove" | "release", index?: number) => {
    if (!isAdmin || !review?.ready || moderating || !eventId) return;
    setModerating(true);
    setModerationError(null);
    try {
      if (action === "remove" && index !== undefined) {
        await removeChartFromDraft(eventId, index, review.revision);
      } else if (action === "release") {
        await releaseChartDraft(eventId, review.revision);
      } else {
        return;
      }
      const [nextReview, nextStatus] = await Promise.all([
        getChartReview(eventId), getClusterDataCharts(eventId),
      ]);
      if (nextReview.article_version_id === articleVersionId) {
        setReviewResponse({ key: chartKey, value: nextReview });
      }
      setStatus(nextStatus);
      setReviewView({ key: chartKey, mode: action === "release" ? "public" : "draft" });
      setRemoveConfirmation(null);
      setReleaseConfirmation(null);
    } catch {
      setModerationError(chartKey);
      try {
        const next = await getChartReview(eventId);
        if (next.article_version_id === articleVersionId) {
          setReviewResponse({ key: chartKey, value: next });
        }
      } catch { /* Keep the actionable error. */ }
      setRemoveConfirmation(null);
      setReleaseConfirmation(null);
    } finally {
      setModerating(false);
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

  // Both the draft and public versions use the exact same reader renderer.
  const readyCharts = isAdmin && review
    ? reviewMode ? review.draft_charts : review.published_charts
    : status?.status === "ready" && Array.isArray(status.charts)
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
  const renderRemove = (chart: VerifiedDataChart) => {
    if (!reviewMode || !review?.ready) return null;
    const index = review.draft_charts.indexOf(chart);
    if (index < 0) return null;
    const confirming = removeConfirmation?.key === chartKey &&
      removeConfirmation.index === index;
    return (
      <View style={styles.moderationAction}>
        {confirming && <Text style={[styles.note, { color: colors.textMuted }]}>
          {reviewText.removeConfirm}
        </Text>}
        <View style={styles.reviewActionRow}>
          <Pressable accessibilityRole="button"
            accessibilityLabel={confirming ? reviewText.confirmRemove : reviewText.remove + ": " + chart.title}
            disabled={moderating}
            onPress={() => confirming ? void moderateChart("remove", index) :
              setRemoveConfirmation({ key: chartKey, index })}
            style={[styles.reviewAction, { borderColor: colors.border }]}>
            <Text style={[styles.source, { color: colors.accent }]}>
              {confirming ? reviewText.confirmRemove : reviewText.remove}
            </Text>
          </Pressable>
          {confirming && (
            <Pressable accessibilityRole="button" onPress={() => setRemoveConfirmation(null)}
              style={styles.reviewAction}>
              <Text style={[styles.source, { color: colors.textMuted }]}>
                {reviewText.cancel}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };
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
      {status?.awaiting_review && (!review || reviewMode) && (
        <Text style={[styles.detail, { color: colors.textMuted }]}>{copy.awaitingReview}</Text>
      )}
      {isAdmin && review?.ready && (
        <View style={[styles.reviewPanel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.reviewHeading, { color: colors.text }]}>{reviewText.label}</Text>
          <Text style={[styles.note, { color: colors.textMuted }]}>{reviewText.intro}</Text>
          <View style={styles.reviewActionRow}>
            {(["draft", "public"] as const).map((mode) => {
              const selected = mode === "draft" ? reviewMode : !reviewMode;
              return (
                <Pressable key={mode} accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setReviewView({ key: chartKey, mode });
                    setRemoveConfirmation(null);
                    setReleaseConfirmation(null);
                  }}
                  style={[styles.reviewAction, { borderColor: colors.border },
                    selected && { backgroundColor: colors.text, borderColor: colors.text }]}>
                  <Text style={[styles.source, { color: selected ? colors.background : colors.text }]}>
                    {mode === "draft" ? reviewText.draft : reviewText.public}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {reviewError && (
            <Text style={[styles.note, { color: colors.accent }]}>{reviewText.error}</Text>
          )}
        </View>
      )}
      {isAdmin && !review && reviewRequested && (
        <View style={styles.reviewPanel}>
          <Text style={[styles.note, { color: reviewError ? colors.accent : colors.textMuted }]}>
            {reviewError ? reviewText.error : reviewText.loading}
          </Text>
          {reviewError && (
            <Pressable accessibilityRole="button" style={styles.reviewAction}
              onPress={() => {
                setModerationError(null);
                void getChartReview(eventId)
                  .then((next) => {
                    if (next.article_version_id === articleVersionId) {
                      setReviewResponse({ key: chartKey, value: next });
                    }
                  })
                  .catch(() => setModerationError(chartKey));
              }}>
              <Text style={[styles.source, { color: colors.accent }]}>{copy.refresh}</Text>
            </Pressable>
          )}
        </View>
      )}
      {isAdmin && review && !reviewMode && readyCharts.length === 0 && (
        <Text style={[styles.note, { color: colors.textMuted }]}>{reviewText.noPublic}</Text>
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
                {renderRemove(chart)}
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
                {renderRemove(chart)}
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
      {reviewMode && review?.ready && (
        <View style={[styles.releasePanel, { borderTopColor: colors.border }]}>
          {confirmingRelease && (
            <Text style={[styles.note, { color: colors.textMuted }]}>
              {readyCharts.length ? reviewText.releaseConfirm : reviewText.withdrawConfirm}
            </Text>
          )}
          <View style={styles.reviewActionRow}>
            <Pressable accessibilityRole="button" disabled={moderating}
              onPress={() => confirmingRelease ? void moderateChart("release") :
                setReleaseConfirmation(chartKey)}
              style={[styles.generateButton, { backgroundColor: colors.text,
                opacity: moderating ? 0.55 : 1 }]}>
              {moderating && <ActivityIndicator size="small" color={colors.background} />}
              <Text style={[styles.generateText, { color: colors.background }]}>
                {moderating ? reviewText.busy : confirmingRelease ? reviewText.confirmRelease :
                  readyCharts.length ? reviewText.release : reviewText.withdraw}
              </Text>
            </Pressable>
            {confirmingRelease && (
              <Pressable accessibilityRole="button" onPress={() => setReleaseConfirmation(null)}
                style={styles.reviewAction}>
                <Text style={[styles.source, { color: colors.accent }]}>{reviewText.cancel}</Text>
              </Pressable>
            )}
          </View>
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
  reviewPanel: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 9 },
  reviewHeading: { fontSize: 14, fontWeight: "900" },
  reviewActionRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 9 },
  reviewAction: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999,
    minHeight: 40, justifyContent: "center", paddingHorizontal: 12 },
  moderationAction: { paddingTop: 9, gap: 7 },
  releasePanel: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 9 },
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

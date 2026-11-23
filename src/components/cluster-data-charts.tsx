import { useCallback, useEffect, useState } from "react";
import { useBrieflyAppConfig } from "@/context/app-config";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { SmartChartVisual } from "@/components/smart-chart-visual";
import {
  getClusterDataCharts,
  getChartReview,
  dismissChartReview,
  reopenChartReview,
  editChartInDraft,
  restoreChartToDraft,
  rollbackChartRelease,
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
import { emitChartReviewUpdate } from "@/services/chart-review-updates";

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
    dismiss: "Dismiss from review",
    dismissConfirm: "Do not publish this draft? It will leave the admin queue and notifications, but stay saved for later. Any existing public charts will remain unchanged.",
    confirmDismiss: "Confirm dismissal",
    reopen: "Reopen review",
    dismissedNotice: "Review dismissed. This draft is saved and will not trigger notifications. Public charts are unchanged.",
    add: "Add",
    excluded: "Excluded from next release",
    edit: "Edit draft",
    preview: "Preview release",
    published: "Currently published",
    history: "Previous release",
    label: "Admin chart review",
    intro: "The preview shows exactly how this draft will look to readers once published.",
    noPublic: "There is no currently published chart set.",
    remove: "Remove chart",
    removeConfirm: "Remove this chart from the draft?",
    confirmRemove: "Confirm removal",
    cancel: "Cancel",
    release: "Publish updates",
    withdraw: "Withdraw public charts",
    releaseConfirm: "Publish this exact selection for everyone?",
    withdrawConfirm: "Withdraw all currently published charts?",
    confirmRelease: "Confirm publication",
    busy: "Saving…",
    error: "Review changed or the action failed. Reload the draft and retry.",
    loading: "Loading admin chart review…",
    editChart: "Edit chart",
    titleLabel: "Title",
    descriptionLabel: "Description (optional; no new numerical claims)",
    typeLabel: "Chart style",
    saveEdit: "Save chart changes",
    restore: "Restore",
    removedHeading: "Removed charts",
    historyHeading: "Release history",
    previewHistory: "Preview old release",
    rollback: "Restore as published",
    rollbackConfirm: "Publish this previous release as the current public version?",
    confirmRollback: "Confirm rollback",
    noChanges: "No unpublished changes to publish.",
    draftHint: "This preview is the draft, not the old public release.",
    saved: "Your draft changes are saved privately.",
  },
  "es": {
    dismiss: "Descartar de revisión",
    dismissConfirm: "¿No publicar este borrador? Se ocultará de la cola y las notificaciones, pero seguirá guardado. Los gráficos públicos no cambiarán.",
    confirmDismiss: "Confirmar descarte",
    reopen: "Reabrir revisión",
    dismissedNotice: "Revisión descartada. El borrador sigue guardado y no generará avisos. La versión pública no cambia.",
    add: "Añadir",
    excluded: "Excluido de la próxima publicación",
    edit: "Editar borrador",
    preview: "Vista previa de publicación",
    published: "Publicación actual",
    history: "Publicación anterior",
    label: "Revisión administrativa",
    intro: "Esta vista muestra exactamente cómo se verá el borrador al publicarlo.",
    noPublic: "No hay gráficos públicos todavía.",
    remove: "Quitar gráfico",
    removeConfirm: "¿Quitar este gráfico del borrador?",
    confirmRemove: "Confirmar eliminación",
    cancel: "Cancelar",
    release: "Publicar cambios",
    withdraw: "Retirar gráficos públicos",
    releaseConfirm: "¿Publicar esta selección para todos?",
    withdrawConfirm: "¿Retirar todos los gráficos públicos?",
    confirmRelease: "Confirmar publicación",
    busy: "Guardando…",
    error: "La revisión cambió o falló. Recarga el borrador.",
    loading: "Cargando revisión…",
    editChart: "Editar gráfico",
    titleLabel: "Título",
    descriptionLabel: "Descripción (sin cifras nuevas)",
    typeLabel: "Tipo de gráfico",
    saveEdit: "Guardar cambios",
    restore: "Restaurar",
    removedHeading: "Gráficos eliminados",
    historyHeading: "Historial de publicaciones",
    previewHistory: "Ver versión anterior",
    rollback: "Restaurar publicación",
    rollbackConfirm: "¿Restaurar esta versión para todos?",
    confirmRollback: "Confirmar restauración",
    noChanges: "No hay cambios nuevos para publicar.",
    draftHint: "Esta es la vista del borrador, no la publicación anterior.",
    saved: "Los cambios del borrador están guardados.",
  },
  "ja": {
    dismiss: "レビューを見送る",
    dismissConfirm: "この下書きを公開せずレビュー通知から除外しますか？下書きは保存され、公開済みグラフは変更されません。",
    confirmDismiss: "見送りを確定",
    reopen: "レビューを再開",
    dismissedNotice: "レビューを見送りました。下書きは保存され、通知されません。公開版は変更されません。",
    add: "追加",
    excluded: "次の公開版から除外",
    edit: "下書きを編集",
    preview: "公開プレビュー",
    published: "現在の公開版",
    history: "過去の公開版",
    label: "管理者レビュー",
    intro: "公開後の読者表示と同じレイアウトで下書きを確認できます。",
    noPublic: "公開済みグラフはありません。",
    remove: "グラフを削除",
    removeConfirm: "下書きから削除しますか？",
    confirmRemove: "削除を確定",
    cancel: "キャンセル",
    release: "変更を公開",
    withdraw: "公開グラフを取り下げ",
    releaseConfirm: "この内容を全読者に公開しますか？",
    withdrawConfirm: "すべての公開グラフを取り下げますか？",
    confirmRelease: "公開を確定",
    busy: "保存中…",
    error: "内容が変わったか操作に失敗しました。再読み込みしてください。",
    loading: "レビューを読み込み中…",
    editChart: "グラフを編集",
    titleLabel: "タイトル",
    descriptionLabel: "説明（新しい数値は入力不可）",
    typeLabel: "グラフ形式",
    saveEdit: "変更を保存",
    restore: "復元",
    removedHeading: "削除したグラフ",
    historyHeading: "公開履歴",
    previewHistory: "過去の版をプレビュー",
    rollback: "過去の版を公開",
    rollbackConfirm: "この版を現在の公開版に戻しますか？",
    confirmRollback: "復元を確定",
    noChanges: "未公開の変更はありません。",
    draftHint: "これは新しい下書きのプレビューです。",
    saved: "下書きの変更が保存されました。",
  },
  "zh-CN": {
    dismiss: "暂不审核发布",
    dismissConfirm: "不发布此草稿并从审核队列和通知中移除？草稿仍会保留，已公开的图表不会改变。",
    confirmDismiss: "确认暂不发布",
    reopen: "重新审核",
    dismissedNotice: "已暂停此草稿的发布审核。草稿已保存，不再触发通知，公开图表不变。",
    add: "添加",
    excluded: "已从下次发布中排除",
    edit: "编辑草稿",
    preview: "发布预览",
    published: "当前公开版本",
    history: "历史发布版本",
    label: "管理员图表审核",
    intro: "这里显示草稿发布后读者看到的实际布局。",
    noPublic: "目前尚无公开图表。",
    remove: "移除图表",
    removeConfirm: "从草稿移除此图表？",
    confirmRemove: "确认移除",
    cancel: "取消",
    release: "发布更新",
    withdraw: "撤回公开图表",
    releaseConfirm: "向所有读者发布此选择？",
    withdrawConfirm: "撤回全部已公开图表？",
    confirmRelease: "确认发布",
    busy: "正在保存…",
    error: "审核版本已变更或操作失败，请重新加载。",
    loading: "正在加载审核…",
    editChart: "编辑图表",
    titleLabel: "标题",
    descriptionLabel: "说明（不得添加未验证数字）",
    typeLabel: "图表类型",
    saveEdit: "保存修改",
    restore: "恢复",
    removedHeading: "已移除图表",
    historyHeading: "发布历史",
    previewHistory: "预览旧版本",
    rollback: "恢复为公开版本",
    rollbackConfirm: "将此旧版本重新发布给所有读者？",
    confirmRollback: "确认恢复",
    noChanges: "没有待发布的修改。",
    draftHint: "这里预览的是草稿而不是旧公开版本。",
    saved: "草稿修改已保存。",
  },
  "zh-TW": {
    dismiss: "暫不審核發布",
    dismissConfirm: "不發布此草稿並從審核佇列與通知中移除？草稿仍會保留，已公開圖表不變。",
    confirmDismiss: "確認暫不發布",
    reopen: "重新審核",
    dismissedNotice: "已暫停此草稿的發布審核。草稿已保存，不再觸發通知，公開圖表不變。",
    add: "加入",
    excluded: "已從下次發布中排除",
    edit: "編輯草稿",
    preview: "發布預覽",
    published: "目前公開版本",
    history: "歷史發布版本",
    label: "管理員圖表審核",
    intro: "這裡顯示草稿發布後讀者看到的實際版面。",
    noPublic: "目前尚無公開圖表。",
    remove: "移除圖表",
    removeConfirm: "從草稿移除此圖表？",
    confirmRemove: "確認移除",
    cancel: "取消",
    release: "發布更新",
    withdraw: "撤回公開圖表",
    releaseConfirm: "向所有讀者發布此選擇？",
    withdrawConfirm: "撤回全部已公開圖表？",
    confirmRelease: "確認發布",
    busy: "正在儲存…",
    error: "審核版本已變更或操作失敗，請重新載入。",
    loading: "正在載入審核…",
    editChart: "編輯圖表",
    titleLabel: "標題",
    descriptionLabel: "說明（不得添加未驗證數字）",
    typeLabel: "圖表類型",
    saveEdit: "儲存修改",
    restore: "還原",
    removedHeading: "已移除圖表",
    historyHeading: "發布歷史",
    previewHistory: "預覽舊版本",
    rollback: "還原為公開版本",
    rollbackConfirm: "將此舊版本重新發布給所有讀者？",
    confirmRollback: "確認還原",
    noChanges: "沒有待發布的修改。",
    draftHint: "此處預覽的是草稿而非舊公開版本。",
    saved: "草稿修改已儲存。",
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
      {!!chart.description && (
        <Text style={[styles.chartDescription, { color: colors.textMuted }]}>
          {chart.description}
        </Text>
      )}
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

/** Presentation choices mirror the backend's source-validated restrictions. */
function editableDisplayTypes(chart: VerifiedDataChart): VerifiedDataChart["chart_type"][] {
  const verified = chart.verified_chart_type ?? chart.chart_type;
  if (verified === "donut" || verified === "stacked") {
    const points = chart.points;
    return points.length >= 2 && points.length <= 6 &&
      points.every((p) => Number.isFinite(p.value) && p.value > 0)
        ? ["donut", "stacked", "bar"] : ["stacked", "bar"];
  }
  if (verified === "line") return ["line", "bar"];
  if (verified === "grouped" || verified === "dumbbell") {
    const series = new Set(chart.points.map((p) => p.series ?? ""));
    return series.size === 2 &&
      Array.from(series).every((value) => /^(?:19|20|21)\d{2}$/.test(value))
        ? ["grouped", "dumbbell"] : ["grouped"];
  }
  return [verified];
}

type ReviewChartCard = {
  chart: VerifiedDataChart;
  removedIndex: number | null;
};

/** Excluded charts stay in the same editorial draft order, never in the release. */
function draftCardsInOrder(review: ChartReviewDraft): ReviewChartCard[] {
  const cards: ReviewChartCard[] = review.draft_charts.map((chart) => ({
    chart, removedIndex: null,
  }));
  const removed = [...(review.removed_charts ?? [])]
    .sort((left, right) => left.position - right.position || left.index - right.index);
  for (const item of removed) {
    const position = Math.min(Math.max(0, item.position), cards.length);
    cards.splice(position, 0, { chart: item.chart, removedIndex: item.index });
  }
  return cards;
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
    key: string; mode: "edit" | "preview" | "published" | "history";
    releaseId?: number;
  } | null>(null);
  const [removeConfirmation, setRemoveConfirmation] = useState<{
    key: string; index: number;
  } | null>(null);
  const [releaseConfirmation, setReleaseConfirmation] = useState<string | null>(null);
  const [dismissConfirmation, setDismissConfirmation] = useState<string | null>(null);
  const [rollbackConfirmation, setRollbackConfirmation] = useState<{
    key: string; releaseId: number;
  } | null>(null);
  const [editing, setEditing] = useState<{
    key: string; index: number; title: string; description: string;
    chartType: VerifiedDataChart["chart_type"];
  } | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  // The default is always a post-publication preview of the DRAFT, not
  // the old published edition. Existing public releases are optional comparisons.
  const viewMode = reviewView?.key === chartKey ? reviewView.mode : "preview";
  const editMode = isAdmin && Boolean(review?.ready) && viewMode === "edit";
  const previewMode = isAdmin && Boolean(review?.ready) && viewMode === "preview";
  const reviewMode = editMode || previewMode;
  const viewingPublic = isAdmin && Boolean(review) && viewMode === "published";
  const viewedHistory = viewMode === "history"
    ? review?.history?.find((entry) => entry.id === reviewView?.releaseId) : null;
  const reviewError = moderationError === chartKey;
  const confirmingRelease = releaseConfirmation === chartKey;
  const confirmingDismiss = dismissConfirmation === chartKey;
  const hasPublicRelease = Boolean(review?.published_release_id != null);
  const hasDraftChanges = Boolean(review?.ready &&
    (!hasPublicRelease ||
      JSON.stringify(review.draft_charts) !== JSON.stringify(review.published_charts)));

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

  const refreshReview = async () => {
    const [nextReview, nextStatus] = await Promise.all([
      getChartReview(eventId), getClusterDataCharts(eventId),
    ]);
    if (nextReview.article_version_id === articleVersionId) {
      setReviewResponse({ key: chartKey, value: nextReview });
    }
    setStatus(nextStatus);
  };

  const moderateChart = async (action: "remove" | "restore" | "edit" | "release" | "rollback" | "dismiss" | "reopen",
    index?: number) => {
    if (!isAdmin || !review?.ready || moderating || !eventId) return;
    setModerating(true);
    setModerationError(null);
    try {
      if (action === "remove" && index !== undefined) {
        await removeChartFromDraft(eventId, index, review.revision);
      } else if (action === "restore" && index !== undefined) {
        await restoreChartToDraft(eventId, index, review.revision);
      } else if (action === "edit" && editing?.key === chartKey && index === editing.index) {
        await editChartInDraft(eventId, index, review.revision, {
          title: editing.title,
          description: editing.description,
          chart_type: editing.chartType,
        });
      } else if (action === "dismiss") {
        await dismissChartReview(eventId, review.revision);
      } else if (action === "reopen") {
        await reopenChartReview(eventId, review.revision);
      } else if (action === "release") {
        await releaseChartDraft(eventId, review.revision, review.published_release_id);
      } else if (action === "rollback" && index !== undefined &&
        review.published_release_id != null) {
        await rollbackChartRelease(eventId, index, review.published_release_id);
      } else {
        return;
      }
      // Update the global admin inbox immediately instead of waiting for poll.
      emitChartReviewUpdate();
      await refreshReview();
      setReviewView({ key: chartKey, mode: action === "rollback" ? "published" :
        action === "release" || action === "dismiss" || action === "reopen"
          ? "preview" : "edit" });
      setRemoveConfirmation(null);
      setReleaseConfirmation(null);
      setDismissConfirmation(null);
      setRollbackConfirmation(null);
      setEditing(null);
    } catch {
      setModerationError(chartKey);
      try { await refreshReview(); } catch { /* Keep actionable error visible. */ }
      setRemoveConfirmation(null);
      setReleaseConfirmation(null);
      setDismissConfirmation(null);
      setRollbackConfirmation(null);
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
    ? viewingPublic ? review.published_charts :
      viewMode === "history" ? viewedHistory?.charts ?? [] : review.draft_charts
    : status?.status === "ready" && Array.isArray(status.charts)
      ? status.charts
      : [];
  // Edit draft shows every chart, including excluded ones in their original
  // slots. Preview release and public views render ONLY included charts.
  const visibleCards: ReviewChartCard[] = editMode && review
    ? draftCardsInOrder(review)
    : readyCharts.map((chart) => ({ chart, removedIndex: null }));
  const keyFigures = visibleCards.filter((item) =>
    item.chart.chart_type === "kpi" && item.chart.points.length === 1);
  const comparisons = visibleCards.filter((item) => item.chart.chart_type !== "kpi");
  const shownComparisons = editMode || showMoreComparisons ? comparisons : comparisons.slice(0, 2);
  const keyCardWidth = screenWidth >= 960 ? "31.5%" : "48.5%";
  const comparisonWidth = screenWidth >= 1030 ? "48.5%" : "100%";
  const quota = account?.is_admin === true ? null : status?.quota;
  const quotaExhausted = Boolean(quota && quota.remaining <= 0);
  const canGenerate = status?.can_generate === true && !quotaExhausted;
  const renderEditFields = (chart: VerifiedDataChart, index: number) => {
    if (!editing || editing.key !== chartKey || editing.index !== index) return null;
    const setField = (patch: {
      title?: string;
      description?: string;
      chartType?: VerifiedDataChart["chart_type"];
    }) => {
      setEditing((current) => current && current.key === chartKey && current.index === index
        ? { ...current, ...patch } : current);
    };
    return (
      <View style={[styles.editForm, { borderColor: colors.border }]}>
        <Text style={[styles.editFieldLabel, { color: colors.text }]}>
          {reviewText.titleLabel}
        </Text>
        <TextInput accessibilityLabel={reviewText.titleLabel}
          value={editing.title} maxLength={140}
          onChangeText={(title) => setField({ title })}
          style={[styles.editInput, { borderColor: colors.border, color: colors.text,
            backgroundColor: colors.surface }]} />
        <Text style={[styles.editFieldLabel, { color: colors.text }]}>
          {reviewText.descriptionLabel}
        </Text>
        <TextInput accessibilityLabel={reviewText.descriptionLabel}
          value={editing.description} multiline maxLength={300}
          onChangeText={(description) => setField({ description })}
          style={[styles.editInput, styles.descriptionInput,
            { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]} />
        <Text style={[styles.editFieldLabel, { color: colors.text }]}>
          {reviewText.typeLabel}
        </Text>
        <View style={styles.reviewActionRow}>
          {editableDisplayTypes(chart).map((kind) => (
            <Pressable key={kind} accessibilityRole="button"
              accessibilityState={{ selected: editing.chartType === kind }}
              onPress={() => setField({ chartType: kind })}
              style={[styles.reviewAction, { borderColor: colors.border },
                editing.chartType === kind && {
                  backgroundColor: colors.text, borderColor: colors.text,
                }]}>
              <Text style={[styles.source, {
                color: editing.chartType === kind ? colors.background : colors.text,
              }]}>{kind[0].toUpperCase() + kind.slice(1)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.reviewActionRow}>
          <Pressable accessibilityRole="button" disabled={moderating || !editing.title.trim()}
            onPress={() => void moderateChart("edit", index)}
            style={[styles.generateButton, {
              backgroundColor: colors.text, opacity: moderating || !editing.title.trim() ? 0.5 : 1,
            }]}>
            <Text style={[styles.generateText, { color: colors.background }]}>
              {reviewText.saveEdit}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button"
            onPress={() => setEditing(null)} style={styles.reviewAction}>
            <Text style={[styles.source, { color: colors.textMuted }]}>
              {reviewText.cancel}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderRemove = (chart: VerifiedDataChart, removedIndex: number | null) => {
    if (!editMode || !review?.ready) return null;
    if (removedIndex !== null) {
      return (
        <View style={styles.moderationAction}>
          <Text style={[styles.excludedLabel, { color: colors.textMuted }]}>
            {reviewText.excluded}
          </Text>
          <Pressable accessibilityRole="button" disabled={moderating}
            accessibilityLabel={reviewText.add + ": " + chart.title}
            onPress={() => void moderateChart("restore", removedIndex)}
            style={[styles.reviewAction, styles.addButton, { borderColor: colors.border }]}>
            <Text style={[styles.source, { color: colors.accent }]}>{reviewText.add}</Text>
          </Pressable>
        </View>
      );
    }
    const index = review.draft_charts.indexOf(chart);
    if (index < 0) return null;
    const confirming = removeConfirmation?.key === chartKey &&
      removeConfirmation.index === index;
    return (
      <View style={styles.moderationAction}>
        <View style={styles.reviewActionRow}>
          <Pressable accessibilityRole="button" disabled={moderating}
            onPress={() => {
              setRemoveConfirmation(null);
              setEditing({
                key: chartKey, index, title: chart.title,
                description: chart.description ?? "", chartType: chart.chart_type,
              });
            }}
            style={[styles.reviewAction, { borderColor: colors.border }]}>
            <Text style={[styles.source, { color: colors.accent }]}>{reviewText.editChart}</Text>
          </Pressable>
        </View>
        {editing?.key === chartKey && editing.index === index && renderEditFields(chart, index)}
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
      {status?.awaiting_review && !review && (
        <Text style={[styles.detail, { color: colors.textMuted }]}>{copy.awaitingReview}</Text>
      )}
      {isAdmin && review?.ready && (
        <View style={[styles.reviewPanel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.reviewHeading, { color: colors.text }]}>{reviewText.label}</Text>
          <Text style={[styles.note, { color: colors.textMuted }]}>{reviewText.intro}</Text>
          <View style={styles.reviewActionRow}>
            {([
              { mode: "edit", label: reviewText.edit },
              { mode: "preview", label: reviewText.preview },
              ...(hasPublicRelease && review.published_charts.length > 0
                ? [{ mode: "published", label: reviewText.published }] : []),
            ] as { mode: "edit" | "preview" | "published"; label: string }[]).map((option) => {
              const selected = viewMode === option.mode;
              return (
                <Pressable key={option.mode} accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setReviewView({ key: chartKey, mode: option.mode });
                    setEditing(null);
                    setRemoveConfirmation(null);
                    setReleaseConfirmation(null);
                    setDismissConfirmation(null);
                    setRollbackConfirmation(null);
                  }}
                  style={[styles.reviewAction, { borderColor: colors.border },
                    selected && { backgroundColor: colors.text, borderColor: colors.text }]}>
                  <Text style={[styles.source, { color: selected ? colors.background : colors.text }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {review.dismissed && (
            <Text style={[styles.note, { color: colors.textMuted }]}>
              {reviewText.dismissedNotice}
            </Text>
          )}
          {previewMode && <Text style={[styles.note, { color: colors.textMuted }]}>
            {reviewText.draftHint}
          </Text>}
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
      {isAdmin && review && viewingPublic && readyCharts.length === 0 && (
        <Text style={[styles.note, { color: colors.textMuted }]}>{reviewText.noPublic}</Text>
      )}
      {keyFigures.length > 0 && (
        <View style={styles.dataGroup}>
          <Text style={[styles.groupHeading, { color: colors.text }]}>{copy.keyFigures}</Text>
          <View style={styles.figureGrid}>
            {keyFigures.map(({ chart, removedIndex }, index) => (
              <View key={chart.title + "-figure-" + index} style={[
                styles.figureCard,
                removedIndex !== null && styles.excludedCard,
                { width: keyCardWidth, backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
                <View style={removedIndex !== null ? styles.excludedChart : undefined}>
                  <ChartBars chart={chart} copy={copy} />
                </View>
                {renderRemove(chart, removedIndex)}
              </View>
            ))}
          </View>
        </View>
      )}
      {comparisons.length > 0 && (
        <View style={styles.dataGroup}>
          <Text style={[styles.groupHeading, { color: colors.text }]}>{copy.comparisons}</Text>
          <View style={styles.comparisonGrid}>
            {shownComparisons.map(({ chart, removedIndex }, index) => (
              <View key={chart.title + "-comparison-" + index} style={[
                styles.comparisonCard,
                removedIndex !== null && styles.excludedCard,
                { width: comparisonWidth, backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
                <View style={removedIndex !== null ? styles.excludedChart : undefined}>
                  <ChartBars chart={chart} copy={copy} />
                </View>
                {renderRemove(chart, removedIndex)}
              </View>
            ))}
          </View>
          {comparisons.length > 2 && !editMode && (
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
      {visibleCards.length > 0 && (
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
              {visibleCards.map(({ chart, removedIndex }, index) => (
                <ChartEvidence
                  key={chart.title + "-source-details-" + index + "-" + removedIndex}
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
          {review.dismissed ? (
            <View style={styles.reviewActionRow}>
              <Text style={[styles.note, { color: colors.textMuted }]}>
                {reviewText.dismissedNotice}
              </Text>
              <Pressable accessibilityRole="button" disabled={moderating}
                style={[styles.reviewAction, { borderColor: colors.border }]}
                onPress={() => void moderateChart("reopen")}>
                <Text style={[styles.source, { color: colors.accent }]}>
                  {reviewText.reopen}
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {!hasDraftChanges && (
                <Text style={[styles.note, { color: colors.textMuted }]}>
                  {reviewText.noChanges}
                </Text>
              )}
              {confirmingRelease && (
                <Text style={[styles.note, { color: colors.textMuted }]}>
                  {readyCharts.length ? reviewText.releaseConfirm : reviewText.withdrawConfirm}
                </Text>
              )}
              {hasDraftChanges && (
                <View style={styles.reviewActionRow}>
                  <Pressable accessibilityRole="button" disabled={moderating}
                    onPress={() => {
                      if (confirmingRelease) {
                        void moderateChart("release");
                      } else {
                        setReleaseConfirmation(chartKey);
                        setDismissConfirmation(null);
                      }
                    }}
                    style={[styles.generateButton, { backgroundColor: colors.text,
                      opacity: moderating ? 0.55 : 1 }]}>
                    {moderating && <ActivityIndicator size="small" color={colors.background} />}
                    <Text style={[styles.generateText, { color: colors.background }]}>
                      {moderating ? reviewText.busy : confirmingRelease ? reviewText.confirmRelease :
                        readyCharts.length ? reviewText.release : reviewText.withdraw}
                    </Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={moderating}
                    onPress={() => {
                      setDismissConfirmation(chartKey);
                      setReleaseConfirmation(null);
                    }}
                    style={[styles.reviewAction, { borderColor: colors.border }]}>
                    <Text style={[styles.source, { color: colors.textMuted }]}>
                      {reviewText.dismiss}
                    </Text>
                  </Pressable>
                  {confirmingRelease && (
                    <Pressable accessibilityRole="button"
                      onPress={() => setReleaseConfirmation(null)}
                      style={styles.reviewAction}>
                      <Text style={[styles.source, { color: colors.accent }]}>
                        {reviewText.cancel}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
              {confirmingDismiss && hasDraftChanges && (
                <View style={[styles.reviewPanel, { borderColor: colors.border }]}>
                  <Text style={[styles.note, { color: colors.textMuted }]}>
                    {reviewText.dismissConfirm}
                  </Text>
                  <View style={styles.reviewActionRow}>
                    <Pressable accessibilityRole="button" disabled={moderating}
                      onPress={() => void moderateChart("dismiss")}
                      style={[styles.reviewAction, { borderColor: colors.border }]}>
                      <Text style={[styles.source, { color: colors.accent }]}>
                        {reviewText.confirmDismiss}
                      </Text>
                    </Pressable>
                    <Pressable accessibilityRole="button"
                      onPress={() => setDismissConfirmation(null)}
                      style={styles.reviewAction}>
                      <Text style={[styles.source, { color: colors.textMuted }]}>
                        {reviewText.cancel}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      )}
      {isAdmin && review && !!review.history?.length && (
        <View style={[styles.reviewPanel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Pressable accessibilityRole="button"
            accessibilityState={{ expanded: historyExpanded }}
            onPress={() => setHistoryExpanded((current) => !current)}
            style={styles.sharedSourceTrigger}>
            <Text style={[styles.source, { color: colors.accent }]}>
              {reviewText.historyHeading} ({review.history.length})
            </Text>
            <Text style={[styles.source, { color: colors.accent }]}>
              {historyExpanded ? "−" : "+"}
            </Text>
          </Pressable>
          {historyExpanded && review.history.map((entry) => (
            <View key={entry.id} style={[styles.historyRow, { borderTopColor: colors.border }]}>
              <View style={styles.flexLabel}>
                <Text style={[styles.note, { color: colors.text }]}>
                  {entry.released_at ? new Date(entry.released_at).toLocaleString() :
                    "#" + entry.id} · {entry.charts.length} chart(s)
                </Text>
              </View>
              <Pressable accessibilityRole="button"
                style={[styles.reviewAction, { borderColor: colors.border }]}
                onPress={() => {
                  setReviewView({ key: chartKey, mode: "history", releaseId: entry.id });
                  setRollbackConfirmation(null);
                  setEditing(null);
                }}>
                <Text style={[styles.source, { color: colors.accent }]}>{reviewText.previewHistory}</Text>
              </Pressable>
            </View>
          ))}
          {viewedHistory && viewedHistory.id !== review.published_release_id &&
            review.published_release_id != null && (
            <View style={[styles.releasePanel, { borderTopColor: colors.border }]}>
              <Text style={[styles.note, { color: colors.textMuted }]}>
                {reviewText.history} #{viewedHistory.id}
              </Text>
              {rollbackConfirmation?.key === chartKey &&
                rollbackConfirmation.releaseId === viewedHistory.id && (
                <Text style={[styles.note, { color: colors.textMuted }]}>
                  {reviewText.rollbackConfirm}
                </Text>
              )}
              <View style={styles.reviewActionRow}>
                <Pressable accessibilityRole="button" disabled={moderating}
                  onPress={() => rollbackConfirmation?.key === chartKey &&
                    rollbackConfirmation.releaseId === viewedHistory.id
                      ? void moderateChart("rollback", viewedHistory.id)
                      : setRollbackConfirmation({ key: chartKey, releaseId: viewedHistory.id })}
                  style={[styles.generateButton, { backgroundColor: colors.text }]}>
                  <Text style={[styles.generateText, { color: colors.background }]}>
                    {rollbackConfirmation?.key === chartKey &&
                      rollbackConfirmation.releaseId === viewedHistory.id
                        ? reviewText.confirmRollback : reviewText.rollback}
                  </Text>
                </Pressable>
                {rollbackConfirmation?.key === chartKey &&
                  rollbackConfirmation.releaseId === viewedHistory.id && (
                  <Pressable accessibilityRole="button"
                    onPress={() => setRollbackConfirmation(null)}
                    style={styles.reviewAction}>
                    <Text style={[styles.source, { color: colors.accent }]}>{reviewText.cancel}</Text>
                  </Pressable>
                )}
              </View>
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
  reviewPanel: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 9 },
  reviewHeading: { fontSize: 14, fontWeight: "900" },
  excludedCard: { borderStyle: "dashed" },
  excludedChart: { opacity: 0.48 },
  excludedLabel: { fontSize: 12, fontWeight: "700" },
  addButton: { alignSelf: "flex-start", minWidth: 68, alignItems: "center" },
  chartDescription: { fontSize: 12, lineHeight: 18 },
  editForm: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 11, padding: 10, gap: 8 },
  editFieldLabel: { fontSize: 12, fontWeight: "800" },
  editInput: { minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8,
    paddingHorizontal: 11, paddingVertical: 8, fontSize: 13 },
  descriptionInput: { minHeight: 68, textAlignVertical: "top" },
  reviewActionRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 9 },
  reviewAction: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999,
    minHeight: 40, justifyContent: "center", paddingHorizontal: 12 },
  moderationAction: { paddingTop: 9, gap: 7 },
  releasePanel: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 9 },
  flexLabel: { flex: 1, minWidth: 120 },
  historyRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9,
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
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

import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { trackProductEvent } from "@/analytics/product-analytics";
import {
  createCommunityContribution,
  getEventCommunity,
  reportCommunityContribution,
  setCommunityReaction,
  withdrawCommunityContribution,
  type CommunityContribution,
  type CommunityContributionType,
  type CommunityReportReason,
  type EventCommunity,
} from "@/api/briefly";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

const TYPES: CommunityContributionType[] = [
  "perspective",
  "reason",
  "evidence",
  "question",
  "correction",
];

const REPORT_REASONS: CommunityReportReason[] = [
  "misleading",
  "abusive",
  "spam",
  "off_topic",
  "other",
];

const copy = {
  en: {
    title: "Community",
    subtitle: "Add context, evidence, questions or corrections — not just reactions.",
    contribute: "Contribute",
    signIn: "Sign in to contribute",
    reader: "Reader",
    you: "You",
    source: "Community source ↗",
    sourceHint: "Supporting source link (optional)",
    bodyHint: "What would help others understand this event?",
    submit: "Publish contribution",
    publishing: "Publishing…",
    showAll: "Show all",
    showLess: "Show less",
    withdraw: "Withdraw",
    withdrawTitle: "Withdraw this contribution?",
    withdrawBody: "This removes it from the public event discussion.",
    cancel: "Cancel",
    confirmWithdraw: "Withdraw",
    report: "Report",
    reported: "Reported",
    retry: "Retry",
    unavailable: "Community is temporarily unavailable.",
    empty: "No community contributions yet.",
    error: "Could not update Community. Please try again.",
    perspective: "Perspective",
    reason: "Reason",
    evidence: "Evidence",
    question: "Question",
    correction: "Correction",
    misleading: "Misleading",
    abusive: "Abusive",
    spam: "Spam",
    off_topic: "Off-topic",
    other: "Other",
  },
  es: {
    title: "Comunidad",
    subtitle: "Añade contexto, evidencia, preguntas o correcciones, no solo reacciones.",
    contribute: "Contribuir",
    signIn: "Inicia sesión para contribuir",
    reader: "Lector",
    you: "Tú",
    source: "Fuente de la comunidad ↗",
    sourceHint: "Enlace de apoyo (opcional)",
    bodyHint: "¿Qué ayudaría a otros a entender este evento?",
    submit: "Publicar contribución",
    publishing: "Publicando…",
    showAll: "Ver todo",
    showLess: "Ver menos",
    withdraw: "Retirar",
    withdrawTitle: "¿Retirar esta contribución?",
    withdrawBody: "Se eliminará de la discusión pública del evento.",
    cancel: "Cancelar",
    confirmWithdraw: "Retirar",
    report: "Reportar",
    reported: "Reportado",
    retry: "Reintentar",
    unavailable: "La comunidad no está disponible temporalmente.",
    empty: "Aún no hay contribuciones de la comunidad.",
    error: "No se pudo actualizar la comunidad. Inténtalo de nuevo.",
    perspective: "Perspectiva",
    reason: "Razón",
    evidence: "Evidencia",
    question: "Pregunta",
    correction: "Corrección",
    misleading: "Engañoso",
    abusive: "Abusivo",
    spam: "Spam",
    off_topic: "Fuera de tema",
    other: "Otro",
  },
  ja: {
    title: "コミュニティ",
    subtitle: "反応だけでなく、文脈・根拠・質問・訂正を共有します。",
    contribute: "投稿する",
    signIn: "投稿するにはログイン",
    reader: "読者",
    you: "あなた",
    source: "コミュニティの情報源 ↗",
    sourceHint: "参考リンク（任意）",
    bodyHint: "この出来事の理解に役立つことは何ですか？",
    submit: "投稿を公開",
    publishing: "公開中…",
    showAll: "すべて表示",
    showLess: "折りたたむ",
    withdraw: "取り下げ",
    withdrawTitle: "この投稿を取り下げますか？",
    withdrawBody: "イベントの公開ディスカッションから削除されます。",
    cancel: "キャンセル",
    confirmWithdraw: "取り下げ",
    report: "報告",
    reported: "報告済み",
    retry: "再試行",
    unavailable: "コミュニティを一時的に利用できません。",
    empty: "まだコミュニティ投稿はありません。",
    error: "コミュニティを更新できませんでした。もう一度お試しください。",
    perspective: "視点",
    reason: "理由",
    evidence: "根拠",
    question: "質問",
    correction: "訂正",
    misleading: "誤解を招く",
    abusive: "攻撃的",
    spam: "スパム",
    off_topic: "無関係",
    other: "その他",
  },
  "zh-CN": {
    title: "社区",
    subtitle: "补充背景、证据、问题或更正，而不只是表达反应。",
    contribute: "参与",
    signIn: "登录后参与",
    reader: "读者",
    you: "你",
    source: "社区来源 ↗",
    sourceHint: "支持来源链接（可选）",
    bodyHint: "什么信息能帮助其他人更好理解这一事件？",
    submit: "发布贡献",
    publishing: "正在发布…",
    showAll: "查看全部",
    showLess: "收起",
    withdraw: "撤回",
    withdrawTitle: "撤回这条贡献？",
    withdrawBody: "撤回后将不再显示在该事件的公开讨论中。",
    cancel: "取消",
    confirmWithdraw: "撤回",
    report: "举报",
    reported: "已举报",
    retry: "重试",
    unavailable: "社区暂时不可用。",
    empty: "暂无社区贡献。",
    error: "无法更新社区，请重试。",
    perspective: "观点",
    reason: "理由",
    evidence: "证据",
    question: "问题",
    correction: "更正",
    misleading: "误导",
    abusive: "攻击性内容",
    spam: "垃圾内容",
    off_topic: "偏离主题",
    other: "其他",
  },
  "zh-TW": {
    title: "社群",
    subtitle: "補充背景、證據、問題或更正，而不只是表達反應。",
    contribute: "參與",
    signIn: "登入後參與",
    reader: "讀者",
    you: "你",
    source: "社群來源 ↗",
    sourceHint: "支持來源連結（可選）",
    bodyHint: "什麼資訊能幫助其他人更好理解這個事件？",
    submit: "發布貢獻",
    publishing: "正在發布…",
    showAll: "查看全部",
    showLess: "收起",
    withdraw: "撤回",
    withdrawTitle: "撤回這則貢獻？",
    withdrawBody: "撤回後將不再顯示在此事件的公開討論中。",
    cancel: "取消",
    confirmWithdraw: "撤回",
    report: "檢舉",
    reported: "已檢舉",
    retry: "重試",
    unavailable: "社群暫時無法使用。",
    empty: "目前沒有社群貢獻。",
    error: "無法更新社群，請再試一次。",
    perspective: "觀點",
    reason: "理由",
    evidence: "證據",
    question: "問題",
    correction: "更正",
    misleading: "誤導",
    abusive: "攻擊性內容",
    spam: "垃圾內容",
    off_topic: "偏離主題",
    other: "其他",
  },
} as const;

type CommunityState = {
  eventId: string;
  value: EventCommunity;
};

function contributionDate(value: string, language: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
  }).format(date);
}

export function EventCommunityPanel({
  eventId,
  returnTo,
}: {
  eventId: string;
  returnTo: string;
}) {
  const { ready, user } = useBrieflyAuth();
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const text = copy[language] ?? copy.en;

  const [communityState, setCommunityState] = useState<CommunityState | null>(null);
  const [failedEventId, setFailedEventId] = useState<string | null>(null);
  const [expandedState, setExpandedState] = useState({
    eventId,
    expanded: false,
  });
  const [composerState, setComposerState] = useState({
    eventId,
    open: false,
  });
  const [kind, setKind] =
    useState<CommunityContributionType>("perspective");
  const [body, setBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyReactionId, setBusyReactionId] = useState<number | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<number | null>(null);
  const [reportTarget, setReportTarget] = useState<number | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<number>>(() => new Set());

  const community =
    communityState?.eventId === eventId ? communityState.value : null;
  const failed = failedEventId === eventId;
  const expanded =
    expandedState.eventId === eventId && expandedState.expanded;
  const composerOpen =
    composerState.eventId === eventId && composerState.open;

  useEffect(() => {
    let active = true;

    void getEventCommunity(eventId)
      .then((value) => {
        if (!active) return;
        setCommunityState({ eventId, value });
        setFailedEventId((current) => (current === eventId ? null : current));
      })
      .catch(() => {
        if (active) setFailedEventId(eventId);
      });

    return () => {
      active = false;
    };
  }, [eventId]);

  const refresh = async () => {
    const value = await getEventCommunity(eventId);
    setCommunityState({ eventId, value });
    setFailedEventId((current) => (current === eventId ? null : current));
  };

  const startContributing = () => {
    if (!user) {
      router.push(`/sign-in?returnTo=${encodeURIComponent(returnTo)}` as never);
      return;
    }
    setKind("perspective");
    setBody("");
    setSourceUrl("");
    setComposerState({ eventId, open: true });
  };

  const submit = async () => {
    const normalizedBody = body.trim();
    if (!user || busy || normalizedBody.length < 8) return;

    setBusy(true);
    try {
      await createCommunityContribution(eventId, {
        contribution_type: kind,
        body: normalizedBody,
        source_url: sourceUrl.trim() || null,
      });
      trackProductEvent("community_contribution_create", {
        eventId,
        properties: { kind },
      });
      setComposerState({ eventId, open: false });
      setBody("");
      setSourceUrl("");
      await refresh();
    } catch {
      Alert.alert("Briefly", text.error);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (item: CommunityContribution) => {
    if (busy) return;
    setBusy(true);
    try {
      await withdrawCommunityContribution(item.contribution_id);
      trackProductEvent("community_contribution_withdraw", {
        eventId,
        properties: { kind: item.contribution_type },
      });
      setWithdrawTarget(null);
      await refresh();
    } catch {
      Alert.alert("Briefly", text.error);
    } finally {
      setBusy(false);
    }
  };

  const react = async (
    item: CommunityContribution,
    reaction: "up" | "down",
  ) => {
    if (!user) {
      router.push(`/sign-in?returnTo=${encodeURIComponent(returnTo)}` as never);
      return;
    }
    if (busyReactionId !== null) return;

    setBusyReactionId(item.contribution_id);
    try {
      const result = await setCommunityReaction(
        item.contribution_id,
        reaction,
      );
      setCommunityState((current) => {
        if (!current || current.eventId !== eventId) return current;
        return {
          ...current,
          value: {
            ...current.value,
            contributions: current.value.contributions.map((contribution) =>
              contribution.contribution_id === item.contribution_id
                ? {
                    ...contribution,
                    up_count: result.up_count,
                    down_count: result.down_count,
                    my_reaction: result.my_reaction,
                  }
                : contribution,
            ),
          },
        };
      });
      trackProductEvent("community_reaction", {
        eventId,
        properties: { reaction: result.my_reaction ?? "none" },
      });
    } catch {
      Alert.alert("Briefly", text.error);
    } finally {
      setBusyReactionId(null);
    }
  };

  const startReport = (item: CommunityContribution) => {
    if (!user) {
      router.push(`/sign-in?returnTo=${encodeURIComponent(returnTo)}` as never);
      return;
    }
    setReportTarget((current) =>
      current === item.contribution_id ? null : item.contribution_id,
    );
  };

  const report = async (
    item: CommunityContribution,
    reason: CommunityReportReason,
  ) => {
    if (!user || busy || reportedIds.has(item.contribution_id)) return;
    setBusy(true);
    try {
      await reportCommunityContribution(item.contribution_id, reason);
      trackProductEvent("community_contribution_report", {
        eventId,
        properties: { reason },
      });
      setReportedIds((current) => {
        const next = new Set(current);
        next.add(item.contribution_id);
        return next;
      });
      setReportTarget(null);
    } catch {
      Alert.alert("Briefly", text.error);
    } finally {
      setBusy(false);
    }
  };

  const contributions = community?.contributions ?? [];
  const visibleContributions = expanded
    ? contributions
    : contributions.slice(0, 5);
  const hasMore = contributions.length > 5;

  const typeLabel = (value: CommunityContributionType) => text[value];
  const reasonLabel = (value: CommunityReportReason) => text[value];

  const cards = visibleContributions.map((item) => ({
    item,
    date: contributionDate(item.created_at, language),
  }));

  return (
    <View style={[styles.section, { borderTopColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.headingCopy}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              {text.title}
            </Text>
            {!!community?.count && (
              <Text style={[styles.count, { color: colors.textMuted }]}>
                {community.count}
              </Text>
            )}
          </View>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {text.subtitle}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!ready || busy}
          onPress={startContributing}
          style={({ pressed }) => [
            styles.contributeButton,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: !ready || busy ? 0.55 : pressed ? 0.68 : 1,
            },
          ]}
        >
          <Text style={[styles.contributeText, { color: colors.text }]}>
            {user ? text.contribute : text.signIn}
          </Text>
        </Pressable>
      </View>

      {composerOpen && (
        <View
          style={[
            styles.composer,
            {
              borderColor: colors.border,
              backgroundColor: colors.surfaceMuted,
            },
          ]}
        >
          <View style={styles.chips}>
            {TYPES.map((value) => {
              const selected = kind === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setKind(value)}
                  style={[
                    styles.chip,
                    {
                      borderColor: selected ? colors.text : colors.border,
                      backgroundColor: selected ? colors.text : colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: selected ? colors.background : colors.textMuted,
                      },
                    ]}
                  >
                    {typeLabel(value)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            multiline
            maxLength={1600}
            value={body}
            onChangeText={setBody}
            placeholder={text.bodyHint}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.bodyInput,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          />
          <TextInput
            value={sourceUrl}
            onChangeText={setSourceUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder={text.sourceHint}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.sourceInput,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          />

          <View style={styles.composerActions}>
            <Pressable
              disabled={busy || body.trim().length < 8}
              onPress={() => void submit()}
              style={[
                styles.publishButton,
                { backgroundColor: colors.text },
                (busy || body.trim().length < 8) && styles.disabled,
              ]}
            >
              {busy && (
                <ActivityIndicator size="small" color={colors.background} />
              )}
              <Text style={[styles.publishText, { color: colors.background }]}>
                {busy ? text.publishing : text.submit}
              </Text>
            </Pressable>
            <Text style={[styles.charCount, { color: colors.textMuted }]}>
              {body.length}/1600
            </Text>
          </View>
        </View>
      )}

      {!community && !failed && (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      )}

      {failed && !community && (
        <View style={styles.failure}>
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            {text.unavailable}
          </Text>
          <Pressable onPress={() => void refresh()}>
            <Text style={[styles.retry, { color: colors.accent }]}>
              {text.retry}
            </Text>
          </Pressable>
        </View>
      )}

      {!!community && contributions.length === 0 && (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          {text.empty}
        </Text>
      )}

      <View style={styles.list}>
        {cards.map(({ item, date }) => {
          const reported = reportedIds.has(item.contribution_id);
          const withdrawing = withdrawTarget === item.contribution_id;
          const reporting = reportTarget === item.contribution_id;
          return (
            <View
              key={item.contribution_id}
              style={[
                styles.card,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <View style={styles.cardMeta}>
                <Text style={[styles.type, { color: colors.accent }]}>
                  {typeLabel(item.contribution_type)}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {item.is_mine ? text.you : text.reader}
                  {date ? ` · ${date}` : ""}
                </Text>
              </View>

              <Text style={[styles.body, { color: colors.text }]}>
                {item.body}
              </Text>

              {!!item.source_url && (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(item.source_url!)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Text style={[styles.sourceLink, { color: colors.accent }]}>
                    {text.source}
                  </Text>
                </Pressable>
              )}

              <View style={styles.cardActions}>
                <View style={styles.reactions}>
                  {(["up", "down"] as const).map((reaction) => {
                    const selected = item.my_reaction === reaction;
                    const count =
                      reaction === "up" ? item.up_count : item.down_count;
                    return (
                      <Pressable
                        key={reaction}
                        accessibilityRole="button"
                        accessibilityLabel={
                          reaction === "up"
                            ? "Helpful reaction"
                            : "Not helpful reaction"
                        }
                        accessibilityState={{ selected }}
                        disabled={busyReactionId !== null}
                        onPress={() => void react(item, reaction)}
                        style={({ pressed }) => [
                          styles.reactionButton,
                          {
                            borderColor: selected
                              ? colors.accent
                              : colors.border,
                            backgroundColor: selected
                              ? colors.surfaceMuted
                              : colors.surface,
                            opacity:
                              busyReactionId === item.contribution_id
                                ? 0.5
                                : pressed
                                  ? 0.68
                                  : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.reactionText,
                            {
                              color: selected
                                ? colors.accent
                                : colors.textMuted,
                            },
                          ]}
                        >
                          {reaction === "up" ? "👍" : "👎"} {count}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.ownerActions}>
                  {item.is_mine ? (
                    <Pressable
                      disabled={busy}
                      onPress={() =>
                        setWithdrawTarget((current) =>
                          current === item.contribution_id
                            ? null
                            : item.contribution_id,
                        )
                      }
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <Text
                        style={[styles.actionText, { color: colors.textMuted }]}
                      >
                        {text.withdraw}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      disabled={busy || reported}
                      onPress={() => startReport(item)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <Text
                        style={[styles.actionText, { color: colors.textMuted }]}
                      >
                        {reported ? text.reported : text.report}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {withdrawing && (
                <View
                  style={[
                    styles.withdrawConfirm,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceMuted,
                    },
                  ]}
                >
                  <View style={styles.withdrawConfirmCopy}>
                    <Text style={[styles.withdrawConfirmTitle, { color: colors.text }]}>
                      {text.withdrawTitle}
                    </Text>
                    <Text style={[styles.withdrawConfirmBody, { color: colors.textMuted }]}>
                      {text.withdrawBody}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[styles.withdrawPreview, { color: colors.textMuted }]}
                    >
                      “{item.body}”
                    </Text>
                  </View>
                  <View style={styles.withdrawConfirmActions}>
                    <Pressable
                      disabled={busy}
                      onPress={() => setWithdrawTarget(null)}
                      style={({ pressed }) => [
                        styles.withdrawCancel,
                        { borderColor: colors.border, opacity: pressed ? 0.68 : 1 },
                      ]}
                    >
                      <Text style={[styles.withdrawCancelText, { color: colors.text }]}>
                        {text.cancel}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={busy}
                      onPress={() => void withdraw(item)}
                      style={({ pressed }) => [
                        styles.withdrawConfirmButton,
                        {
                          backgroundColor: colors.text,
                          opacity: busy ? 0.55 : pressed ? 0.75 : 1,
                        },
                      ]}
                    >
                      {busy && (
                        <ActivityIndicator size="small" color={colors.background} />
                      )}
                      <Text
                        style={[
                          styles.withdrawConfirmButtonText,
                          { color: colors.background },
                        ]}
                      >
                        {text.confirmWithdraw}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {reporting && !reported && (
                <View style={styles.reportReasons}>
                  {REPORT_REASONS.map((reason) => (
                    <Pressable
                      key={reason}
                      disabled={busy}
                      onPress={() => void report(item, reason)}
                      style={[
                        styles.reportReason,
                        { borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.reportReasonText,
                          { color: colors.textMuted },
                        ]}
                      >
                        {reasonLabel(reason)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {hasMore && (
        <Pressable
          onPress={() =>
            setExpandedState({ eventId, expanded: !expanded })
          }
          style={({ pressed }) => [
            styles.showMore,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.showMoreText, { color: colors.accent }]}>
            {expanded ? text.showLess : text.showAll}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 44,
    paddingTop: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 14,
  },
  headingCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 320, gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "900" },
  count: { fontSize: 12, fontWeight: "800" },
  subtitle: { fontSize: 14, lineHeight: 21, maxWidth: 620 },
  contributeButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  contributeText: { fontSize: 13, fontWeight: "900" },
  composer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 11, fontWeight: "800" },
  bodyInput: {
    minHeight: 118,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  sourceInput: {
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  composerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  publishButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  publishText: { fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  charCount: { fontSize: 11, fontWeight: "700" },
  loading: { marginVertical: 14 },
  failure: { flexDirection: "row", gap: 12, alignItems: "center" },
  retry: { fontSize: 13, fontWeight: "900" },
  empty: { fontSize: 14, lineHeight: 21 },
  list: { gap: 10 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  cardMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  type: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  meta: { fontSize: 11, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 23 },
  sourceLink: { fontSize: 12, fontWeight: "800" },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  reactions: { flexDirection: "row", gap: 7 },
  reactionButton: {
    minHeight: 32,
    minWidth: 54,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionText: { fontSize: 12, fontWeight: "800" },
  ownerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionText: { fontSize: 12, fontWeight: "800" },
  withdrawConfirm: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  withdrawConfirmCopy: { gap: 4 },
  withdrawConfirmTitle: { fontSize: 13, fontWeight: "900" },
  withdrawConfirmBody: { fontSize: 12, lineHeight: 18 },
  withdrawPreview: { fontSize: 12, lineHeight: 18, fontStyle: "italic" },
  withdrawConfirmActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  withdrawCancel: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  withdrawCancelText: { fontSize: 12, fontWeight: "800" },
  withdrawConfirmButton: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  withdrawConfirmButtonText: { fontSize: 12, fontWeight: "900" },
  reportReasons: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reportReason: {
    minHeight: 30,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  reportReasonText: { fontSize: 11, fontWeight: "700" },
  showMore: { alignSelf: "flex-start", paddingVertical: 4 },
  showMoreText: { fontSize: 13, fontWeight: "900" },
});

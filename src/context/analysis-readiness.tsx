import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  getLazyCanonicalArticleByEventId,
  getPodcastAnalysisStatus,
} from "@/api/briefly";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";
const POLL_MS = 5000;
const STORAGE_KEY_PREFIX = "briefly.generation-notifications.v1";

type PendingAnalysis =
  | {
      type: "article";
      eventId: string;
      headline: string;
      href: string;
      kind?: "initial" | "refresh";
      baseVersionId?: number | null;
    }
  | {
      type: "podcast";
      articleVersionId: number;
      language: string;
      headline: string;
      href: string;
    };

type ReadyAnalysis = PendingAnalysis;

type StoredNotifications = {
  pending: Record<string, PendingAnalysis>;
  ready: ReadyAnalysis[];
};

type NotificationState = StoredNotifications & {
  ownerKey: string | null;
  expanded: boolean;
};

type AnalysisReadinessContextValue = {
  watchAnalysis: (
    item: Omit<Extract<PendingAnalysis, { type: "article" }>, "type">,
  ) => void;
  watchPodcast: (
    item: Omit<Extract<PendingAnalysis, { type: "podcast" }>, "type">,
  ) => void;
};

const AnalysisReadinessContext =
  createContext<AnalysisReadinessContextValue | null>(null);

const copy = {
  en: {
    ready: "Ready to read",
    updated: "Updated analysis ready",
    podcast: "Podcast ready",
    more: "more items are ready",
    notifications: "Generation notifications",
    clear: "Clear",
    collapse: "Collapse",
  },
  es: {
    ready: "Listo para leer",
    updated: "Análisis actualizado listo",
    podcast: "Pódcast listo",
    more: "elementos más están listos",
    notifications: "Notificaciones de generación",
    clear: "Borrar",
    collapse: "Ocultar",
  },
  ja: {
    ready: "読めるようになりました",
    updated: "更新版の分析ができました",
    podcast: "ポッドキャストの準備ができました",
    more: "件の項目も準備できました",
    notifications: "生成通知",
    clear: "クリア",
    collapse: "閉じる",
  },
  "zh-CN": {
    ready: "已可阅读",
    updated: "更新分析已准备好",
    podcast: "播客已准备好",
    more: "项内容也已准备好",
    notifications: "生成通知",
    clear: "清除",
    collapse: "收起",
  },
  "zh-TW": {
    ready: "已可閱讀",
    updated: "更新分析已準備好",
    podcast: "Podcast 已準備好",
    more: "項內容也已準備好",
    notifications: "產生通知",
    clear: "清除",
    collapse: "收起",
  },
} as const;

function storageKey(ownerKey: string) {
  return `${STORAGE_KEY_PREFIX}:${ownerKey}`;
}

async function readStoredNotifications(
  ownerKey: string,
): Promise<StoredNotifications> {
  const raw = await AsyncStorage.getItem(storageKey(ownerKey));
  if (!raw) return { pending: {}, ready: [] };

  try {
    const parsed = JSON.parse(raw) as Partial<StoredNotifications>;
    return {
      pending:
        parsed.pending && typeof parsed.pending === "object"
          ? parsed.pending
          : {},
      ready: Array.isArray(parsed.ready) ? parsed.ready : [],
    };
  } catch {
    return { pending: {}, ready: [] };
  }
}

async function writeStoredNotifications(
  ownerKey: string,
  pending: Record<string, PendingAnalysis>,
  ready: ReadyAnalysis[],
) {
  await AsyncStorage.setItem(
    storageKey(ownerKey),
    JSON.stringify({ pending, ready } satisfies StoredNotifications),
  );
}

export function AnalysisReadinessProvider({ children }: PropsWithChildren) {
  const { ready: authReady, user } = useBrieflyAuth();
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const labels = copy[language] ?? copy.en;
  const ownerKey = user ? `user:${user.id}` : "guest";

  const [state, setState] = useState<NotificationState>({
    ownerKey: null,
    pending: {},
    ready: [],
    expanded: false,
  });

  const keyFor = useCallback((item: PendingAnalysis) => {
    return item.type === "podcast"
      ? `podcast:${item.articleVersionId}:${item.language}`
      : `article:${item.eventId}:${item.baseVersionId ?? "initial"}`;
  }, []);

  useEffect(() => {
    if (!authReady) return;

    let active = true;

    void readStoredNotifications(ownerKey).then((stored) => {
      if (!active) return;
      setState({
        ownerKey,
        pending: stored.pending,
        ready: stored.ready,
        expanded: false,
      });
    });

    return () => {
      active = false;
    };
  }, [authReady, ownerKey]);

  const storageReady = authReady && state.ownerKey === ownerKey;
  const pending = storageReady ? state.pending : {};
  const ready = storageReady ? state.ready : [];
  const expanded = storageReady ? state.expanded : false;

  useEffect(() => {
    if (!storageReady) return;
    void writeStoredNotifications(ownerKey, pending, ready);
  }, [ownerKey, pending, ready, storageReady]);

  const watchAnalysis = useCallback(
    (item: Omit<Extract<PendingAnalysis, { type: "article" }>, "type">) => {
      if (!storageReady) return;

      const next: PendingAnalysis = { ...item, type: "article" };
      const key = keyFor(next);
      setState((current) => {
        if (current.ownerKey !== ownerKey) return current;
        const existing = current.pending[key];
        if (existing?.headline === next.headline && existing?.href === next.href) {
          return current;
        }
        return {
          ...current,
          pending: { ...current.pending, [key]: next },
        };
      });
    },
    [keyFor, ownerKey, storageReady],
  );

  const watchPodcast = useCallback(
    (item: Omit<Extract<PendingAnalysis, { type: "podcast" }>, "type">) => {
      if (!storageReady) return;

      const next: PendingAnalysis = { ...item, type: "podcast" };
      const key = keyFor(next);
      setState((current) => {
        if (current.ownerKey !== ownerKey) return current;
        const existing = current.pending[key];
        if (existing?.headline === next.headline && existing?.href === next.href) {
          return current;
        }
        return {
          ...current,
          pending: { ...current.pending, [key]: next },
        };
      });
    },
    [keyFor, ownerKey, storageReady],
  );

  useEffect(() => {
    if (!storageReady) return;

    const entries = Object.values(pending);
    if (entries.length === 0) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      const completed: ReadyAnalysis[] = [];
      const terminalFailures: PendingAnalysis[] = [];

      await Promise.all(
        entries.map(async (item) => {
          try {
            if (item.type === "podcast") {
              const podcast = await getPodcastAnalysisStatus(
                item.articleVersionId,
                item.language,
              );
              if (podcast.status === "ready") completed.push(item);
              else if (podcast.status === "failed") terminalFailures.push(item);
              return;
            }

            const article = await getLazyCanonicalArticleByEventId(item.eventId, {
              includeDraft: PREVIEW_DRAFTS,
              language: "en",
            });
            const nextVersionId = article.article_version_id;
            const isReady =
              item.baseVersionId != null
                ? nextVersionId != null && nextVersionId !== item.baseVersionId
                : nextVersionId != null;

            if (isReady) {
              completed.push(item);
            } else if (
              article.generation_status === "failed" ||
              article.generation_status === "disabled"
            ) {
              terminalFailures.push(item);
            }
          } catch {
            // Keep watching transient request failures.
          }
        }),
      );

      if (!active) return;

      if (completed.length > 0 || terminalFailures.length > 0) {
        const completedKeys = new Set(
          [...completed, ...terminalFailures].map(keyFor),
        );
        setState((current) => {
          if (current.ownerKey !== ownerKey) return current;
          const known = new Set(current.ready.map(keyFor));
          return {
            ...current,
            pending: Object.fromEntries(
              Object.entries(current.pending).filter(
                ([key]) => !completedKeys.has(key),
              ),
            ),
            ready: [
              ...current.ready,
              ...completed.filter((item) => !known.has(keyFor(item))),
            ],
          };
        });
      }

      timer = setTimeout(() => void poll(), POLL_MS);
    };

    timer = setTimeout(() => void poll(), POLL_MS);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [keyFor, ownerKey, pending, storageReady]);

  const value = useMemo(
    () => ({ watchAnalysis, watchPodcast }),
    [watchAnalysis, watchPodcast],
  );
  const visibleReady = ready.slice(-4).reverse();

  const openReady = (item: ReadyAnalysis) => {
    setState((current) => {
      if (current.ownerKey !== ownerKey) return current;
      const nextReady = current.ready.filter(
        (candidate) => keyFor(candidate) !== keyFor(item),
      );
      return {
        ...current,
        ready: nextReady,
        expanded: nextReady.length > 0 ? current.expanded : false,
      };
    });
    router.push(item.href as never);
  };

  const clearReady = () => {
    setState((current) =>
      current.ownerKey === ownerKey
        ? { ...current, ready: [], expanded: false }
        : current,
    );
  };

  return (
    <AnalysisReadinessContext.Provider value={value}>
      {children}

      {ready.length > 0 ? (
        <View pointerEvents="box-none" style={styles.overlay}>
          {expanded ? (
            <View
              style={[
                styles.tray,
                {
                  backgroundColor: colors.text,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.trayHeader}>
                <Text style={[styles.kicker, { color: colors.background }]}>
                  {labels.notifications}
                </Text>
                <View style={styles.headerActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={clearReady}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <Text style={[styles.headerAction, { color: colors.background }]}>
                      {labels.clear}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={labels.collapse}
                    onPress={() =>
                      setState((current) =>
                        current.ownerKey === ownerKey
                          ? { ...current, expanded: false }
                          : current,
                      )
                    }
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <Text style={[styles.headerAction, { color: colors.background }]}>↓</Text>
                  </Pressable>
                </View>
              </View>

              {visibleReady.map((item) => (
                <Pressable
                  key={keyFor(item)}
                  accessibilityRole="button"
                  onPress={() => openReady(item)}
                  style={({ pressed }) => [
                    styles.readyRow,
                    { opacity: pressed ? 0.76 : 1 },
                  ]}
                >
                  <View style={styles.readyCopy}>
                    <Text
                      style={[styles.rowKicker, { color: colors.background }]}
                      numberOfLines={1}
                    >
                      {item.type === "podcast"
                        ? labels.podcast
                        : item.kind === "refresh"
                          ? labels.updated
                          : labels.ready}
                    </Text>
                    <Text
                      style={[styles.headline, { color: colors.background }]}
                      numberOfLines={2}
                    >
                      {item.headline}
                    </Text>
                  </View>
                  <Text style={[styles.arrow, { color: colors.background }]}>→</Text>
                </Pressable>
              ))}

              {ready.length > visibleReady.length ? (
                <Text style={[styles.more, { color: colors.background }]}>
                  +{ready.length - visibleReady.length} {labels.more}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${labels.notifications}: ${ready.length}`}
            onPress={() =>
              setState((current) =>
                current.ownerKey === ownerKey
                  ? { ...current, expanded: !current.expanded }
                  : current,
              )
            }
            style={({ pressed }) => [
              styles.bubble,
              {
                backgroundColor: colors.text,
                borderColor: colors.border,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            <Text style={styles.bell}>🔔</Text>
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={styles.badgeText}>{ready.length > 99 ? "99+" : ready.length}</Text>
            </View>
          </Pressable>
        </View>
      ) : null}
    </AnalysisReadinessContext.Provider>
  );
}

export function useAnalysisReadiness() {
  const value = useContext(AnalysisReadinessContext);
  if (!value) {
    throw new Error(
      "useAnalysisReadiness must be used inside AnalysisReadinessProvider",
    );
  }
  return value;
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 14,
    bottom: 18,
    alignItems: "flex-start",
    gap: 8,
  },
  tray: {
    width: 360,
    maxWidth: "92%",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 8,
  },
  trayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerAction: { fontSize: 12, fontWeight: "900" },
  kicker: { flex: 1, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  readyRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  readyCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowKicker: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    opacity: 0.78,
  },
  headline: { fontSize: 15, lineHeight: 20, fontWeight: "800" },
  more: { marginTop: 2, fontSize: 11, opacity: 0.78 },
  arrow: { fontSize: 22, fontWeight: "700" },
  bubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  bell: { fontSize: 22 },
  badge: {
    position: "absolute",
    right: -4,
    top: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
});
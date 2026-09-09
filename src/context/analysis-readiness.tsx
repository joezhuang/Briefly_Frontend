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

import { getLazyCanonicalArticleByEventId } from "@/api/briefly";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

const PREVIEW_DRAFTS =
  process.env.EXPO_PUBLIC_BRIEFLY_INCLUDE_DRAFTS === "true";
const POLL_MS = 5000;

type PendingAnalysis = {
  eventId: string;
  headline: string;
  href: string;
  kind?: "initial" | "refresh";
  baseVersionId?: number | null;
};

type ReadyAnalysis = PendingAnalysis;

type AnalysisReadinessContextValue = {
  watchAnalysis: (item: PendingAnalysis) => void;
};

const AnalysisReadinessContext =
  createContext<AnalysisReadinessContextValue | null>(null);

const copy = {
  en: {
    ready: "Ready to read",
    updated: "Updated analysis ready",
    more: "more analyses are ready",
  },
  es: {
    ready: "Listo para leer",
    updated: "Análisis actualizado listo",
    more: "análisis más están listos",
  },
  ja: {
    ready: "読めるようになりました",
    updated: "更新版の分析ができました",
    more: "件の分析も準備できました",
  },
  "zh-CN": {
    ready: "已可阅读",
    updated: "更新分析已准备好",
    more: "篇分析也已准备好",
  },
  "zh-TW": {
    ready: "已可閱讀",
    updated: "更新分析已準備好",
    more: "篇分析也已準備好",
  },
} as const;

export function AnalysisReadinessProvider({ children }: PropsWithChildren) {
  const { language } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const labels = copy[language] ?? copy.en;

  const [pending, setPending] = useState<Record<string, PendingAnalysis>>({});
  const [ready, setReady] = useState<ReadyAnalysis[]>([]);

  const watchAnalysis = useCallback((item: PendingAnalysis) => {
    const key = `${item.eventId}:${item.baseVersionId ?? "initial"}`;
    setPending((current) => {
      const existing = current[key];
      if (
        existing?.headline === item.headline &&
        existing?.href === item.href &&
        existing?.kind === item.kind
      ) {
        return current;
      }
      return { ...current, [key]: item };
    });
  }, []);

  useEffect(() => {
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
            const article = await getLazyCanonicalArticleByEventId(item.eventId, {
              includeDraft: PREVIEW_DRAFTS,
              language: "en",
            });
            const nextVersionId = article.article_version_id;
            const ready =
              item.baseVersionId != null
                ? nextVersionId != null && nextVersionId !== item.baseVersionId
                : nextVersionId != null;

            if (ready) {
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
          [...completed, ...terminalFailures].map(
            (item) => `${item.eventId}:${item.baseVersionId ?? "initial"}`,
          ),
        );
        setPending((current) =>
          Object.fromEntries(
            Object.entries(current).filter(
              ([key]) => !completedKeys.has(key),
            ),
          ),
        );
        setReady((current) => {
          const known = new Set(
            current.map(
              (item) => `${item.eventId}:${item.baseVersionId ?? "initial"}`,
            ),
          );
          return [
            ...current,
            ...completed.filter(
              (item) =>
                !known.has(
                  `${item.eventId}:${item.baseVersionId ?? "initial"}`,
                ),
            ),
          ];
        });
      }

      timer = setTimeout(() => void poll(), POLL_MS);
    };

    timer = setTimeout(() => void poll(), POLL_MS);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [pending]);

  const value = useMemo(() => ({ watchAnalysis }), [watchAnalysis]);
  const visibleReady = ready.slice(-3).reverse();

  const openReady = (item: ReadyAnalysis) => {
    setReady((current) =>
      current.filter(
        (candidate) =>
          !(
            candidate.eventId === item.eventId &&
            candidate.baseVersionId === item.baseVersionId
          ),
      ),
    );
    router.push(item.href as never);
  };

  return (
    <AnalysisReadinessContext.Provider value={value}>
      {children}

      {visibleReady.length > 0 ? (
        <View pointerEvents="box-none" style={styles.overlay}>
          <View
            style={[
              styles.tray,
              {
                backgroundColor: colors.text,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.kicker, { color: colors.background }]}>
              {visibleReady.length === 1
                ? labels.ready
                : `${ready.length} ${labels.more}`}
            </Text>

            {visibleReady.map((item) => (
              <Pressable
                key={`${item.eventId}:${item.baseVersionId ?? "initial"}`}
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
                    {item.kind === "refresh" ? labels.updated : labels.ready}
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
    right: 14,
    bottom: 18,
    alignItems: "center",
  },
  tray: {
    width: "100%",
    maxWidth: 520,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 8,
  },
  kicker: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
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
});

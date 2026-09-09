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
    more: "more analyses are ready",
  },
  es: {
    ready: "Listo para leer",
    more: "análisis más están listos",
  },
  ja: {
    ready: "読めるようになりました",
    more: "件の分析も準備できました",
  },
  "zh-CN": {
    ready: "已可阅读",
    more: "篇分析也已准备好",
  },
  "zh-TW": {
    ready: "已可閱讀",
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
    setPending((current) => {
      const existing = current[item.eventId];
      if (
        existing?.headline === item.headline &&
        existing?.href === item.href
      ) {
        return current;
      }
      return { ...current, [item.eventId]: item };
    });
  }, []);

  useEffect(() => {
    const entries = Object.values(pending);
    if (entries.length === 0) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      const completed: ReadyAnalysis[] = [];

      await Promise.all(
        entries.map(async (item) => {
          try {
            const article = await getLazyCanonicalArticleByEventId(item.eventId, {
              includeDraft: PREVIEW_DRAFTS,
              language: "en",
            });
            if (article.article_version_id != null) {
              completed.push(item);
            }
          } catch {
            // Keep watching transient request failures.
          }
        }),
      );

      if (!active) return;

      if (completed.length > 0) {
        const completedIds = new Set(completed.map((item) => item.eventId));
        setPending((current) =>
          Object.fromEntries(
            Object.entries(current).filter(
              ([eventId]) => !completedIds.has(eventId),
            ),
          ),
        );
        setReady((current) => {
          const known = new Set(current.map((item) => item.eventId));
          return [
            ...current,
            ...completed.filter((item) => !known.has(item.eventId)),
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
  const latestReady = ready[ready.length - 1];

  const openReady = () => {
    if (!latestReady) return;
    setReady((current) =>
      current.filter((item) => item.eventId !== latestReady.eventId),
    );
    router.push(latestReady.href as never);
  };

  return (
    <AnalysisReadinessContext.Provider value={value}>
      {children}

      {latestReady ? (
        <View pointerEvents="box-none" style={styles.overlay}>
          <Pressable
            accessibilityRole="button"
            onPress={openReady}
            style={({ pressed }) => [
              styles.bubble,
              {
                backgroundColor: colors.text,
                borderColor: colors.border,
                opacity: pressed ? 0.86 : 1,
              },
            ]}
          >
            <View style={styles.copy}>
              <Text
                style={[styles.kicker, { color: colors.background }]}
                numberOfLines={1}
              >
                {labels.ready}
              </Text>
              <Text
                style={[styles.headline, { color: colors.background }]}
                numberOfLines={2}
              >
                {latestReady.headline}
              </Text>
              {ready.length > 1 ? (
                <Text
                  style={[styles.more, { color: colors.background }]}
                  numberOfLines={1}
                >
                  +{ready.length - 1} {labels.more}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.arrow, { color: colors.background }]}>→</Text>
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
    right: 14,
    bottom: 18,
    alignItems: "center",
  },
  bubble: {
    width: "100%",
    maxWidth: 520,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  headline: { fontSize: 15, lineHeight: 20, fontWeight: "800" },
  more: { marginTop: 2, fontSize: 11, opacity: 0.78 },
  arrow: { fontSize: 22, fontWeight: "700" },
});

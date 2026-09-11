import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useBrieflyAuth } from "@/context/auth";
import type { CanonicalArticle } from "@/models/article";
import {
  clearReadingHistoryStorage,
  readReadingHistory,
  READING_HISTORY_LIMIT,
  type ReadingHistoryItem,
  writeReadingHistory,
} from "@/storage/reading-history";

type ReadingHistoryContextValue = {
  items: ReadingHistoryItem[];
  ready: boolean;
  recordArticle: (article: CanonicalArticle, href: string) => Promise<void>;
  clearHistory: () => Promise<void>;
};

type ReadingHistoryState = {
  ownerKey: string | null;
  items: ReadingHistoryItem[];
};

const ReadingHistoryContext =
  createContext<ReadingHistoryContextValue | null>(null);

export function ReadingHistoryProvider({ children }: PropsWithChildren) {
  const { ready: authReady, user } = useBrieflyAuth();
  const ownerKey = user ? `user:${user.id}` : "guest";
  const [state, setState] = useState<ReadingHistoryState>({
    ownerKey: null,
    items: [],
  });

  useEffect(() => {
    if (!authReady) return;

    let active = true;

    void readReadingHistory(ownerKey).then((items) => {
      if (!active) return;
      setState({ ownerKey, items });
    });

    return () => {
      active = false;
    };
  }, [authReady, ownerKey]);

  const ready = authReady && state.ownerKey === ownerKey;
  const items = useMemo(
    () => (ready ? state.items : [] as ReadingHistoryItem[]),
    [ready, state.items],
  );

  const recordArticle = useCallback(
    async (article: CanonicalArticle, href: string) => {
      if (!ready) return;

      const nextItem: ReadingHistoryItem = {
        event_id: article.event_id,
        article_version_id: article.article_version_id,
        slug: article.slug,
        headline: article.headline,
        standfirst: article.standfirst,
        image_url: article.image_url,
        source_count: article.source_count,
        category: article.category,
        opened_at: new Date().toISOString(),
        href,
      };

      setState((current) => {
        if (current.ownerKey !== ownerKey) return current;
        const next = [
          nextItem,
          ...current.items.filter((item) => item.event_id !== article.event_id),
        ].slice(0, READING_HISTORY_LIMIT);
        void writeReadingHistory(ownerKey, next);
        return { ownerKey, items: next };
      });
    },
    [ownerKey, ready],
  );

  const clearHistory = useCallback(async () => {
    setState((current) =>
      current.ownerKey === ownerKey ? { ownerKey, items: [] } : current,
    );
    await clearReadingHistoryStorage(ownerKey);
  }, [ownerKey]);

  const value = useMemo(
    () => ({ items, ready, recordArticle, clearHistory }),
    [clearHistory, items, ready, recordArticle],
  );

  return (
    <ReadingHistoryContext.Provider value={value}>
      {children}
    </ReadingHistoryContext.Provider>
  );
}

export function useReadingHistory() {
  const value = useContext(ReadingHistoryContext);
  if (!value) {
    throw new Error(
      "useReadingHistory must be used inside ReadingHistoryProvider",
    );
  }
  return value;
}

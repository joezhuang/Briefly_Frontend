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

const ReadingHistoryContext =
  createContext<ReadingHistoryContextValue | null>(null);

export function ReadingHistoryProvider({ children }: PropsWithChildren) {
  const { ready: authReady, user } = useBrieflyAuth();
  const [items, setItems] = useState<ReadingHistoryItem[]>([]);
  const [ready, setReady] = useState(false);
  const ownerKey = user ? `user:${user.id}` : "guest";

  useEffect(() => {
    if (!authReady) return;

    let active = true;
    setReady(false);
    setItems([]);

    readReadingHistory(ownerKey)
      .then((next) => {
        if (active) setItems(next);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, [authReady, ownerKey]);

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

      setItems((current) => {
        const next = [
          nextItem,
          ...current.filter((item) => item.event_id !== article.event_id),
        ].slice(0, READING_HISTORY_LIMIT);
        void writeReadingHistory(ownerKey, next);
        return next;
      });
    },
    [ownerKey, ready],
  );

  const clearHistory = useCallback(async () => {
    setItems([]);
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

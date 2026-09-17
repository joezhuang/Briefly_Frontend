import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { trackProductEvent } from "@/analytics/product-analytics";
import { useBrieflyAuth } from "@/context/auth";
import type { CanonicalArticle } from "@/models/article";
import {
  clearReadingHistoryStorage,
  readReadingHistory,
  READING_HISTORY_LIMIT,
  type ReadingHistoryItem,
  writeReadingHistory,
} from "@/storage/reading-history";
import {
  readSyncedUserState,
  writeSyncedUserState,
} from "@/sync/user-state";

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

function validHistory(value: unknown): ReadingHistoryItem[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter(
      (item): item is ReadingHistoryItem =>
        !!item &&
        typeof item === "object" &&
        typeof (item as ReadingHistoryItem).event_id === "string" &&
        typeof (item as ReadingHistoryItem).slug === "string" &&
        typeof (item as ReadingHistoryItem).headline === "string" &&
        typeof (item as ReadingHistoryItem).opened_at === "string" &&
        typeof (item as ReadingHistoryItem).href === "string",
    )
    .slice(0, READING_HISTORY_LIMIT);
}

export function ReadingHistoryProvider({ children }: PropsWithChildren) {
  const { ready: authReady, user } = useBrieflyAuth();
  const ownerKey = user ? `user:${user.id}` : "guest";
  const syncOwnerRef = useRef<string | null>(null);
  const [state, setState] = useState<ReadingHistoryState>({
    ownerKey: null,
    items: [],
  });

  useEffect(() => {
    if (!authReady) return;

    let active = true;
    syncOwnerRef.current = null;

    const load = async () => {
      const localItems = await readReadingHistory(ownerKey);
      let nextItems = localItems;

      if (user) {
        try {
          const remote = await readSyncedUserState<ReadingHistoryItem[]>(
            user.id,
            "reading_history",
          );
          if (!active) return;
          syncOwnerRef.current = ownerKey;
          const remoteItems = validHistory(remote.value);
          if (remote.exists && remoteItems) {
            nextItems = remoteItems;
          }
        } catch (error) {
          console.warn("Briefly reading history sync unavailable", error);
        }
      }

      if (!active) return;
      setState({ ownerKey, items: nextItems });
      await writeReadingHistory(ownerKey, nextItems);
    };

    void load();

    return () => {
      active = false;
    };
  }, [authReady, ownerKey, user]);

  const ready = authReady && state.ownerKey === ownerKey;
  const items = useMemo(
    () => (ready ? state.items : [] as ReadingHistoryItem[]),
    [ready, state.items],
  );

  useEffect(() => {
    if (!ready) return;
    void writeReadingHistory(ownerKey, items);
    if (user && syncOwnerRef.current === ownerKey) {
      void writeSyncedUserState(user.id, "reading_history", items).catch(
        (error) => {
          console.warn("Briefly reading history sync failed", error);
        },
      );
    }
  }, [items, ownerKey, ready, user]);

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
        return { ownerKey, items: next };
      });

      trackProductEvent("story_open", {
        eventId: article.event_id,
        articleVersionId: article.article_version_id,
        properties: {
          source: href.includes("savedSnapshotId=") ? "saved" : "story",
          language: article.requested_language ?? article.language,
          content_language: article.content_language ?? article.language,
          canonical_stale: article.canonical_stale === true,
        },
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

import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { CanonicalArticle, SavedArticleSnapshot } from "@/models/article";
import { readSavedSnapshots, snapshotIdFor, toSavedSnapshot, writeSavedSnapshots } from "@/storage/saved-articles";

type SavedContextValue = {
  snapshots: SavedArticleSnapshot[];
  ready: boolean;
  isSaved: (article: CanonicalArticle) => boolean;
  toggleSaved: (article: CanonicalArticle) => Promise<boolean>;
  removeSaved: (snapshotId: string) => Promise<void>;
};

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedArticlesProvider({ children }: PropsWithChildren) {
  const [snapshots, setSnapshots] = useState<SavedArticleSnapshot[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    readSavedSnapshots().then(setSnapshots).finally(() => setReady(true));
  }, []);

  const persist = useCallback(async (next: SavedArticleSnapshot[]) => {
    setSnapshots(next);
    await writeSavedSnapshots(next);
  }, []);

  const isSaved = useCallback(
    (article: CanonicalArticle) => snapshots.some((item) => item.snapshot_id === snapshotIdFor(article)),
    [snapshots],
  );

  const toggleSaved = useCallback(async (article: CanonicalArticle) => {
    const id = snapshotIdFor(article);
    const exists = snapshots.some((item) => item.snapshot_id === id);
    const next = exists
      ? snapshots.filter((item) => item.snapshot_id !== id)
      : [toSavedSnapshot(article), ...snapshots];
    await persist(next);
    return !exists;
  }, [persist, snapshots]);

  const removeSaved = useCallback(async (snapshotId: string) => {
    await persist(snapshots.filter((item) => item.snapshot_id !== snapshotId));
  }, [persist, snapshots]);

  const value = useMemo(
    () => ({ snapshots, ready, isSaved, toggleSaved, removeSaved }),
    [snapshots, ready, isSaved, toggleSaved, removeSaved],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSavedArticles() {
  const value = useContext(SavedContext);
  if (!value) throw new Error("useSavedArticles must be used inside SavedArticlesProvider");
  return value;
}

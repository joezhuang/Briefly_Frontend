import AsyncStorage from "@react-native-async-storage/async-storage";

import type { CanonicalArticle, SavedArticleSnapshot } from "@/models/article";

const STORAGE_KEY = "briefly.saved-article-snapshots.v1";

export function snapshotIdFor(article: CanonicalArticle) {
  return `article-version-${article.article_version_id}`;
}

export function toSavedSnapshot(article: CanonicalArticle): SavedArticleSnapshot {
  return {
    ...article,
    snapshot_id: snapshotIdFor(article),
    saved_at: new Date().toISOString(),
    body: (article.body ?? []).map((block) => ({ ...block })),
    uncertainties: [...(article.uncertainties ?? [])],
    sources_used: (article.sources_used ?? []).map((source) => ({ ...source })),
  };
}

export async function readSavedSnapshots(): Promise<SavedArticleSnapshot[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SavedArticleSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeSavedSnapshots(items: SavedArticleSnapshot[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

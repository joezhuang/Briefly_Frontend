import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY_PREFIX = "briefly.reading-history.v2";
export const READING_HISTORY_LIMIT = 10;

export type ReadingHistoryItem = {
  event_id: string;
  article_version_id: number | null;
  slug: string;
  headline: string;
  standfirst: string;
  image_url?: string | null;
  source_count?: number | null;
  category?: string | null;
  opened_at: string;
  href: string;
};

function storageKey(ownerKey: string) {
  return `${STORAGE_KEY_PREFIX}:${ownerKey}`;
}

export async function readReadingHistory(
  ownerKey: string,
): Promise<ReadingHistoryItem[]> {
  const raw = await AsyncStorage.getItem(storageKey(ownerKey));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as ReadingHistoryItem[];
    return Array.isArray(parsed) ? parsed.slice(0, READING_HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

export async function writeReadingHistory(
  ownerKey: string,
  items: ReadingHistoryItem[],
) {
  await AsyncStorage.setItem(
    storageKey(ownerKey),
    JSON.stringify(items.slice(0, READING_HISTORY_LIMIT)),
  );
}

export async function clearReadingHistoryStorage(ownerKey: string) {
  await AsyncStorage.removeItem(storageKey(ownerKey));
}

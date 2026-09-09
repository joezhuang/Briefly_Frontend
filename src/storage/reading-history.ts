import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "briefly.reading-history.v1";
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

export async function readReadingHistory(): Promise<ReadingHistoryItem[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as ReadingHistoryItem[];
    return Array.isArray(parsed) ? parsed.slice(0, READING_HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

export async function writeReadingHistory(items: ReadingHistoryItem[]) {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(items.slice(0, READING_HISTORY_LIMIT)),
  );
}

export async function clearReadingHistoryStorage() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

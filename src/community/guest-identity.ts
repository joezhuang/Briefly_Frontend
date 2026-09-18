import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const STORAGE_KEY = "briefly.community.guest-id";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let cachedGuestId: string | null = null;
let guestIdPromise: Promise<string> | null = null;

export async function getCommunityGuestId(): Promise<string> {
  if (cachedGuestId) return cachedGuestId;
  if (guestIdPromise) return guestIdPromise;

  guestIdPromise = (async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    if (stored && UUID_PATTERN.test(stored)) {
      cachedGuestId = stored;
      return stored;
    }

    const created = Crypto.randomUUID();
    cachedGuestId = created;
    await AsyncStorage.setItem(STORAGE_KEY, created).catch(() => null);
    return created;
  })().finally(() => {
    guestIdPromise = null;
  });

  return guestIdPromise;
}

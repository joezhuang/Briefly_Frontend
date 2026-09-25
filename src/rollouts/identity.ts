import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

const STORAGE_KEY = "briefly.rollout-id.v1";

let rolloutId: string | null = null;
let rolloutIdPromise: Promise<string> | null = null;

function validRolloutId(value: string | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length >= 8 && normalized.length <= 128
    ? normalized
    : null;
}

export async function getBrieflyRolloutId() {
  if (rolloutId) return rolloutId;
  if (rolloutIdPromise) return rolloutIdPromise;

  rolloutIdPromise = (async () => {
    const stored = validRolloutId(
      await AsyncStorage.getItem(STORAGE_KEY).catch(() => null),
    );
    if (stored) {
      rolloutId = stored;
      return stored;
    }

    const created = Crypto.randomUUID();
    rolloutId = created;
    await AsyncStorage.setItem(STORAGE_KEY, created).catch(() => undefined);
    return created;
  })();

  try {
    return await rolloutIdPromise;
  } finally {
    rolloutIdPromise = null;
  }
}

export async function getBrieflyRolloutHeaders() {
  const id = await getBrieflyRolloutId();
  const platform =
    Platform.OS === "web" || Platform.OS === "ios" || Platform.OS === "android"
      ? Platform.OS
      : "unknown";

  return {
    "X-Briefly-Rollout-Id": id,
    "X-Briefly-Platform": platform,
  };
}

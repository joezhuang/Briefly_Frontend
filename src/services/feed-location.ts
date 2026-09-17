import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

export type FeedLocation = {
  country: string;
  countryCode: string | null;
  city: string;
  region: string | null;
  source: "device" | "manual";
};

const STORAGE_KEY = "briefly.news-location.v1";

let cachedLocation: FeedLocation | null | undefined;
let pendingSavedLocation: Promise<FeedLocation | null> | null = null;
let pendingDeviceLocation: Promise<FeedLocation | null> | null = null;

function firstText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function normalizeCountryCode(value: string | null | undefined) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function canonicalCountryName(
  isoCountryCode: string | null | undefined,
  localizedCountry: string | null | undefined,
): string {
  const code = normalizeCountryCode(isoCountryCode);
  if (code) {
    try {
      const DisplayNames = (
        Intl as unknown as {
          DisplayNames?: new (
            locales: string[],
            options: { type: "region" },
          ) => { of(value: string): string | undefined };
        }
      ).DisplayNames;
      const resolved = DisplayNames
        ? new DisplayNames(["en"], { type: "region" }).of(code)
        : undefined;
      if (resolved) return resolved;
    } catch {}
  }

  return firstText(localizedCountry);
}

function validStoredLocation(value: unknown): FeedLocation | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<FeedLocation>;
  const country = firstText(candidate.country);
  const region = firstText(candidate.region) || null;
  const city = firstText(candidate.city);
  if (!country) return null;

  return {
    country,
    countryCode: normalizeCountryCode(candidate.countryCode),
    region,
    city,
    source: candidate.source === "device" ? "device" : "manual",
  };
}

async function persist(location: FeedLocation | null) {
  cachedLocation = location;
  if (location) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

export async function getSavedFeedLocation(): Promise<FeedLocation | null> {
  if (cachedLocation !== undefined) return cachedLocation;
  if (!pendingSavedLocation) {
    pendingSavedLocation = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return null;
        try {
          return validStoredLocation(JSON.parse(raw));
        } catch {
          return null;
        }
      })
      .then((location) => {
        cachedLocation = location;
        return location;
      })
      .finally(() => {
        pendingSavedLocation = null;
      });
  }
  return pendingSavedLocation;
}

export async function requestCurrentFeedLocation(): Promise<FeedLocation | null> {
  if (pendingDeviceLocation) return pendingDeviceLocation;

  pendingDeviceLocation = (async () => {
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        if (!permission.canAskAgain) return null;
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (permission.status !== "granted") return null;

      const position =
        (await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000 })) ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));

      const places = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const place = places[0];
      if (!place) return null;

      const countryCode = normalizeCountryCode(place.isoCountryCode);
      const country = canonicalCountryName(countryCode, place.country);
      const region = firstText(place.region, place.subregion) || null;
      const city = firstText(place.city, place.subregion, place.district);
      if (!country) return null;

      const location: FeedLocation = {
        country,
        countryCode,
        region,
        city,
        source: "device",
      };
      await persist(location);
      return location;
    } catch {
      return null;
    }
  })().finally(() => {
    pendingDeviceLocation = null;
  });

  return pendingDeviceLocation;
}

export async function saveManualFeedLocation(input: {
  country: string;
  countryCode?: string | null;
  region?: string | null;
  city?: string | null;
}): Promise<FeedLocation> {
  const country = firstText(input.country);
  if (!country) throw new Error("Country is required.");

  const location: FeedLocation = {
    country,
    countryCode: normalizeCountryCode(input.countryCode),
    region: firstText(input.region) || null,
    city: firstText(input.city),
    source: "manual",
  };
  await persist(location);
  return location;
}

export async function clearFeedLocation() {
  await persist(null);
}

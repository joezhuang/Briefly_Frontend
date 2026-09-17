import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

export type FeedLocation = {
  country: string;
  countryCode: string | null;
  city: string;
  region: string | null;
  source: "device" | "manual";
};

export type NewsLocationMode = "auto" | "manual" | "off";

export type NewsLocationPreference = {
  mode: NewsLocationMode;
  location: FeedLocation | null;
};

const STORAGE_KEY = "briefly.news-location.v2";
const DEFAULT_PREFERENCE: NewsLocationPreference = {
  mode: "off",
  location: null,
};

let cachedPreference: NewsLocationPreference | undefined;
let pendingPreference: Promise<NewsLocationPreference> | null = null;
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

function validLocation(value: unknown): FeedLocation | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<FeedLocation>;
  const country = firstText(candidate.country);
  if (!country) return null;

  return {
    country,
    countryCode: normalizeCountryCode(candidate.countryCode),
    region: firstText(candidate.region) || null,
    city: firstText(candidate.city),
    source: candidate.source === "device" ? "device" : "manual",
  };
}

function validPreference(value: unknown): NewsLocationPreference {
  if (!value || typeof value !== "object") return DEFAULT_PREFERENCE;
  const candidate = value as Partial<NewsLocationPreference>;
  const mode: NewsLocationMode =
    candidate.mode === "auto" || candidate.mode === "manual"
      ? candidate.mode
      : "off";
  const location = validLocation(candidate.location);

  if (mode === "off") return DEFAULT_PREFERENCE;
  if (!location) return { mode, location: null };
  if (mode === "auto" && location.source !== "device") {
    return { mode, location: { ...location, source: "device" } };
  }
  if (mode === "manual" && location.source !== "manual") {
    return { mode, location: { ...location, source: "manual" } };
  }
  return { mode, location };
}

async function persist(preference: NewsLocationPreference) {
  cachedPreference = preference;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  return preference;
}

export async function getNewsLocationPreference(): Promise<NewsLocationPreference> {
  if (cachedPreference) return cachedPreference;
  if (!pendingPreference) {
    pendingPreference = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return DEFAULT_PREFERENCE;
        try {
          return validPreference(JSON.parse(raw));
        } catch {
          return DEFAULT_PREFERENCE;
        }
      })
      .then((preference) => {
        cachedPreference = preference;
        return preference;
      })
      .finally(() => {
        pendingPreference = null;
      });
  }
  return pendingPreference;
}

async function resolveDeviceLocation(options: {
  requestPermission: boolean;
}): Promise<FeedLocation | null> {
  if (pendingDeviceLocation) return pendingDeviceLocation;

  pendingDeviceLocation = (async () => {
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== "granted" && options.requestPermission) {
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

      return {
        country,
        countryCode,
        region,
        city,
        source: "device",
      };
    } catch {
      return null;
    }
  })().finally(() => {
    pendingDeviceLocation = null;
  });

  return pendingDeviceLocation;
}

export async function enableAutoNewsLocation(): Promise<NewsLocationPreference> {
  const location = await resolveDeviceLocation({ requestPermission: true });
  if (!location) return { mode: "auto", location: null };
  return persist({ mode: "auto", location });
}

export async function refreshAutoNewsLocation(): Promise<NewsLocationPreference> {
  const preference = await getNewsLocationPreference();
  if (preference.mode !== "auto") return preference;

  const location = await resolveDeviceLocation({ requestPermission: false });
  if (!location) return preference;
  return persist({ mode: "auto", location });
}

export async function saveManualFeedLocation(input: {
  country: string;
  countryCode?: string | null;
  region?: string | null;
  city?: string | null;
}): Promise<NewsLocationPreference> {
  const country = firstText(input.country);
  if (!country) throw new Error("Country is required.");

  const location: FeedLocation = {
    country,
    countryCode: normalizeCountryCode(input.countryCode),
    region: firstText(input.region) || null,
    city: firstText(input.city),
    source: "manual",
  };
  return persist({ mode: "manual", location });
}

export async function disableNewsLocation(): Promise<NewsLocationPreference> {
  return persist(DEFAULT_PREFERENCE);
}

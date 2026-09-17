import * as Location from "expo-location";

export type FeedLocation = {
  country: string;
  city: string;
  region: string | null;
  source: "device" | "fallback";
};

const FALLBACK_LOCATION: FeedLocation = {
  country: "Australia",
  city: "Sydney",
  region: "New South Wales",
  source: "fallback",
};

let cachedLocation: FeedLocation | null = null;
let pendingLocation: Promise<FeedLocation> | null = null;

function firstText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

async function resolveOnce(): Promise<FeedLocation> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== "granted" && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status !== "granted") return FALLBACK_LOCATION;

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
    if (!place) return FALLBACK_LOCATION;

    const country = firstText(place.country, FALLBACK_LOCATION.country);
    const city = firstText(
      place.city,
      place.district,
      place.subregion,
      FALLBACK_LOCATION.city,
    );
    const region = firstText(place.region, place.subregion) || null;

    return { country, city, region, source: "device" };
  } catch {
    return FALLBACK_LOCATION;
  }
}

export async function getFeedLocation(): Promise<FeedLocation> {
  if (cachedLocation) return cachedLocation;
  if (!pendingLocation) {
    pendingLocation = resolveOnce()
      .then((value) => {
        cachedLocation = value;
        return value;
      })
      .finally(() => {
        pendingLocation = null;
      });
  }
  return pendingLocation;
}

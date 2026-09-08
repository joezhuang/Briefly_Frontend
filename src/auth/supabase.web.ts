import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

const canUseBrowserStorage =
  typeof globalThis !== "undefined" &&
  "window" in globalThis &&
  "localStorage" in globalThis;

export const supabase =
  url && publishableKey && canUseBrowserStorage
    ? createClient(url, publishableKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase authentication is unavailable during server rendering or is not configured.",
    );
  }
  return supabase;
}

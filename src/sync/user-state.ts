import { supabase } from "@/auth/supabase";

export type UserStateSection =
  | "reading_history"
  | "notifications"
  | "podcast_queue";

type SectionConfig = {
  table: string;
  column: string;
};

const sections: Record<UserStateSection, SectionConfig> = {
  reading_history: {
    table: "briefly_reading_history",
    column: "items",
  },
  notifications: {
    table: "briefly_generation_notifications",
    column: "state",
  },
  podcast_queue: {
    table: "briefly_podcast_queue",
    column: "items",
  },
};

export type SyncedStateRead<T> = {
  exists: boolean;
  value: T | null;
};

export async function readSyncedUserState<T>(
  userId: string,
  section: UserStateSection,
): Promise<SyncedStateRead<T>> {
  if (!supabase) {
    return { exists: false, value: null };
  }

  const config = sections[section];
  const { data, error } = await supabase
    .from(config.table)
    .select(config.column)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { exists: false, value: null };

  const row = data as unknown as Record<string, unknown>;
  return {
    exists: true,
    value: (row[config.column] as T | null) ?? null,
  };
}

export async function writeSyncedUserState<T>(
  userId: string,
  section: UserStateSection,
  value: T,
): Promise<void> {
  if (!supabase) return;

  const config = sections[section];
  const payload = {
    user_id: userId,
    [config.column]: value,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from(config.table)
    .upsert(payload, { onConflict: "user_id" });

  if (error) throw error;
}

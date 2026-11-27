// Shared across normal and shared-link stories; retain existing storage keys.
export const LOGIN_NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const LOGIN_NUDGE_REPEAT_COOLDOWN_MS = 30 * 60 * 1000;
export const LOGIN_NUDGE_DISMISSED_AT_KEY = "briefly.storyLoginNudge.dismissedAt";
export const LOGIN_NUDGE_LAST_SHOWN_AT_KEY = "briefly.storyLoginNudge.lastShownAt";

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function timestamp(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function createStoryLoginNudgePolicy(storage: Storage, clock = Date.now) {
  let dismissedAt = 0;
  let lastShownAt = 0;
  const listeners = new Set<() => void>();
  const updateDismissal = (value: number) => {
    // A delayed storage read must not undo a newer in-memory dismissal.
    if (value <= dismissedAt) return;
    dismissedAt = value;
    listeners.forEach(listener => listener());
  };
  const refresh = async () => {
    const [dismissed, shown] = await Promise.all([
      storage.getItem(LOGIN_NUDGE_DISMISSED_AT_KEY).catch(() => null),
      storage.getItem(LOGIN_NUDGE_LAST_SHOWN_AT_KEY).catch(() => null),
    ]);
    lastShownAt = Math.max(lastShownAt, timestamp(shown));
    updateDismissal(timestamp(dismissed));
  };
  const canShow = (repeatSuppression: boolean) => {
    const now = clock();
    return !(dismissedAt > 0 && now - dismissedAt < LOGIN_NUDGE_COOLDOWN_MS)
      && !(repeatSuppression && lastShownAt > 0 && now - lastShownAt < LOGIN_NUDGE_REPEAT_COOLDOWN_MS);
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getDismissedAt: () => dismissedAt,
    refresh,
    canShow,
    markShown(repeatSuppression: boolean) {
      if (!canShow(repeatSuppression)) return false;
      if (repeatSuppression) {
        lastShownAt = clock();
        void storage.setItem(LOGIN_NUDGE_LAST_SHOWN_AT_KEY, String(lastShownAt)).catch(() => null);
      }
      return true;
    },
    dismiss() {
      const now = clock();
      updateDismissal(now);
      void storage.setItem(LOGIN_NUDGE_DISMISSED_AT_KEY, String(now)).catch(() => null);
    },
  };
}

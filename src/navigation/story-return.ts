import { router } from "expo-router";

/**
 * Use the in-app navigator rather than document.referrer: SPA navigation does
 * not change document.referrer, and raw browser history can leave Briefly.
 * The origin page retains its own scroll state when the stack is popped.
 */
export function storyReturnFallback(source?: string, scope?: string): string {
  if (source === "search") return "/search";
  if (source === "history") return "/history";
  if (source === "saved") return "/saved";
  if (source === "feed" && (scope === "top" || scope === "national" || scope === "local")) {
    return `/?feedScope=${scope}`;
  }
  return "/";
}

export function canReturnFromStory(): boolean {
  return router.canGoBack();
}

export function returnFromStory(source?: string, scope?: string): void {
  if (canReturnFromStory()) {
    router.back();
  } else {
    router.replace(storyReturnFallback(source, scope) as never);
  }
}

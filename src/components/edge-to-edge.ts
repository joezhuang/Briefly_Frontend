import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context";

// Keep top and lateral system areas protected. Bottom protection belongs to
// scroll content and floating controls, not to the viewport itself.
export const SCROLL_SCREEN_EDGES: Edge[] = ["top", "left", "right"];

export function useScrollSafeArea() {
  const { top, bottom } = useSafeAreaInsets();
  return { topInset: top, bottomInset: bottom, scrollEndStyle: { paddingBottom: bottom } };
}

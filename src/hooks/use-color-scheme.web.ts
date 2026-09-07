import { useColorScheme as useRNColorScheme } from "react-native";

/**
 * On web, rely directly on React Native's color-scheme subscription.
 * This avoids a hydration-only state update effect that React 19's lint rules reject.
 */
export function useColorScheme() {
  return useRNColorScheme() ?? "light";
}

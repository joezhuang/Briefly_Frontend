import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";

import {
  darkColors,
  lightColors,
  type BrieflyColors,
} from "@/theme/tokens";

export type BrieflyThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "briefly.theme.v1";

type ThemeContextValue = {
  mode: BrieflyThemeMode;
  resolvedMode: "light" | "dark";
  colors: BrieflyColors;
  setMode: (mode: BrieflyThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function BrieflyThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<BrieflyThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "system" || stored === "light" || stored === "dark") {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = (next: BrieflyThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const resolvedMode =
    mode === "system" ? (system === "dark" ? "dark" : "light") : mode;

  const colors = resolvedMode === "dark" ? darkColors : lightColors;

  const value = useMemo(
    () => ({ mode, resolvedMode, colors, setMode }),
    [mode, resolvedMode, colors],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useBrieflyTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useBrieflyTheme must be used inside BrieflyThemeProvider");
  }
  return value;
}

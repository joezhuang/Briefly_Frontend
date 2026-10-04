import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "briefly.auto-translate-stories.v1";

type TranslationPreferencesValue = {
  autoTranslateStories: boolean;
  preferencesReady: boolean;
  setAutoTranslateStories: (enabled: boolean) => void;
};

const TranslationPreferencesContext = createContext<TranslationPreferencesValue | null>(null);

export function TranslationPreferencesProvider({ children }: PropsWithChildren) {
  // Existing Pro behaviour: localize a story automatically when first opened.
  // Delay generation until the stored device preference has been read.
  const [autoTranslateStories, setEnabled] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && (stored === "true" || stored === "false")) {
          setEnabled(stored === "true");
        }
      })
      .catch(() => {
        // The default remains enabled if device storage is unavailable.
      })
      .finally(() => {
        if (active) setPreferencesReady(true);
      });
    return () => { active = false; };
  }, []);

  const setAutoTranslateStories = useCallback((enabled: boolean) => {
    setEnabled(enabled);
    void AsyncStorage.setItem(STORAGE_KEY, String(enabled)).catch(() => {
      // Keep the current-session preference even when persistence fails.
    });
  }, []);

  const value = useMemo(() => ({
    autoTranslateStories, preferencesReady, setAutoTranslateStories,
  }), [autoTranslateStories, preferencesReady, setAutoTranslateStories]);

  return (
    <TranslationPreferencesContext.Provider value={value}>
      {children}
    </TranslationPreferencesContext.Provider>
  );
}

export function useTranslationPreferences() {
  const context = useContext(TranslationPreferencesContext);
  if (!context) {
    throw new Error("useTranslationPreferences requires TranslationPreferencesProvider");
  }
  return context;
}

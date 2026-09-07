import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

export const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "ja", label: "日本語" },
  { code: "zh-CN", label: "简中" },
  { code: "zh-TW", label: "繁中" },
] as const;

export type BrieflyLanguage = (typeof LANGUAGES)[number]["code"];
const STORAGE_KEY = "briefly.language.v1";

type LanguageContextValue = {
  language: BrieflyLanguage;
  setLanguage: (language: BrieflyLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<BrieflyLanguage>("en");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (LANGUAGES.some((item) => item.code === stored)) {
        setLanguageState(stored as BrieflyLanguage);
      }
    });
  }, []);

  const setLanguage = (next: BrieflyLanguage) => {
    setLanguageState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useBrieflyLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useBrieflyLanguage must be used inside LanguageProvider");
  return value;
}

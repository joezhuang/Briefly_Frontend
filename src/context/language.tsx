import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "ja", label: "日本語" },
  { code: "zh-CN", label: "简中" },
  { code: "zh-TW", label: "繁中" },
] as const;

export type BrieflyLanguage = (typeof LANGUAGES)[number]["code"];
const STORAGE_KEY = "briefly.language.v1";

const copy = {
  en: {
    home: "Home",
    saved: "Saved",
    search: "Search",
    topStories: "Today’s top stories",
    subtitle: "A deeper understanding of what’s happening in the world.",
    loadingStories: "Loading stories…",
    unableLoad: "Unable to load Briefly",
    noStories: "No stories yet",
    noStoriesMessage: "There are no published stories for this language yet.",
    tryAgain: "Try again",
    savedStories: "Saved stories",
    savedSubtitle:
      "Snapshots stay readable even if Briefly later rebuilds or reclusters the live story.",
    loadingSavedStories: "Loading saved stories…",
    nothingSaved: "Nothing saved yet",
    nothingSavedMessage:
      "Save a story and Briefly will keep an immutable local snapshot of that article version.",
    loadingSavedStory: "Loading saved story…",
    savedUnavailable: "Saved story unavailable",
    savedUnavailableMessage: "This snapshot is no longer stored on this device.",
    searchPlaceholder: "Search current Briefly stories",
    searchUnavailable: "Search unavailable",
    noMatches: "No matches",
    noMatchesMessage: "Try a different person, place, topic or keyword.",
    whatHappened: "What happened",
    whyItMatters: "Why it matters",
    whatNext: "What next",
    whatWeDontKnow: "What we don’t know",
    sources: "Sources",
    source: "source",
    sourcesPlural: "sources",
    save: "Save",
    savedAction: "Saved",
    share: "Share",
    savedVersion: "Saved version",
    topStory: "Top story",
    loadingStory: "Loading story…",
    storyUnavailable: "Story unavailable",
    articleNotFound: "Article not found.",
    loadingSharedStory: "Loading shared story…",
    sharedUnavailable: "Shared story unavailable",
    invalidSharedLink: "Invalid shared article link.",
    shareConfigMissing:
      "Set EXPO_PUBLIC_BRIEFLY_WEB_URL to your public Briefly web address before sharing.",
    articleContentEnglish: "Article content is currently in English.",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
  },
  es: {
    home: "Inicio",
    saved: "Guardados",
    search: "Buscar",
    topStories: "Noticias destacadas de hoy",
    subtitle: "Una comprensión más profunda de lo que ocurre en el mundo.",
    loadingStories: "Cargando noticias…",
    unableLoad: "No se pudo cargar Briefly",
    noStories: "Aún no hay noticias",
    noStoriesMessage: "No hay noticias publicadas en este idioma.",
    tryAgain: "Reintentar",
    savedStories: "Noticias guardadas",
    savedSubtitle:
      "Las copias guardadas siguen disponibles aunque Briefly reconstruya o reagrupe la noticia.",
    loadingSavedStories: "Cargando noticias guardadas…",
    nothingSaved: "Aún no has guardado nada",
    nothingSavedMessage:
      "Guarda una noticia y Briefly conservará una copia inmutable de esa versión.",
    loadingSavedStory: "Cargando noticia guardada…",
    savedUnavailable: "Noticia guardada no disponible",
    savedUnavailableMessage: "Esta copia ya no está almacenada en este dispositivo.",
    searchPlaceholder: "Buscar noticias actuales en Briefly",
    searchUnavailable: "Búsqueda no disponible",
    noMatches: "Sin resultados",
    noMatchesMessage: "Prueba con otra persona, lugar, tema o palabra clave.",
    whatHappened: "Qué pasó",
    whyItMatters: "Por qué importa",
    whatNext: "Qué sigue",
    whatWeDontKnow: "Lo que no sabemos",
    sources: "Fuentes",
    source: "fuente",
    sourcesPlural: "fuentes",
    save: "Guardar",
    savedAction: "Guardado",
    share: "Compartir",
    savedVersion: "Versión guardada",
    topStory: "Destacada",
    loadingStory: "Cargando noticia…",
    storyUnavailable: "Noticia no disponible",
    articleNotFound: "Noticia no encontrada.",
    loadingSharedStory: "Cargando noticia compartida…",
    sharedUnavailable: "Noticia compartida no disponible",
    invalidSharedLink: "Enlace compartido no válido.",
    shareConfigMissing:
      "Configura EXPO_PUBLIC_BRIEFLY_WEB_URL con la dirección pública de Briefly antes de compartir.",
    articleContentEnglish: "El contenido del artículo está actualmente en inglés.",
    themeSystem: "Sistema",
    themeLight: "Claro",
    themeDark: "Oscuro",
  },
  ja: {
    home: "ホーム",
    saved: "保存",
    search: "検索",
    topStories: "今日のトップニュース",
    subtitle: "世界で起きていることを、より深く理解するために。",
    loadingStories: "ニュースを読み込み中…",
    unableLoad: "Brieflyを読み込めません",
    noStories: "ニュースはまだありません",
    noStoriesMessage: "この言語で公開されたニュースはまだありません。",
    tryAgain: "再試行",
    savedStories: "保存したニュース",
    savedSubtitle:
      "Brieflyが後で再構築・再クラスタリングしても、保存したスナップショットは読めます。",
    loadingSavedStories: "保存したニュースを読み込み中…",
    nothingSaved: "まだ保存されていません",
    nothingSavedMessage:
      "ニュースを保存すると、その記事バージョンの不変スナップショットを保持します。",
    loadingSavedStory: "保存したニュースを読み込み中…",
    savedUnavailable: "保存したニュースを利用できません",
    savedUnavailableMessage: "このスナップショットは端末に保存されていません。",
    searchPlaceholder: "Brieflyの現在のニュースを検索",
    searchUnavailable: "検索を利用できません",
    noMatches: "一致する結果がありません",
    noMatchesMessage: "人物、場所、トピック、キーワードを変えてみてください。",
    whatHappened: "何が起きたか",
    whyItMatters: "なぜ重要か",
    whatNext: "今後の見通し",
    whatWeDontKnow: "まだ分からないこと",
    sources: "情報源",
    source: "件の情報源",
    sourcesPlural: "件の情報源",
    save: "保存",
    savedAction: "保存済み",
    share: "共有",
    savedVersion: "保存版",
    topStory: "トップニュース",
    loadingStory: "記事を読み込み中…",
    storyUnavailable: "記事を利用できません",
    articleNotFound: "記事が見つかりません。",
    loadingSharedStory: "共有記事を読み込み中…",
    sharedUnavailable: "共有記事を利用できません",
    invalidSharedLink: "共有リンクが無効です。",
    shareConfigMissing:
      "共有する前にEXPO_PUBLIC_BRIEFLY_WEB_URLへBrieflyの公開URLを設定してください。",
    articleContentEnglish: "記事本文は現在英語で表示されています。",
    themeSystem: "システム",
    themeLight: "ライト",
    themeDark: "ダーク",
  },
  "zh-CN": {
    home: "首页",
    saved: "已保存",
    search: "搜索",
    topStories: "今日要闻",
    subtitle: "更深入地理解世界正在发生什么。",
    loadingStories: "正在加载新闻…",
    unableLoad: "无法加载 Briefly",
    noStories: "暂时没有新闻",
    noStoriesMessage: "该语言暂时没有已发布的新闻。",
    tryAgain: "重试",
    savedStories: "已保存新闻",
    savedSubtitle: "即使 Briefly 之后重建或重新聚类，已保存快照仍可阅读。",
    loadingSavedStories: "正在加载已保存新闻…",
    nothingSaved: "还没有保存新闻",
    nothingSavedMessage: "保存新闻后，Briefly 会保留该文章版本的不可变快照。",
    loadingSavedStory: "正在加载已保存新闻…",
    savedUnavailable: "已保存新闻不可用",
    savedUnavailableMessage: "该快照已不在此设备上。",
    searchPlaceholder: "搜索 Briefly 当前新闻",
    searchUnavailable: "搜索不可用",
    noMatches: "没有匹配结果",
    noMatchesMessage: "请尝试其他人物、地点、主题或关键词。",
    whatHappened: "发生了什么",
    whyItMatters: "为什么重要",
    whatNext: "接下来会怎样",
    whatWeDontKnow: "尚不清楚",
    sources: "来源",
    source: "个来源",
    sourcesPlural: "个来源",
    save: "保存",
    savedAction: "已保存",
    share: "分享",
    savedVersion: "已保存版本",
    topStory: "头条",
    loadingStory: "正在加载文章…",
    storyUnavailable: "文章不可用",
    articleNotFound: "未找到文章。",
    loadingSharedStory: "正在加载分享文章…",
    sharedUnavailable: "分享文章不可用",
    invalidSharedLink: "分享链接无效。",
    shareConfigMissing: "分享前请将 EXPO_PUBLIC_BRIEFLY_WEB_URL 设置为 Briefly 的公开网址。",
    articleContentEnglish: "文章内容目前以英文显示。",
    themeSystem: "跟随系统",
    themeLight: "浅色",
    themeDark: "深色",
  },
  "zh-TW": {
    home: "首頁",
    saved: "已儲存",
    search: "搜尋",
    topStories: "今日要聞",
    subtitle: "更深入理解世界正在發生什麼。",
    loadingStories: "正在載入新聞…",
    unableLoad: "無法載入 Briefly",
    noStories: "暫時沒有新聞",
    noStoriesMessage: "此語言暫時沒有已發布的新聞。",
    tryAgain: "重試",
    savedStories: "已儲存新聞",
    savedSubtitle: "即使 Briefly 日後重建或重新分群，已儲存快照仍可閱讀。",
    loadingSavedStories: "正在載入已儲存新聞…",
    nothingSaved: "尚未儲存新聞",
    nothingSavedMessage: "儲存新聞後，Briefly 會保留該文章版本的不可變快照。",
    loadingSavedStory: "正在載入已儲存新聞…",
    savedUnavailable: "已儲存新聞無法使用",
    savedUnavailableMessage: "此快照已不在此裝置上。",
    searchPlaceholder: "搜尋 Briefly 目前新聞",
    searchUnavailable: "搜尋無法使用",
    noMatches: "沒有相符結果",
    noMatchesMessage: "請嘗試其他人物、地點、主題或關鍵字。",
    whatHappened: "發生了什麼",
    whyItMatters: "為什麼重要",
    whatNext: "接下來會怎樣",
    whatWeDontKnow: "尚不清楚",
    sources: "來源",
    source: "個來源",
    sourcesPlural: "個來源",
    save: "儲存",
    savedAction: "已儲存",
    share: "分享",
    savedVersion: "已儲存版本",
    topStory: "頭條",
    loadingStory: "正在載入文章…",
    storyUnavailable: "文章無法使用",
    articleNotFound: "找不到文章。",
    loadingSharedStory: "正在載入分享文章…",
    sharedUnavailable: "分享文章無法使用",
    invalidSharedLink: "分享連結無效。",
    shareConfigMissing: "分享前請將 EXPO_PUBLIC_BRIEFLY_WEB_URL 設為 Briefly 的公開網址。",
    articleContentEnglish: "文章內容目前以英文顯示。",
    themeSystem: "跟隨系統",
    themeLight: "淺色",
    themeDark: "深色",
  },
} as const;

type Copy = (typeof copy)["en"];

type LanguageContextValue = {
  language: BrieflyLanguage;
  setLanguage: (language: BrieflyLanguage) => void;
  t: Copy;
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

  const value = useMemo(
    () => ({ language, setLanguage, t: copy[language] as Copy }),
    [language],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useBrieflyLanguage() {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useBrieflyLanguage must be used inside LanguageProvider");
  }
  return value;
}

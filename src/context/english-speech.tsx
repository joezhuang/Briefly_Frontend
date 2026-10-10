import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { usePathname } from "expo-router";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";

import { usePodcastPlayer } from "@/context/podcast-player";

/**
 * Free, platform-provided text-to-speech for article text already loaded in
 * the reader. No server request, account gate, or generated audio asset.
 * The explicit locale lets other languages reuse this service in the future.
 */
export type SpeechSegment = {
  text: string;
  locale: string;
};

type SpeechController = {
  activePassage: string | null;
  voices: Speech.Voice[];
  selectedVoice: string | null;
  setVoice: (identifier: string | null) => void;
  toggle: (passageId: string, text: string, locale?: string) => void;
  toggleSequence: (passageId: string, segments: SpeechSegment[]) => void;
  stop: () => void;
};

const SpeechContext = createContext<SpeechController | null>(null);
const VOICE_STORAGE_KEY = "briefly.english-speech.voice.v1";

function normalizedLocale(value: string): string {
  const locale = String(value || "en-US").trim().replace("_", "-");
  const aliases: Record<string, string> = {
    en: "en-US",
    es: "es-ES",
    ja: "ja-JP",
    "zh-cn": "zh-CN",
    "zh-tw": "zh-TW",
    zh: "zh-CN",
  };
  return aliases[locale.toLowerCase()] ?? locale;
}

function localeMatches(candidate: string, requested: string): boolean {
  const candidateLocale = normalizedLocale(candidate).toLowerCase();
  const requestedLocale = normalizedLocale(requested).toLowerCase();
  return (
    candidateLocale === requestedLocale ||
    candidateLocale.split("-")[0] === requestedLocale.split("-")[0]
  );
}

function isEnglishVoice(voice: Speech.Voice): boolean {
  return localeMatches(voice.language, "en-US");
}

/** All browsers have different voice catalogues. Prefer installed natural
 * English voices, but always let readers choose another available voice. */
function voiceRank(voice: Speech.Voice): number {
  const name = voice.name.toLowerCase();
  let score = voice.quality === Speech.VoiceQuality.Enhanced ? 50 : 0;
  if (/natural|neural|premium|enhanced/.test(name)) score += 40;
  if (/microsoft.*(aria|jenny|guy|sonia|ryan)/.test(name)) score += 25;
  if (/google.*(us|uk|english)/.test(name)) score += 20;
  if (/samantha|ava|alex|daniel|serena|karen/.test(name)) score += 15;
  if (/^en-us$/i.test(voice.language)) score += 5;
  return score;
}

function speechChunks(value: string, maximum: number): string[] {
  const text = value.trim();
  if (!text) return [];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maximum) {
    const slice = rest.slice(0, maximum);
    const boundary = Math.max(
      slice.lastIndexOf(". "), slice.lastIndexOf("? "),
      slice.lastIndexOf("! "), slice.lastIndexOf(" "),
    );
    const cut = boundary >= Math.floor(maximum / 2) ? boundary + 1 : maximum;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export function EnglishSpeechProvider({ children }: PropsWithChildren) {
  const { status, pauseForSpeech } = usePodcastPlayer();
  const pathname = usePathname();
  const [activePassage, setActivePassage] = useState<string | null>(null);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const serialRef = useRef(0);
  const availableVoicesRef = useRef<Speech.Voice[]>([]);

  useEffect(() => {
    let mounted = true;
    let savedVoice: string | null = null;

    const discover = async () => {
      try {
        const [available, saved] = await Promise.all([
          Speech.getAvailableVoicesAsync(),
          savedVoice === null
            ? AsyncStorage.getItem(VOICE_STORAGE_KEY)
            : Promise.resolve(savedVoice),
        ]);
        savedVoice = saved;
        if (!mounted) return;
        availableVoicesRef.current = available;
        const english = available
          .filter(isEnglishVoice)
          .sort(
            (a, b) =>
              voiceRank(b) - voiceRank(a) || a.name.localeCompare(b.name),
          );
        setVoices(english);
        setSelectedVoice((current) => {
          const preferred = current || saved;
          return preferred &&
            english.some((voice) => voice.identifier === preferred)
            ? preferred
            : english[0]?.identifier ?? null;
        });
      } catch {
        // Voice enumeration is optional. Playback still falls back to the
        // platform/browser default voice for the requested language.
      }
    };

    void discover();

    const synth =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.speechSynthesis
        : null;
    const refreshBrowserVoices = () => void discover();
    synth?.addEventListener?.("voiceschanged", refreshBrowserVoices);

    return () => {
      mounted = false;
      synth?.removeEventListener?.("voiceschanged", refreshBrowserVoices);
    };
  }, []);

  const stop = useCallback(() => {
    serialRef.current += 1;
    activeRef.current = null;
    setActivePassage(null);

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
      return;
    }

    void Speech.stop().catch(() => {
      // Speech may have been interrupted by the OS.
    });
  }, []);

  const setVoice = useCallback((identifier: string | null) => {
    stop();
    setSelectedVoice(identifier);
    void AsyncStorage.setItem(VOICE_STORAGE_KEY, identifier ?? "").catch(() => {});
  }, [stop]);

  const toggleSequence = useCallback(
    (passageId: string, segments: SpeechSegment[]) => {
      const prepared = segments.flatMap((segment) =>
        speechChunks(
          String(segment.text || ""),
          Platform.OS === "web" ? 220 : 950,
        ).map((text) => ({
          text,
          locale: normalizedLocale(segment.locale),
        })),
      );
      if (!prepared.length) return;

      if (activeRef.current === passageId) {
        stop();
        return;
      }

      const serial = ++serialRef.current;
      activeRef.current = passageId;
      setActivePassage(passageId);
      pauseForSpeech();

      const finish = () => {
        if (serial !== serialRef.current) return;
        activeRef.current = null;
        setActivePassage(null);
      };

      if (Platform.OS === "web" && typeof window !== "undefined") {
        const synth = window.speechSynthesis;
        if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
          finish();
          return;
        }

        // Keep the whole start path inside the user's click. The browser Web
        // Speech API is synchronous here, avoiding an async Expo stop/speak
        // boundary that can turn into a silent no-op on the web.
        synth.cancel();

        const browserVoices = synth.getVoices();
        const speakWeb = (index: number) => {
          if (serial !== serialRef.current) return;
          const segment = prepared[index];
          if (!segment) {
            finish();
            return;
          }

          const utterance = new SpeechSynthesisUtterance(segment.text);
          utterance.lang = segment.locale;
          utterance.rate = 1.0;
          utterance.pitch = 1.0;

          const preferredEnglish =
            localeMatches(segment.locale, "en-US") && selectedVoice
              ? browserVoices.find(
                  (voice) =>
                    voice.voiceURI === selectedVoice ||
                    voice.name === selectedVoice,
                )
              : null;
          const matchingVoice =
            preferredEnglish ??
            browserVoices.find(
              (voice) =>
                voice.lang.toLowerCase() === segment.locale.toLowerCase(),
            ) ??
            browserVoices.find((voice) =>
              localeMatches(voice.lang, segment.locale),
            );
          if (matchingVoice) utterance.voice = matchingVoice;

          utterance.onend = () => speakWeb(index + 1);
          utterance.onerror = (event) => {
            if (
              (event.error === "canceled" || event.error === "interrupted") &&
              serial !== serialRef.current
            ) {
              return;
            }
            finish();
          };
          synth.speak(utterance);
        };

        speakWeb(0);
        return;
      }

      const speakNative = (index: number) => {
        if (serial !== serialRef.current) return;
        const segment = prepared[index];
        if (!segment) {
          finish();
          return;
        }

        const matchingVoice = availableVoicesRef.current
          .filter((voice) => localeMatches(voice.language, segment.locale))
          .sort((a, b) => voiceRank(b) - voiceRank(a))[0];
        const voice =
          localeMatches(segment.locale, "en-US") && selectedVoice
            ? selectedVoice
            : matchingVoice?.identifier;

        try {
          Speech.speak(segment.text, {
            language: segment.locale,
            ...(voice ? { voice } : {}),
            rate: 1.0,
            pitch: 1.0,
            onDone: () => speakNative(index + 1),
            onStopped: finish,
            onError: finish,
          });
        } catch {
          finish();
        }
      };

      void Speech.stop().then(() => speakNative(0)).catch(finish);
    },
    [pauseForSpeech, selectedVoice, stop],
  );

  const toggle = useCallback(
    (passageId: string, text: string, locale = "en-US") => {
      toggleSequence(passageId, [{ text, locale }]);
    },
    [toggleSequence],
  );

  useEffect(() => {
    if (!status.playing) return;
    const handle = setTimeout(stop, 0);
    return () => clearTimeout(handle);
  }, [status.playing, stop]);

  useEffect(() => {
    const listener = AppState.addEventListener("change", (next) => {
      if (next !== "active" && activeRef.current) stop();
    });
    return () => listener.remove();
  }, [stop]);

  useEffect(() => () => {
    if (activeRef.current) stop();
  }, [pathname, stop]);

  const value = useMemo(
    () => ({
      activePassage,
      voices,
      selectedVoice,
      setVoice,
      toggle,
      toggleSequence,
      stop,
    }),
    [
      activePassage,
      voices,
      selectedVoice,
      setVoice,
      toggle,
      toggleSequence,
      stop,
    ],
  );

  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

export function useEnglishSpeech(): SpeechController {
  const context = useContext(SpeechContext);
  if (!context) {
    throw new Error("useEnglishSpeech requires EnglishSpeechProvider");
  }
  return context;
}

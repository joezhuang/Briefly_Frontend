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
type SpeechController = {
  activePassage: string | null;
  voices: Speech.Voice[];
  selectedVoice: string | null;
  setVoice: (identifier: string | null) => void;
  toggle: (passageId: string, text: string, locale?: string) => void;
  stop: () => void;
};

const SpeechContext = createContext<SpeechController | null>(null);
const VOICE_STORAGE_KEY = "briefly.english-speech.voice.v1";

function isEnglishVoice(voice: Speech.Voice): boolean {
  return /^en(?:[-_]|$)/i.test(voice.language);
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

  useEffect(() => {
    let mounted = true;
    const discover = async () => {
      try {
        const [available, saved] = await Promise.all([
          Speech.getAvailableVoicesAsync(),
          AsyncStorage.getItem(VOICE_STORAGE_KEY),
        ]);
        if (!mounted) return;
        const english = available.filter(isEnglishVoice)
          .sort((a, b) => voiceRank(b) - voiceRank(a) ||
            a.name.localeCompare(b.name));
        setVoices(english);
        setSelectedVoice(
          saved && english.some((voice) => voice.identifier === saved)
            ? saved
            : english[0]?.identifier ?? null,
        );
      } catch {
        // Voice enumeration is optional on some browser/device configurations.
        // Speech.speak still works with the platform default voice.
      }
    };
    void discover();
    return () => { mounted = false; };
  }, []);

  const stop = useCallback(() => {
    serialRef.current += 1;
    activeRef.current = null;
    setActivePassage(null);
    void Speech.stop().catch(() => {
      // Speech may have been interrupted by the OS or browser.
    });
  }, []);

  const setVoice = useCallback((identifier: string | null) => {
    stop();
    setSelectedVoice(identifier);
    void AsyncStorage.setItem(VOICE_STORAGE_KEY, identifier ?? "").catch(() => {});
  }, [stop]);

  const toggle = useCallback((passageId: string, text: string, locale = "en-US") => {
    // Short utterances avoid Chrome's long-speech stall; use larger native
    // chunks for smoother iOS/Android output.
    const chunks = speechChunks(text, Platform.OS === "web" ? 220 : 950);
    if (!chunks.length) return;
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
    const speakNext = (index: number) => {
      if (serial !== serialRef.current) return;
      const chunk = chunks[index];
      if (!chunk) {
        finish();
        return;
      }
      try {
        Speech.speak(chunk, {
          language: locale,
          ...(selectedVoice ? { voice: selectedVoice } : {}),
          rate: 1.0,
          pitch: 1.0,
          onDone: () => speakNext(index + 1),
          onStopped: finish,
          onError: finish,
        });
      } catch {
        finish();
      }
    };

    const halted = Speech.stop();
    if (Platform.OS === "web") {
      // Some browsers restrict speech synthesis to direct user gestures.
      void halted.catch(finish);
      speakNext(0);
    } else {
      void halted.then(() => speakNext(0)).catch(finish);
    }
  }, [pauseForSpeech, selectedVoice, stop]);

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

  const value = useMemo(() => ({
    activePassage, voices, selectedVoice, setVoice, toggle, stop,
  }), [activePassage, voices, selectedVoice, setVoice, toggle, stop]);

  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

export function useEnglishSpeech(): SpeechController {
  const context = useContext(SpeechContext);
  if (!context) {
    throw new Error("useEnglishSpeech requires EnglishSpeechProvider");
  }
  return context;
}

import * as Speech from "expo-speech";
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
import { usePathname } from "expo-router";

import { usePodcastPlayer } from "@/context/podcast-player";

/**
 * On-device, zero-inference-cost speech for passages already displayed in Briefly.
 * This controller is shared by all bilingual sections and paragraphs so a second
 * tap never queues overlapping utterances. Do not send article text to our API.
 *
 * The locale is a parameter (rather than the UI language), so future Chinese/
 * Japanese speech can reuse the player without becoming a language-learning app.
 */
type SpeechController = {
  activePassage: string | null;
  toggle: (passageId: string, text: string, locale?: string) => void;
  stop: () => void;
};

const SpeechContext = createContext<SpeechController | null>(null);

function speechChunks(value: string, maximum = 1600): string[] {
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
  const activeRef = useRef<string | null>(null);
  const serialRef = useRef(0);

  const stop = useCallback(() => {
    serialRef.current += 1;
    activeRef.current = null;
    setActivePassage(null);
    void Speech.stop().catch(() => {
      // Device TTS is optional: another platform audio session may own it.
    });
  }, []);

  const toggle = useCallback((passageId: string, text: string, locale = "en-US") => {
    const chunks = speechChunks(text);
    if (!chunks.length) return;
    if (activeRef.current === passageId) {
      stop();
      return;
    }

    const serial = ++serialRef.current;
    activeRef.current = passageId;
    setActivePassage(passageId);
    pauseForSpeech();

    // Speech.speak queues by default; always clear earlier utterances first.
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
          rate: 0.9,
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
      // Keep speak() inside the user's gesture on browsers that restrict
      // speech synthesis to direct interactions.
      void halted.catch(finish);
      speakNext(0);
    } else {
      void halted.then(() => speakNext(0)).catch(finish);
    }
  }, [pauseForSpeech, stop]);

  // A newly played podcast wins over passage speech.
  useEffect(() => {
    if (!status.playing) return;
    // Use a callback to avoid synchronously setting React state in the effect.
    const handle = setTimeout(stop, 0);
    return () => clearTimeout(handle);
  }, [status.playing, stop]);

  // Stop reading when the app is backgrounded, or navigation leaves this page.
  useEffect(() => {
    const listener = AppState.addEventListener("change", (next) => {
      if (next !== "active" && activeRef.current) stop();
    });
    return () => listener.remove();
  }, [stop]);

  useEffect(() => () => {
    if (activeRef.current) stop();
  }, [pathname, stop]);

  // Podcast progress can update every half-second. Keep listener context
  // identity stable unless the spoken passage or an action actually changes.
  const value = useMemo(
    () => ({ activePassage, toggle, stop }),
    [activePassage, toggle, stop],
  );

  return (
    <SpeechContext.Provider value={value}>
      {children}
    </SpeechContext.Provider>
  );
}

export function useEnglishSpeech() {
  const context = useContext(SpeechContext);
  if (!context) {
    throw new Error("useEnglishSpeech requires EnglishSpeechProvider");
  }
  return context;
}

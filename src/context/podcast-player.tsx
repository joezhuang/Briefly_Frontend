import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { Platform } from "react-native";

export type PodcastTrack = {
  id: string;
  title: string;
  source: string;
};

type PodcastPlayerContextValue = {
  currentTrack: PodcastTrack | null;
  queue: PodcastTrack[];
  currentIndex: number;
  status: ReturnType<typeof useAudioPlayerStatus>;
  play: (track: PodcastTrack) => void;
  toggle: (track?: PodcastTrack) => void;
  addToQueue: (track: PodcastTrack) => void;
  playQueueTrack: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  removeFromQueue: (id: string) => void;
  moveQueueItem: (index: number, direction: -1 | 1) => void;
  clearQueue: () => void;
  isQueued: (id: string) => boolean;
  seekBy: (seconds: number) => void;
  close: () => void;
};

const QUEUE_STORAGE_KEY = "briefly.podcast.queue.v1";
const PodcastPlayerContext = createContext<PodcastPlayerContextValue | null>(null);

function uniqueTracks(tracks: PodcastTrack[]) {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (!track?.id || !track?.source || seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
}

export function PodcastPlayerProvider({ children }: PropsWithChildren) {
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [currentTrack, setCurrentTrack] = useState<PodcastTrack | null>(null);
  const [queue, setQueue] = useState<PodcastTrack[]>([]);
  const completedTrackIdRef = useRef<string | null>(null);

  const currentIndex = currentTrack
    ? queue.findIndex((track) => track.id === currentTrack.id)
    : -1;

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });

    void AsyncStorage.getItem(QUEUE_STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        const parsed = JSON.parse(stored) as PodcastTrack[];
        if (!Array.isArray(parsed)) return;
        setQueue(uniqueTracks(parsed));
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  }, [queue]);

  const activateLockScreen = useCallback(
    (track: PodcastTrack) => {
      if (Platform.OS === "web") return;
      try {
        player.setActiveForLockScreen(
          true,
          {
            title: track.title || "Briefly podcast analysis",
            artist: "Briefly",
            albumTitle: "Briefly Podcast Analysis",
          },
          {
            showSeekBackward: true,
            showSeekForward: true,
          },
        );
      } catch (error) {
        console.warn("Briefly podcast lock-screen controls unavailable", error);
      }
    },
    [player],
  );

  const startTrack = useCallback(
    (track: PodcastTrack) => {
      player.replace({ uri: track.source });
      setCurrentTrack(track);
      completedTrackIdRef.current = null;
      activateLockScreen(track);
      player.play();
    },
    [activateLockScreen, player],
  );

  const play = useCallback(
    (track: PodcastTrack) => {
      setQueue((existing) =>
        existing.some((item) => item.id === track.id)
          ? existing
          : [...existing, track],
      );

      const isSameTrack = currentTrack?.id === track.id;
      if (!isSameTrack) {
        startTrack(track);
        return;
      }

      if (
        status.duration > 0 &&
        status.currentTime >= status.duration - 0.25
      ) {
        void player.seekTo(0);
        completedTrackIdRef.current = null;
      }

      activateLockScreen(track);
      player.play();
    },
    [activateLockScreen, currentTrack?.id, player, startTrack, status.currentTime, status.duration],
  );

  const addToQueue = useCallback(
    (track: PodcastTrack) => {
      setQueue((existing) =>
        existing.some((item) => item.id === track.id)
          ? existing
          : [...existing, track],
      );

      // Keep the global queue visible without unexpectedly starting playback.
      if (!currentTrack) {
        player.replace({ uri: track.source });
        player.pause();
        setCurrentTrack(track);
      }
    },
    [currentTrack, player],
  );

  const playQueueTrack = useCallback(
    (index: number) => {
      const track = queue[index];
      if (track) startTrack(track);
    },
    [queue, startTrack],
  );

  const playNext = useCallback(() => {
    if (queue.length === 0) return;
    const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
    if (nextIndex < queue.length) startTrack(queue[nextIndex]);
  }, [currentIndex, queue, startTrack]);

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return;
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    const track = queue[previousIndex];
    if (track) startTrack(track);
  }, [currentIndex, queue, startTrack]);

  const removeFromQueue = useCallback(
    (id: string) => {
      setQueue((existing) => {
        const removedIndex = existing.findIndex((track) => track.id === id);
        if (removedIndex < 0) return existing;

        const nextQueue = existing.filter((track) => track.id !== id);
        if (currentTrack?.id === id) {
          player.pause();
          const replacement = nextQueue[Math.min(removedIndex, nextQueue.length - 1)] ?? null;
          if (replacement) {
            player.replace({ uri: replacement.source });
            player.pause();
          }
          setCurrentTrack(replacement);
        }
        return nextQueue;
      });
    },
    [currentTrack?.id, player],
  );

  const moveQueueItem = useCallback((index: number, direction: -1 | 1) => {
    setQueue((existing) => {
      const target = index + direction;
      if (index < 0 || target < 0 || index >= existing.length || target >= existing.length) {
        return existing;
      }
      const next = [...existing];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => {
    player.pause();
    setQueue([]);
    setCurrentTrack(null);
  }, [player]);

  const isQueued = useCallback(
    (id: string) => queue.some((track) => track.id === id),
    [queue],
  );

  const toggle = useCallback(
    (track?: PodcastTrack) => {
      if (track && currentTrack?.id !== track.id) {
        play(track);
        return;
      }

      if (!currentTrack) {
        if (track) play(track);
        return;
      }

      if (status.playing) {
        player.pause();
      } else {
        play(currentTrack);
      }
    },
    [currentTrack, play, player, status.playing],
  );

  const seekBy = useCallback(
    (seconds: number) => {
      const duration = status.duration || 0;
      const currentTime = status.currentTime || 0;
      const upperBound =
        duration > 0 ? duration : currentTime + Math.max(seconds, 0);
      const next = Math.max(0, Math.min(upperBound, currentTime + seconds));
      void player.seekTo(next);
      completedTrackIdRef.current = null;
    },
    [player, status.currentTime, status.duration],
  );

  useEffect(() => {
    if (!currentTrack || status.duration <= 0) return;
    const finished = status.currentTime >= status.duration - 0.2 && !status.playing;
    if (!finished || completedTrackIdRef.current === currentTrack.id) return;

    completedTrackIdRef.current = currentTrack.id;
    if (currentIndex >= 0 && currentIndex + 1 < queue.length) {
      startTrack(queue[currentIndex + 1]);
    }
  }, [currentIndex, currentTrack, queue, startTrack, status.currentTime, status.duration, status.playing]);

  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      !currentTrack ||
      typeof navigator === "undefined" ||
      !("mediaSession" in navigator)
    ) {
      return;
    }

    const mediaSession = navigator.mediaSession;
    if (typeof window !== "undefined" && "MediaMetadata" in window) {
      mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title || "Briefly podcast analysis",
        artist: "Briefly",
        album: "Briefly Podcast Analysis",
      });
    }

    const setHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null,
    ) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers expose Media Session but do not support every action.
      }
    };

    setHandler("play", () => player.play());
    setHandler("pause", () => player.pause());
    setHandler("previoustrack", playPrevious);
    setHandler("nexttrack", playNext);
    setHandler("seekbackward", (details) => seekBy(-(details.seekOffset ?? 15)));
    setHandler("seekforward", (details) => seekBy(details.seekOffset ?? 15));
    setHandler("seekto", (details) => {
      if (typeof details.seekTime === "number") void player.seekTo(details.seekTime);
    });

    return () => {
      setHandler("play", null);
      setHandler("pause", null);
      setHandler("previoustrack", null);
      setHandler("nexttrack", null);
      setHandler("seekbackward", null);
      setHandler("seekforward", null);
      setHandler("seekto", null);
    };
  }, [currentTrack, playNext, playPrevious, player, seekBy]);

  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      !currentTrack ||
      typeof navigator === "undefined" ||
      !("mediaSession" in navigator)
    ) {
      return;
    }

    const duration = status.duration || 0;
    const position = status.currentTime || 0;
    if (duration <= 0 || position < 0 || position > duration) return;

    try {
      navigator.mediaSession.setPositionState({ duration, playbackRate: 1, position });
    } catch {
      // Position state is optional and not implemented by every browser.
    }
  }, [currentTrack, status.currentTime, status.duration]);

  const close = useCallback(() => {
    player.pause();
    if (Platform.OS !== "web") {
      try {
        player.setActiveForLockScreen(false);
      } catch {
        // The player can already have been detached by the OS.
      }
    } else if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.metadata = null;
    }
    setCurrentTrack(null);
  }, [player]);

  const value = useMemo(
    () => ({
      currentTrack,
      queue,
      currentIndex,
      status,
      play,
      toggle,
      addToQueue,
      playQueueTrack,
      playNext,
      playPrevious,
      removeFromQueue,
      moveQueueItem,
      clearQueue,
      isQueued,
      seekBy,
      close,
    }),
    [
      addToQueue,
      clearQueue,
      close,
      currentIndex,
      currentTrack,
      isQueued,
      moveQueueItem,
      play,
      playNext,
      playPrevious,
      playQueueTrack,
      queue,
      removeFromQueue,
      seekBy,
      status,
      toggle,
    ],
  );

  return (
    <PodcastPlayerContext.Provider value={value}>
      {children}
    </PodcastPlayerContext.Provider>
  );
}

export function usePodcastPlayer() {
  const value = useContext(PodcastPlayerContext);
  if (!value) throw new Error("usePodcastPlayer must be used inside PodcastPlayerProvider");
  return value;
}

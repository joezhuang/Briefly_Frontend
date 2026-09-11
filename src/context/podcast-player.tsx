import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { Platform } from "react-native";

type PodcastTrack = {
  id: string;
  title: string;
  source: string;
};

type PodcastPlayerContextValue = {
  currentTrack: PodcastTrack | null;
  status: ReturnType<typeof useAudioPlayerStatus>;
  play: (track: PodcastTrack) => void;
  toggle: (track?: PodcastTrack) => void;
  seekBy: (seconds: number) => void;
  close: () => void;
};

const PodcastPlayerContext = createContext<PodcastPlayerContextValue | null>(null);

export function PodcastPlayerProvider({ children }: PropsWithChildren) {
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [currentTrack, setCurrentTrack] = useState<PodcastTrack | null>(null);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });
  }, []);

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

  const play = useCallback(
    (track: PodcastTrack) => {
      const isSameTrack = currentTrack?.id === track.id;

      if (!isSameTrack) {
        player.replace({ uri: track.source });
        setCurrentTrack(track);
      } else if (
        status.duration > 0 &&
        status.currentTime >= status.duration - 0.25
      ) {
        void player.seekTo(0);
      }

      activateLockScreen(track);
      player.play();
    },
    [activateLockScreen, currentTrack?.id, player, status.currentTime, status.duration],
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
      const next = Math.max(
        0,
        Math.min(upperBound, currentTime + seconds),
      );
      void player.seekTo(next);
    },
    [player, status.currentTime, status.duration],
  );

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
    setHandler("seekbackward", (details) =>
      seekBy(-(details.seekOffset ?? 15)),
    );
    setHandler("seekforward", (details) =>
      seekBy(details.seekOffset ?? 15),
    );
    setHandler("seekto", (details) => {
      if (typeof details.seekTime === "number") {
        void player.seekTo(details.seekTime);
      }
    });

    return () => {
      setHandler("play", null);
      setHandler("pause", null);
      setHandler("seekbackward", null);
      setHandler("seekforward", null);
      setHandler("seekto", null);
    };
  }, [currentTrack, player, seekBy]);

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
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position,
      });
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
    () => ({ currentTrack, status, play, toggle, seekBy, close }),
    [close, currentTrack, play, seekBy, status, toggle],
  );

  return (
    <PodcastPlayerContext.Provider value={value}>
      {children}
    </PodcastPlayerContext.Provider>
  );
}

export function usePodcastPlayer() {
  const value = useContext(PodcastPlayerContext);
  if (!value) {
    throw new Error("usePodcastPlayer must be used inside PodcastPlayerProvider");
  }
  return value;
}

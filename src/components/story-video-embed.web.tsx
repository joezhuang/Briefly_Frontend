import { useEffect, useRef } from "react";

type Props = {
  src: string;
  title: string;
  initialTime?: number;
  onTimeUpdate?: (seconds: number) => void;
  onPlayingChange?: (playing: boolean) => void;
};

function provider(src: string) {
  try {
    const host = new URL(src).hostname.replace(/^www\./, "").toLowerCase();
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      return "youtube";
    }
    if (host.endsWith("vimeo.com")) return "vimeo";
  } catch {}
  return "other";
}

export default function StoryVideoEmbed({
  src,
  title,
  onTimeUpdate,
  onPlayingChange,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const kind = provider(src);

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      let payload = event.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }
      if (!payload || typeof payload !== "object") return;

      if (kind === "youtube" && payload.event === "infoDelivery") {
        const current = Number(payload.info?.currentTime);
        if (Number.isFinite(current)) onTimeUpdate?.(Math.max(0, current));
        const state = Number(payload.info?.playerState);
        if (state === 1) onPlayingChange?.(true);
        if (state === 0 || state === 2) onPlayingChange?.(false);
      }

      if (kind === "vimeo") {
        const seconds = Number(payload.data?.seconds);
        if (payload.event === "timeupdate" && Number.isFinite(seconds)) {
          onTimeUpdate?.(Math.max(0, seconds));
        }
        if (payload.event === "play") onPlayingChange?.(true);
        if (payload.event === "pause" || payload.event === "ended") {
          onPlayingChange?.(false);
        }
      }
    };

    window.addEventListener("message", handleMessage);

    const interval = window.setInterval(() => {
      const target = iframeRef.current?.contentWindow;
      if (!target) return;

      if (kind === "youtube") {
        target.postMessage(
          JSON.stringify({ event: "listening", id: "briefly-video" }),
          "*",
        );
        target.postMessage(
          JSON.stringify({
            event: "command",
            func: "getCurrentTime",
            args: [],
          }),
          "*",
        );
        target.postMessage(
          JSON.stringify({
            event: "command",
            func: "getPlayerState",
            args: [],
          }),
          "*",
        );
      } else if (kind === "vimeo") {
        target.postMessage({ method: "addEventListener", value: "timeupdate" }, "*");
        target.postMessage({ method: "addEventListener", value: "play" }, "*");
        target.postMessage({ method: "addEventListener", value: "pause" }, "*");
        target.postMessage({ method: "addEventListener", value: "ended" }, "*");
      }
    }, 500);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("message", handleMessage);
    };
  }, [onPlayingChange, onTimeUpdate, src]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      style={{
        width: "100%",
        height: "100%",
        border: 0,
        background: "#252525",
        display: "block",
      }}
    />
  );
}

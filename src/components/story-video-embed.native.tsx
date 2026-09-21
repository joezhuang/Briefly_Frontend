import { type ComponentRef, useEffect, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

type Props = {
  src: string;
  title: string;
  initialTime?: number;
  onTimeUpdate?: (seconds: number) => void;
  onPlayingChange?: (playing: boolean) => void;
};

const DEFAULT_REFERRER = "https://briefly.app";

function normalizeOrigin(value: string | undefined) {
  const candidate = String(value || "").trim();
  if (!candidate) return DEFAULT_REFERRER;
  try {
    return new URL(candidate).origin;
  } catch {
    return DEFAULT_REFERRER;
  }
}

function identifiedEmbedUrl(src: string, referrer: string) {
  try {
    const url = new URL(src);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      url.searchParams.set("origin", referrer);
      url.searchParams.set("widget_referrer", referrer);
    }
    return url.toString();
  } catch {
    return src;
  }
}

function progressScript(initialTime: number) {
  const start = Number.isFinite(initialTime) && initialTime > 0 ? initialTime : 0;
  return `
    (function () {
      var desiredStart = ${JSON.stringify(start)};
      var didSeek = desiredStart <= 0;
      var lastPlaying = null;
      function report() {
        try {
          var video = document.querySelector('video');
          if (!video) return;
          if (!didSeek && isFinite(video.duration) && video.duration > 0) {
            video.currentTime = Math.min(desiredStart, Math.max(0, video.duration - 0.05));
            didSeek = true;
          }
          var current = Number(video.currentTime || 0);
          var playing = !video.paused && !video.ended;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'briefly-video-progress',
            currentTime: current,
            playing: playing
          }));
          if (lastPlaying !== playing) lastPlaying = playing;
        } catch (e) {}
      }
      setInterval(report, 500);
      report();
    })();
    true;
  `;
}

export default function StoryVideoEmbed({
  src,
  title,
  initialTime = 0,
  onTimeUpdate,
  onPlayingChange,
}: Props) {
  const webViewRef = useRef<ComponentRef<typeof WebView>>(null);
  const referrer = useMemo(
    () => normalizeOrigin(process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL),
    [],
  );
  const identifiedSrc = useMemo(
    () => identifiedEmbedUrl(src, referrer),
    [src, referrer],
  );
  const injectedJavaScript = useMemo(
    () => progressScript(initialTime),
    [initialTime],
  );

  useEffect(() => {
    const activeWebView = webViewRef.current;
    return () => {
      try {
        activeWebView?.injectJavaScript(`
          (function () {
            try {
              var video = document.querySelector('video');
              if (video) {
                video.pause();
                video.removeAttribute('src');
                video.load();
              }
            } catch (e) {}
            try {
              window.location.replace('about:blank');
            } catch (e) {}
          })();
          true;
        `);
      } catch {}
    };
  }, [identifiedSrc]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload?.type !== "briefly-video-progress") return;
      const seconds = Number(payload.currentTime);
      if (Number.isFinite(seconds)) onTimeUpdate?.(Math.max(0, seconds));
      if (typeof payload.playing === "boolean") {
        onPlayingChange?.(payload.playing);
      }
    } catch {}
  };

  return (
    <WebView
      ref={webViewRef}
      source={{
        uri: identifiedSrc,
        headers: {
          Referer: referrer,
          Origin: referrer,
        },
      }}
      style={StyleSheet.absoluteFill}
      accessibilityLabel={title}
      javaScriptEnabled
      domStorageEnabled
      injectedJavaScript={injectedJavaScript}
      onMessage={handleMessage}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      originWhitelist={["https://*", "http://*"]}
    />
  );
}

import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

type Props = {
  src: string;
  title: string;
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

export default function StoryVideoEmbed({ src, title }: Props) {
  const referrer = useMemo(
    () => normalizeOrigin(process.env.EXPO_PUBLIC_BRIEFLY_WEB_URL),
    [],
  );
  const identifiedSrc = useMemo(
    () => identifiedEmbedUrl(src, referrer),
    [src, referrer],
  );

  return (
    <WebView
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
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      originWhitelist={["https://*", "http://*"]}
    />
  );
}

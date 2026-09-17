import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

type Props = {
  src: string;
  title: string;
};

export default function StoryVideoEmbed({ src, title }: Props) {
  return (
    <WebView
      source={{ uri: src }}
      style={StyleSheet.absoluteFill}
      accessibilityLabel={title}
      javaScriptEnabled
      domStorageEnabled
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
    />
  );
}

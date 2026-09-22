import { Image } from "expo-image";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

type MarkProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

type LogoProps = {
  markSize?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

type FallbackProps = {
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

const ringMark = require("../../assets/images/briefly-ring-mark.png");
const splashFallback = require("../../assets/images/splash-icon.png");

export function BrieflyMark({ size = 32, style }: MarkProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[{ width: size, height: size }, style]}
    >
      <Image
        source={ringMark}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
      />
    </View>
  );
}

export function BrieflyLogo({
  markSize = 32,
  color,
  style,
  textStyle,
}: LogoProps) {
  return (
    <View style={[styles.logo, style]}>
      <BrieflyMark size={markSize} />
      <Text
        numberOfLines={1}
        style={[
          styles.wordmark,
          {
            color,
            fontSize: markSize * 0.78,
            lineHeight: markSize * 0.9,
          },
          textStyle,
        ]}
      >
        Briefly
      </Text>
    </View>
  );
}

export function BrieflyMediaFallback({
  compact = false,
  style,
}: FallbackProps) {
  return (
    <View style={[styles.mediaFallback, style]}>
      <Image
        source={splashFallback}
        style={[
          styles.fallbackImage,
          compact && styles.fallbackImageCompact,
        ]}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 9,
  },
  wordmark: {
    flexShrink: 0,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  mediaFallback: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  fallbackImage: {
    width: "82%",
    height: "82%",
  },
  fallbackImageCompact: {
    width: "88%",
    height: "88%",
  },
});

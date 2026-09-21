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

export function BrieflyMark({ size = 32, style }: MarkProps) {
  const circle = size * 0.62;
  const radius = circle / 2;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[{ width: size, height: size }, style]}
    >
      <View
        style={[
          styles.circle,
          {
            width: circle,
            height: circle,
            borderRadius: radius,
            left: size * 0.02,
            top: size * 0.35,
            backgroundColor: "rgba(24, 70, 118, 0.88)",
          },
        ]}
      />
      <View
        style={[
          styles.circle,
          {
            width: circle,
            height: circle,
            borderRadius: radius,
            left: size * 0.36,
            top: size * 0.35,
            backgroundColor: "rgba(91, 110, 136, 0.88)",
          },
        ]}
      />
      <View
        style={[
          styles.circle,
          {
            width: circle,
            height: circle,
            borderRadius: radius,
            left: size * 0.19,
            top: size * 0.02,
            backgroundColor: "rgba(19, 154, 243, 0.88)",
          },
        ]}
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
  const markSize = compact ? 58 : 102;

  return (
    <View style={[styles.mediaFallback, style]}>
      <View style={styles.fallbackGlow} />
      <BrieflyMark size={markSize} />
      <Text
        style={[
          styles.fallbackWordmark,
          compact && styles.fallbackWordmarkCompact,
        ]}
      >
        Briefly
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    position: "absolute",
  },
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
    gap: 10,
    backgroundColor: "#0B172A",
  },
  fallbackGlow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(19, 154, 243, 0.09)",
  },
  fallbackWordmark: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  fallbackWordmarkCompact: {
    fontSize: 18,
    lineHeight: 21,
    letterSpacing: -0.4,
  },
});

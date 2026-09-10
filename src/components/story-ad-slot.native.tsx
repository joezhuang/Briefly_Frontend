import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";

export function StoryAdSlot() {
  const { width } = useWindowDimensions();
  const configuredUnit =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_STORY_BANNER_UNIT_ID
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_STORY_BANNER_UNIT_ID;
  const compact = width < 600;

  return (
    <View style={[styles.container, compact ? styles.phone : styles.tablet]}>
      <BannerAd
        unitId={configuredUnit?.trim() || TestIds.BANNER}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: "100%",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: "rgba(0, 0, 0, 0.12)",
    borderRadius: 12,
    overflow: "hidden",
  },
  phone: {
    width: 320,
    height: 50,
  },
  tablet: {
    width: 728,
    height: 90,
  },
});

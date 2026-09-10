import { Platform, StyleSheet, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";

export function StoryAdSlot() {
  const configuredUnit =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_STORY_BANNER_UNIT_ID
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_STORY_BANNER_UNIT_ID;

  return (
    <View style={styles.container}>
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
    width: "100%",
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 18,
    paddingBottom: 8,
    paddingHorizontal: 0,
  },
});

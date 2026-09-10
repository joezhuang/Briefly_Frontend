import { Platform, StyleSheet, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";

export function HomeAdSlot() {
  const configuredUnit =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_HOME_BANNER_UNIT_ID
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_HOME_BANNER_UNIT_ID;

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
    alignSelf: "center",
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 0,
    backgroundColor: "rgba(0, 0, 0, 0.12)",
    borderRadius: 12,
    overflow: "hidden",
  },
});

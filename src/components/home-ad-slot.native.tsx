import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";

type AdDimensions = { width: number; height: number };

export function HomeAdSlot() {
  const [adDimensions, setAdDimensions] = useState<AdDimensions | null>(null);
  const configuredUnit =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_HOME_BANNER_UNIT_ID
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_HOME_BANNER_UNIT_ID;

  const handleSize = ({ width, height }: AdDimensions) => {
    if (width > 0 && height > 0) {
      setAdDimensions({ width, height });
    }
  };

  return (
    <View
      style={[
        styles.container,
        adDimensions && {
          width: adDimensions.width,
          height: adDimensions.height,
        },
      ]}
    >
      <BannerAd
        unitId={configuredUnit?.trim() || TestIds.BANNER}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={handleSize}
        onSizeChange={handleSize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.12)",
    borderRadius: 12,
    overflow: "hidden",
  },
});

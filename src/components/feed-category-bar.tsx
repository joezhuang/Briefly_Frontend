import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import type { HomepageFeedScope } from "@/api/briefly";
import { useBrieflyAppConfig } from "@/context/app-config";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

export type FeedCategory = HomepageFeedScope | "following" | "search";

const feedScopeOrder: HomepageFeedScope[] = ["top", "national", "local"];

const compactFeedLabels = {
  en: { top: "Top", national: "Nat’l", local: "Local", following: "Follow" },
  es: { top: "Dest.", national: "Nac.", local: "Local", following: "Siguiendo" },
  ja: { top: "トップ", national: "国内", local: "地域", following: "フォロー" },
  "zh-CN": { top: "头条", national: "全国", local: "本地", following: "关注" },
  "zh-TW": { top: "頭條", national: "全國", local: "本地", following: "關注" },
} as const;

const feedLabels = {
  en: { top: "Top", national: "National", local: "Local", following: "Following" },
  es: { top: "Principal", national: "Nacional", local: "Local", following: "Siguiendo" },
  ja: { top: "トップ", national: "国内", local: "地域", following: "フォロー中" },
  "zh-CN": { top: "头条", national: "全国", local: "本地", following: "关注" },
  "zh-TW": { top: "頭條", national: "全國", local: "本地", following: "關注" },
} as const;

export function enabledFeedCategories(config: ReturnType<typeof useBrieflyAppConfig>["config"]): HomepageFeedScope[] {
  if (!config) return feedScopeOrder;
  const enabled = feedScopeOrder.filter((item) => {
    if (item === "top") return config.top_feed_enabled !== false;
    if (item === "national") return config.national_feed_enabled !== false;
    return config.local_feed_enabled !== false;
  });
  return enabled.length ? enabled : ["top"];
}

export function FeedCategoryBar({
  active,
  onFeedScopePress,
}: {
  active: FeedCategory;
  onFeedScopePress?: (scope: HomepageFeedScope) => void;
}) {
  const { width } = useWindowDimensions();
  const { config } = useBrieflyAppConfig();
  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();
  const scroller = useRef<ScrollView>(null);
  const labels = feedLabels[language] ?? feedLabels.en;
  const compactLabels = compactFeedLabels[language] ?? compactFeedLabels.en;
  const compact = width < 480;
  const categories: Exclude<FeedCategory, "search">[] = [
    ...enabledFeedCategories(config),
    ...(config?.following_enabled !== false ? (["following"] as const) : []),
  ];
  const searchEnabled = config?.search_enabled !== false;

  useEffect(() => {
    if (active === "following") {
      scroller.current?.scrollToEnd({ animated: false });
    } else {
      scroller.current?.scrollTo({ x: 0, animated: false });
    }
  }, [active]);

  const selectCategory = (category: FeedCategory) => {
    if (category === "following") {
      router.push("/following" as never);
    } else if (category === "search") {
      router.push("/search" as never);
    } else if (onFeedScopePress) {
      onFeedScopePress(category);
    } else {
      router.push(`/?feedScope=${category}` as never);
    }
  };

  const tabStyle = (selected: boolean) => [
    styles.tab,
    compact && styles.compactTab,
    {
      borderColor: selected ? colors.text : colors.border,
      backgroundColor: selected ? colors.text : "transparent",
    },
  ];

  const categoryButtons = categories.map((category) => {
    const selected = active === category;
    return (
      <Pressable
        key={category}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={labels[category]}
        onPress={() => selectCategory(category)}
        style={[...tabStyle(selected), compact && styles.compactCategory]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.tabText,
            compact && styles.compactTabText,
            { color: selected ? colors.background : colors.textMuted },
          ]}
        >
          {compact ? compactLabels[category] : labels[category]}
        </Text>
      </Pressable>
    );
  });

  return (
    <View style={[styles.bar, compact && styles.compactBar]} accessibilityRole="tablist">
      {compact ? (
        <View style={[styles.categories, styles.compactCategories]}>
          {categoryButtons}
        </View>
      ) : (
        <ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scroller}
          contentContainerStyle={styles.categories}
        >
          {categoryButtons}
        </ScrollView>
      )}
      {searchEnabled && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.search}
          accessibilityState={{ selected: active === "search" }}
          onPress={() => selectCategory("search")}
          style={[
            ...tabStyle(active === "search"),
            compact && styles.compactSearchTab,
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.tabText,
              compact && styles.searchIcon,
              { color: active === "search" ? colors.background : colors.textMuted },
            ]}
          >
            {width < 480 ? "⌕" : t.search}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  compactBar: { gap: 4, flexWrap: "nowrap" },
  scroller: { flex: 1, minWidth: 0 },
  categories: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 2 },
  compactCategories: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingRight: 0,
    flexWrap: "nowrap",
  },
  tab: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  compactTab: { paddingHorizontal: 6 },
  compactCategory: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  compactSearchTab: { width: 40, minWidth: 40, flexShrink: 0, paddingHorizontal: 0 },
  tabText: { fontSize: 14, fontWeight: "800" },
  compactTabText: { fontSize: 12, flexShrink: 1 },
  searchIcon: { fontSize: 25, lineHeight: 28 },
});

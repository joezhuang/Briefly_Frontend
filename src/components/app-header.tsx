import { Link, usePathname } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { LANGUAGES, useBrieflyLanguage } from "@/context/language";
import {
  BrieflyThemeMode,
  useBrieflyTheme,
} from "@/context/theme";

const nav = [
  { href: "/", key: "home" },
  { href: "/saved", key: "saved" },
  { href: "/search", key: "search" },
] as const;

const themeModes: BrieflyThemeMode[] = ["system", "light", "dark"];

export function AppHeader() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useBrieflyLanguage();
  const { mode, setMode, colors } = useBrieflyTheme();

  const themeLabel = (value: BrieflyThemeMode) => {
    if (value === "light") return t.themeLight;
    if (value === "dark") return t.themeDark;
    return t.themeSystem;
  };

  return (
    <View
      style={[
        styles.wrap,
        { borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.row}>
        <Link href="/" asChild>
          <Pressable>
            <Text style={[styles.logo, { color: colors.accentSoft }]}>
              BRIEFLY
            </Text>
          </Pressable>
        </Link>

        <View style={styles.nav}>
          {nav.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link href={item.href} key={item.href} asChild>
                <Pressable>
                  <Text
                    style={[
                      styles.navText,
                      { color: active ? colors.text : colors.textMuted },
                      active && styles.active,
                    ]}
                  >
                    {t[item.key]}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      </View>

      <View style={styles.controls}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.languages}
        >
          {LANGUAGES.map((item) => {
            const active = language === item.code;
            return (
              <Pressable
                key={item.code}
                onPress={() => setLanguage(item.code)}
                style={[
                  styles.pill,
                  {
                    borderColor: active ? colors.text : colors.border,
                    backgroundColor: active ? colors.text : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: active ? colors.background : colors.textMuted },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.themes}
        >
          {themeModes.map((item) => {
            const active = mode === item;
            return (
              <Pressable
                key={item}
                onPress={() => setMode(item)}
                style={[
                  styles.pill,
                  {
                    borderColor: active ? colors.accent : colors.border,
                    backgroundColor: active ? colors.surfaceMuted : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.themeText,
                    { color: active ? colors.accent : colors.textMuted },
                  ]}
                >
                  {themeLabel(item)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    gap: 10,
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },
  logo: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 3,
  },
  nav: {
    flexDirection: "row",
    gap: 20,
  },
  navText: {
    fontSize: 15,
  },
  active: {
    fontWeight: "800",
  },
  controls: {
    gap: 8,
  },
  languages: {
    gap: 7,
    paddingRight: 8,
  },
  themes: {
    gap: 7,
    paddingRight: 8,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  themeText: {
    fontSize: 11,
    fontWeight: "700",
  },
});

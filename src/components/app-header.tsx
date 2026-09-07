import { Link, usePathname } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { LANGUAGES, useBrieflyLanguage } from "@/context/language";
import { colors } from "@/theme/tokens";

const nav = [
  { href: "/", label: "Home" },
  { href: "/saved", label: "Saved" },
  { href: "/search", label: "Search" },
] as const;

export function AppHeader() {
  const pathname = usePathname();
  const { language, setLanguage } = useBrieflyLanguage();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Link href="/" asChild>
          <Pressable><Text style={styles.logo}>BRIEFLY</Text></Pressable>
        </Link>
        <View style={styles.nav}>
          {nav.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link href={item.href} key={item.href} asChild>
                <Pressable><Text style={[styles.navText, active && styles.active]}>{item.label}</Text></Pressable>
              </Link>
            );
          })}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languages}>
        {LANGUAGES.map((item) => (
          <Pressable key={item.code} onPress={() => setLanguage(item.code)} style={[styles.language, language === item.code && styles.languageActive]}>
            <Text style={[styles.languageText, language === item.code && styles.languageTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: 12, gap: 10 },
  row: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18 },
  logo: { color: colors.accentSoft, fontSize: 24, fontWeight: "900", letterSpacing: 3 },
  nav: { flexDirection: "row", gap: 20 },
  navText: { fontSize: 15, color: colors.textMuted },
  active: { color: colors.text, fontWeight: "800" },
  languages: { gap: 7, paddingRight: 8 },
  language: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  languageActive: { backgroundColor: colors.text, borderColor: colors.text },
  languageText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  languageTextActive: { color: colors.white },
});

import { Link, router, usePathname } from "expo-router";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useBrieflyAuth } from "@/context/auth";
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

const settingsCopy = {
  en: {
    settings: "Settings",
    language: "Language",
    appearance: "Appearance",
    account: "Account",
    pro: "Briefly Pro",
    managePro: "Manage Briefly Pro",
    getPro: "Get Briefly Pro",
    close: "Close",
  },
  es: {
    settings: "Ajustes",
    language: "Idioma",
    appearance: "Apariencia",
    account: "Cuenta",
    pro: "Briefly Pro",
    managePro: "Gestionar Briefly Pro",
    getPro: "Obtener Briefly Pro",
    close: "Cerrar",
  },
  ja: {
    settings: "設定",
    language: "言語",
    appearance: "外観",
    account: "アカウント",
    pro: "Briefly Pro",
    managePro: "Briefly Proを管理",
    getPro: "Briefly Proを利用",
    close: "閉じる",
  },
  "zh-CN": {
    settings: "设置",
    language: "语言",
    appearance: "外观",
    account: "账户",
    pro: "Briefly Pro",
    managePro: "管理 Briefly Pro",
    getPro: "开通 Briefly Pro",
    close: "关闭",
  },
  "zh-TW": {
    settings: "設定",
    language: "語言",
    appearance: "外觀",
    account: "帳戶",
    pro: "Briefly Pro",
    managePro: "管理 Briefly Pro",
    getPro: "升級 Briefly Pro",
    close: "關閉",
  },
} as const;

export function AppHeader() {
  const pathname = usePathname();
  const { user, account, signOut } = useBrieflyAuth();
  const { language, setLanguage, t } = useBrieflyLanguage();
  const { mode, setMode, colors } = useBrieflyTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const labels = settingsCopy[language] ?? settingsCopy.en;
  const isPro = account?.translation_entitled === true;

  const themeLabel = (value: BrieflyThemeMode) => {
    if (value === "light") return t.themeLight;
    if (value === "dark") return t.themeDark;
    return t.themeSystem;
  };

  const closeAndNavigate = (href: "/upgrade" | "/sign-in") => {
    setSettingsOpen(false);
    router.push(href);
  };

  const handleSignOut = async () => {
    setSettingsOpen(false);
    await signOut();
  };

  return (
    <View style={[styles.wrap, { borderBottomColor: colors.border }]}>
      <View style={styles.row}>
        <Link href="/" asChild>
          <Pressable>
            <Text style={[styles.logo, { color: colors.accentSoft }]}>BRIEFLY</Text>
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={labels.settings}
            onPress={() => setSettingsOpen(true)}
            style={({ pressed }) => [
              styles.settingsButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                opacity: pressed ? 0.68 : 1,
              },
            ]}
          >
            {isPro && <Text style={[styles.proBadge, { color: colors.accent }]}>PRO</Text>}
            <Text style={[styles.settingsText, { color: colors.text }]}>
              {labels.settings}
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={settingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSettingsOpen(false)}
          />
          <View
            style={[
              styles.panel,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.panelHeader}>
              <Text style={[styles.panelTitle, { color: colors.text }]}>
                {labels.settings}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={labels.close}
                hitSlop={10}
                onPress={() => setSettingsOpen(false)}
              >
                <Text style={[styles.close, { color: colors.textMuted }]}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.panelContent}
            >
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                  {labels.language}
                </Text>
                <View style={styles.options}>
                  {LANGUAGES.map((item) => {
                    const active = language === item.code;
                    return (
                      <Pressable
                        key={item.code}
                        onPress={() => setLanguage(item.code)}
                        style={[
                          styles.option,
                          {
                            borderColor: active ? colors.text : colors.border,
                            backgroundColor: active ? colors.text : colors.surface,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            { color: active ? colors.background : colors.textMuted },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                  {labels.appearance}
                </Text>
                <View style={styles.options}>
                  {themeModes.map((item) => {
                    const active = mode === item;
                    return (
                      <Pressable
                        key={item}
                        onPress={() => setMode(item)}
                        style={[
                          styles.option,
                          {
                            borderColor: active ? colors.accent : colors.border,
                            backgroundColor: active
                              ? colors.surfaceMuted
                              : colors.surface,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            { color: active ? colors.accent : colors.textMuted },
                          ]}
                        >
                          {themeLabel(item)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                  {labels.pro}
                </Text>
                <Pressable
                  onPress={() => closeAndNavigate("/upgrade")}
                  style={[
                    styles.actionRow,
                    { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <View style={styles.actionCopy}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>
                      {isPro ? labels.managePro : labels.getPro}
                    </Text>
                    {isPro && (
                      <Text style={[styles.proBadge, { color: colors.accent }]}>PRO</Text>
                    )}
                  </View>
                  <Text style={[styles.actionArrow, { color: colors.accent }]}>→</Text>
                </Pressable>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                  {labels.account}
                </Text>
                {user ? (
                  <Pressable
                    onPress={() => void handleSignOut()}
                    style={[styles.accountButton, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.accountText, { color: colors.text }]}>
                      {t.signOut}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => closeAndNavigate("/sign-in")}
                    style={[styles.accountButton, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.accountText, { color: colors.text }]}>
                      {t.signIn}
                    </Text>
                  </Pressable>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 14,
  },
  logo: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 3,
  },
  nav: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 18,
  },
  navText: {
    fontSize: 15,
  },
  active: {
    fontWeight: "800",
  },
  settingsButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  settingsText: {
    fontSize: 13,
    fontWeight: "800",
  },
  proBadge: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    paddingTop: 72,
    paddingHorizontal: 16,
  },
  panel: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "82%",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    overflow: "hidden",
  },
  panelHeader: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  close: {
    fontSize: 30,
    lineHeight: 30,
  },
  panelContent: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    gap: 22,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    fontSize: 12,
    fontWeight: "800",
  },
  actionRow: {
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  actionCopy: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  actionArrow: {
    fontSize: 18,
    fontWeight: "900",
  },
  accountButton: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  accountText: {
    fontSize: 14,
    fontWeight: "800",
  },
});

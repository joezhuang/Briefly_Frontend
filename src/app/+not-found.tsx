import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

export default function NotFoundScreen() {
  const { t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        <Text style={[styles.brand, { color: colors.accent }]}>BRIEFLY</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          {t.pageNotFound}
        </Text>
        <Text style={[styles.message, { color: colors.textMuted }]}>
          {t.pageNotFoundMessage}
        </Text>

        <Link href="/" asChild>
          <Pressable
            style={[
              styles.button,
              {
                backgroundColor: colors.text,
                borderColor: colors.text,
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: colors.background }]}>
              {t.backHome}
            </Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  brand: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2.2,
    marginBottom: 18,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
  },
  message: {
    marginTop: 10,
    maxWidth: 520,
    fontSize: 17,
    lineHeight: 25,
    textAlign: "center",
  },
  button: {
    marginTop: 24,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  buttonText: {
    fontWeight: "800",
  },
});

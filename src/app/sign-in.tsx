import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { clearAuthReturnPath, readAuthReturnPath } from "@/auth/return-path";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import { safeReturnTo } from "@/navigation/return-to";

type Provider = "google" | "apple";

export default function SignInScreen() {
  const { returnTo } = useLocalSearchParams<{
    returnTo?: string | string[];
  }>();
  const { signInWithProvider, user } = useBrieflyAuth();
  const { t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  const [provider, setProvider] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storedReturnTo, setStoredReturnTo] = useState<string | undefined>(undefined);
  const [returnPathLoaded, setReturnPathLoaded] = useState(returnTo !== undefined);
  const returnPath = safeReturnTo(returnTo ?? storedReturnTo);

  useEffect(() => {
    void readAuthReturnPath().then((value) => {
      setStoredReturnTo(value);
      setReturnPathLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (user && returnPathLoaded) {
      void clearAuthReturnPath();
      router.replace(returnPath as never);
    }
  }, [returnPath, returnPathLoaded, user]);

  if (user) return null;

  const submit = async (nextProvider: Provider) => {
    setProvider(nextProvider);
    setError(null);

    try {
      await signInWithProvider(nextProvider, returnPath);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.signInFailed);
    } finally {
      setProvider(null);
    }
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.card}>
        <Text style={[styles.brand, { color: colors.accent }]}>BRIEFLY</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          {t.signInTitle}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t.signInSubtitle}
        </Text>

        <Pressable
          disabled={provider !== null}
          onPress={() => void submit("google")}
          style={[
            styles.button,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            provider !== null && styles.disabled,
          ]}
        >
          {provider === "google" ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.text }]}>
              {t.continueGoogle}
            </Text>
          )}
        </Pressable>

        <Pressable
          disabled={provider !== null}
          onPress={() => void submit("apple")}
          style={[
            styles.button,
            {
              backgroundColor: colors.text,
              borderColor: colors.text,
            },
            provider !== null && styles.disabled,
          ]}
        >
          {provider === "apple" ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.background }]}>
              {t.continueApple}
            </Text>
          )}
        </Pressable>

        {!!error && (
          <Text style={[styles.error, { color: colors.error }]}>
            {error}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    gap: 14,
  },
  brand: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2.2,
  },
  title: {
    marginTop: 8,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
  },
  subtitle: {
    marginBottom: 8,
    fontSize: 17,
    lineHeight: 25,
  },
  button: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "800",
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
  disabled: {
    opacity: 0.55,
  },
});

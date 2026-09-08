import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

export default function SignInScreen() {
  const { signIn, user } = useBrieflyAuth();
  const { t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      router.replace("/");
    }
  }, [user]);

  if (user) return null;

  const submit = async () => {
    if (!email.trim() || !password) return;

    setSubmitting(true);
    setError(null);

    try {
      await signIn(email, password);
      router.replace("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.signInFailed);
    } finally {
      setSubmitting(false);
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

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t.email}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          style={[
            styles.input,
            {
              borderColor: colors.border,
              color: colors.text,
              backgroundColor: colors.surface,
            },
          ]}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t.password}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          textContentType="password"
          style={[
            styles.input,
            {
              borderColor: colors.border,
              color: colors.text,
              backgroundColor: colors.surface,
            },
          ]}
          onSubmitEditing={() => void submit()}
        />

        {!!error && (
          <Text style={[styles.error, { color: colors.error }]}>
            {error}
          </Text>
        )}

        <Pressable
          disabled={submitting || !email.trim() || !password}
          onPress={() => void submit()}
          style={[
            styles.button,
            { backgroundColor: colors.text },
            (submitting || !email.trim() || !password) && styles.disabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.background }]}>
              {t.signIn}
            </Text>
          )}
        </Pressable>
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
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 17,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    minHeight: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.55,
  },
});

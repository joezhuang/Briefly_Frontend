import { router, useLocalSearchParams } from "expo-router";
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

import { getBrieflyAppConfig } from "@/api/briefly";
import { clearAuthReturnPath, readAuthReturnPath } from "@/auth/return-path";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import { safeReturnTo } from "@/navigation/return-to";

type Provider = "google" | "apple";

const emailLoginCopy = {
  en: { email: "Email", password: "Password", continue: "Continue with email", or: "or" },
  es: { email: "Correo electrónico", password: "Contraseña", continue: "Continuar con correo", or: "o" },
  ja: { email: "メール", password: "パスワード", continue: "メールで続行", or: "または" },
  "zh-CN": { email: "邮箱", password: "密码", continue: "使用邮箱登录", or: "或" },
  "zh-TW": { email: "電子郵件", password: "密碼", continue: "使用電子郵件登入", or: "或" },
} as const;


export default function SignInScreen() {
  const { returnTo } = useLocalSearchParams<{
    returnTo?: string | string[];
  }>();
  const { signIn, signInWithProvider, user } = useBrieflyAuth();
  const { language, t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  const [provider, setProvider] = useState<Provider | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailLoginEnabled, setEmailLoginEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storedReturnTo, setStoredReturnTo] = useState<string | undefined>(undefined);
  const [returnPathLoaded, setReturnPathLoaded] = useState(returnTo !== undefined);
  const returnPath = safeReturnTo(returnTo ?? storedReturnTo);
  const emailCopy = emailLoginCopy[language] ?? emailLoginCopy.en;

  useEffect(() => {
    void readAuthReturnPath().then((value) => {
      setStoredReturnTo(value);
      setReturnPathLoaded(true);
    });

    void getBrieflyAppConfig()
      .then((config) => {
        setEmailLoginEnabled(config.email_password_login_enabled === true);
        if (config.reviewer_email) setEmail(config.reviewer_email);
      })
      .catch(() => {
        setEmailLoginEnabled(false);
      });
  }, []);

  useEffect(() => {
    if (user && returnPathLoaded) {
      void clearAuthReturnPath();
      router.dismissTo(returnPath as never);
    }
  }, [returnPath, returnPathLoaded, user]);

  if (user) return null;

  const submitEmail = async () => {
    if (!email.trim() || !password) return;

    setProvider("email");
    setError(null);
    try {
      await signIn(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.signInFailed);
    } finally {
      setProvider(null);
    }
  };

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

        {emailLoginEnabled && (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder={emailCopy.email}
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType="password"
              placeholder={emailCopy.password}
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
            />
            <Pressable
              disabled={provider !== null || !email.trim() || !password}
              onPress={() => void submitEmail()}
              style={[
                styles.button,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                (provider !== null || !email.trim() || !password) && styles.disabled,
              ]}
            >
              {provider === "email" ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.text }]}>
                  {emailCopy.continue}
                </Text>
              )}
            </Pressable>
            <Text style={[styles.orText, { color: colors.textMuted }]}>
              {emailCopy.or}
            </Text>
          </>
        )}

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
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  orText: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
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

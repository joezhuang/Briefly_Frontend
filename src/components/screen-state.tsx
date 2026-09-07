import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

type Props = {
  title?: string;
  message: string;
  loading?: boolean;
  onRetry?: () => void;
};

export function ScreenState({
  title,
  message,
  loading = false,
  onRetry,
}: Props) {
  const { t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  return (
    <View style={styles.state}>
      {loading ? <ActivityIndicator size="large" color={colors.accent} /> : null}

      {title ? (
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      ) : null}

      <Text style={[styles.message, { color: colors.textMuted }]}>
        {message}
      </Text>

      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={[styles.retry, { backgroundColor: colors.text }]}
        >
          <Text style={[styles.retryText, { color: colors.background }]}>
            {t.tryAgain}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 96,
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 23,
    fontWeight: "900",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
  },
  retry: {
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    fontWeight: "800",
  },
});

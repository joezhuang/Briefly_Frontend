import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors } from "@/theme/tokens";

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
  return (
    <View style={styles.state}>
      {loading ? <ActivityIndicator size="large" /> : null}

      {title ? <Text style={styles.title}>{title}</Text> : null}

      <Text style={styles.message}>{message}</Text>

      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retry}>
          <Text style={styles.retryText}>Try again</Text>
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
    color: colors.text,
  },
  message: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: "center",
  },
  retry: {
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: colors.text,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    color: colors.white,
    fontWeight: "800",
  },
});

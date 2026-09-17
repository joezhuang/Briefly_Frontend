import { router } from "expo-router";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { captureRenderError } from "@/monitoring/error-monitoring";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureRenderError(error, info.componentStack);
  }

  private recover = () => {
    this.setState({ hasError: false });
    router.replace("/" as never);
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.screen}>
        <Text style={styles.brand}>BRIEFLY</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          Briefly encountered an unexpected error. You can return to the home
          screen and continue.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={this.recover}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>Return home</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },
  brand: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2.2,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
  },
  body: {
    maxWidth: 520,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  button: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.65,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "800",
  },
});

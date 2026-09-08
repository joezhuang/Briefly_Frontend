import { router } from "expo-router";
import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenState } from "@/components/screen-state";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";

export default function AuthCallbackScreen() {
  const { ready, user } = useBrieflyAuth();
  const { t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  useEffect(() => {
    if (ready && user) {
      router.replace("/");
    }
  }, [ready, user]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScreenState loading message={t.completingSignIn} />
    </SafeAreaView>
  );
}

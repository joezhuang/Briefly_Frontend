import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenState } from "@/components/screen-state";
import { supabase } from "@/auth/supabase";
import { useBrieflyAuth } from "@/context/auth";
import { useBrieflyLanguage } from "@/context/language";
import { useBrieflyTheme } from "@/context/theme";
import { safeReturnTo } from "@/navigation/return-to";

export default function AuthCallbackScreen() {
  const { returnTo } = useLocalSearchParams<{
    returnTo?: string | string[];
  }>();
  const { user } = useBrieflyAuth();
  const { t } = useBrieflyLanguage();
  const { colors } = useBrieflyTheme();

  const fallbackReturnTo =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem("briefly.auth.returnTo") ?? undefined
      : undefined;
  const returnPath = useMemo(
    () => safeReturnTo(returnTo ?? fallbackReturnTo),
    [fallbackReturnTo, returnTo],
  );
  const exchangeStarted = useRef(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const code =
    typeof window !== "undefined"
      ? new URL(window.location.href).searchParams.get("code")
      : null;

  useEffect(() => {
    if (user) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("briefly.auth.returnTo");
      }
      router.replace(returnPath as never);
      return;
    }

    if (exchangeStarted.current || !supabase) return;

    if (!code) return;

    exchangeStarted.current = true;

    void supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) {
        setExchangeError(exchangeError.message || t.signInFailed);
      }
    });
  }, [code, returnPath, t.signInFailed, user]);

  const error = exchangeError ?? (!user && !code ? t.signInFailed : null);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {!error ? (
        <ScreenState loading message={t.completingSignIn} />
      ) : (
        <ScreenState
          title={t.signInFailed}
          message={error}
          onRetry={() =>
            router.replace(
              `/sign-in?returnTo=${encodeURIComponent(returnPath)}` as never,
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

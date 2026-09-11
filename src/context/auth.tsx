import * as WebBrowser from "expo-web-browser";
import type { Provider, Session, User } from "@supabase/supabase-js";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

import {
  clearBrieflyAccessToken,
  setBrieflyAccessToken,
} from "@/auth/session";
import {
  getCurrentBrieflyAccount,
  type BrieflyAccountState,
} from "@/api/briefly";
import { saveAuthReturnPath } from "@/auth/return-path";
import { supabase } from "@/auth/supabase";
import { disconnectBrieflySubscriptionUser } from "@/subscriptions";

const BRIEFLY_MOBILE_AUTH_CALLBACK = "briefly://auth/callback";

type AuthContextValue = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  account: BrieflyAccountState | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithProvider: (
    provider: "google" | "apple",
    returnTo?: string,
  ) => Promise<void>;
  refreshAccount: () => Promise<BrieflyAccountState | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function BrieflyAuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(!supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<BrieflyAccountState | null>(null);

  useEffect(() => {
    let active = true;

    if (!supabase) {
      clearBrieflyAccessToken();
      return () => {
        active = false;
      };
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setBrieflyAccessToken(data.session?.access_token ?? null);
        if (data.session) {
          void getCurrentBrieflyAccount()
            .then(setAccount)
            .catch(() => setAccount(null));
        } else {
          setAccount(null);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setBrieflyAccessToken(nextSession?.access_token ?? null);
      if (nextSession) {
        void getCurrentBrieflyAccount()
          .then(setAccount)
          .catch(() => setAccount(null));
      } else {
        setAccount(null);
      }
      setReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      throw new Error("Supabase authentication is not configured.");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) throw error;

    setSession(data.session);
    setBrieflyAccessToken(data.session?.access_token ?? null);
    if (data.session) {
      setAccount(await getCurrentBrieflyAccount());
    }
  };

  const signInWithProvider = async (
    provider: "google" | "apple",
    returnTo = "/",
  ) => {
    if (!supabase) {
      throw new Error("Supabase authentication is not configured.");
    }

    await saveAuthReturnPath(returnTo);

    const redirectTo =
      Platform.OS === "web"
        ? `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`
        : BRIEFLY_MOBILE_AUTH_CALLBACK;

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem("briefly.auth.returnTo", returnTo);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options: { redirectTo },
      });
      if (error) throw error;
      return;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data.url) {
      throw new Error("OAuth provider did not return a sign-in URL.");
    }

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectTo,
    );

    if (result.type !== "success" || !result.url) {
      return;
    }

    const callback = new URL(result.url);
    if (callback.protocol !== "briefly:") {
      throw new Error("OAuth returned to the wrong app. Check the Supabase redirect URL configuration.");
    }

    const code = callback.searchParams.get("code");
    if (!code) {
      throw new Error("OAuth callback did not include an authorization code.");
    }

    const { data: sessionData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) throw exchangeError;

    setSession(sessionData.session);
    setBrieflyAccessToken(sessionData.session?.access_token ?? null);
    setAccount(await getCurrentBrieflyAccount());
  };

  const refreshAccount = useCallback(async () => {
    if (!session) {
      setAccount(null);
      return null;
    }

    const next = await getCurrentBrieflyAccount();
    setAccount(next);
    return next;
  }, [session]);

  const signOut = async () => {
    if (Platform.OS === "ios" || Platform.OS === "android") {
      await disconnectBrieflySubscriptionUser().catch(() => null);
    }

    if (!supabase) {
      clearBrieflyAccessToken();
      setSession(null);
      setAccount(null);
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    clearBrieflyAccessToken();
    setSession(null);
    setAccount(null);
  };

  const value = useMemo(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      account,
      signIn,
      signInWithProvider,
      refreshAccount,
      signOut,
    }),
    [ready, session, account, refreshAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useBrieflyAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useBrieflyAuth must be used inside BrieflyAuthProvider");
  }
  return value;
}

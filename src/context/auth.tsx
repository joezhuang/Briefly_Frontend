import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  clearBrieflyAccessToken,
  setBrieflyAccessToken,
} from "@/auth/session";
import {
  getCurrentBrieflyAccount,
  type BrieflyAccountState,
} from "@/api/briefly";
import { supabase } from "@/auth/supabase";

type AuthContextValue = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  account: BrieflyAccountState | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function BrieflyAuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<BrieflyAccountState | null>(null);

  useEffect(() => {
    let active = true;

    if (!supabase) {
      clearBrieflyAccessToken();
      setReady(true);
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

  const signOut = async () => {
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
      signOut,
    }),
    [ready, session, account],
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

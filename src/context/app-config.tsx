import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import {
  getBrieflyAppConfig,
  type BrieflyAppConfig,
} from "@/api/briefly";

const APP_CONFIG_REFRESH_MS = 60_000;

type BrieflyAppConfigContextValue = {
  config: BrieflyAppConfig | null;
  refresh: () => Promise<void>;
  applyConfig: (next: BrieflyAppConfig) => void;
};

const BrieflyAppConfigContext =
  createContext<BrieflyAppConfigContextValue | null>(null);

function sameConfig(
  current: BrieflyAppConfig | null,
  next: BrieflyAppConfig,
) {
  if (!current) return false;

  const currentKeys = Object.keys(current) as (keyof BrieflyAppConfig)[];
  const nextKeys = Object.keys(next) as (keyof BrieflyAppConfig)[];
  if (currentKeys.length !== nextKeys.length) return false;

  return nextKeys.every((key) => current[key] === next[key]);
}

export function BrieflyAppConfigProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<BrieflyAppConfig | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const applyConfig = useCallback((next: BrieflyAppConfig) => {
    setConfig((current) => (sameConfig(current, next) ? current : next));
  }, []);

  const refresh = useCallback(() => {
    if (inFlightRef.current) return inFlightRef.current;

    const request = getBrieflyAppConfig()
      .then((next) => {
        applyConfig(next);
      })
      .catch(() => {
        // Keep the last known in-memory configuration on transient failures.
      });

    inFlightRef.current = request;
    void request.finally(() => {
      if (inFlightRef.current === request) {
        inFlightRef.current = null;
      }
    });
    return request;
  }, [applyConfig]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    };

    const startPolling = () => {
      stopPolling();
      interval = setInterval(() => {
        void refresh();
      }, APP_CONFIG_REFRESH_MS);
    };

    void refresh();
    if (AppState.currentState === "active") {
      startPolling();
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refresh();
        startPolling();
        return;
      }
      stopPolling();
    });

    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ config, refresh, applyConfig }),
    [applyConfig, config, refresh],
  );

  return (
    <BrieflyAppConfigContext.Provider value={value}>
      {children}
    </BrieflyAppConfigContext.Provider>
  );
}

export function useBrieflyAppConfig() {
  const context = useContext(BrieflyAppConfigContext);
  if (!context) {
    throw new Error(
      "useBrieflyAppConfig must be used within BrieflyAppConfigProvider",
    );
  }
  return context;
}

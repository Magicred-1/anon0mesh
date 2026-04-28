import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import * as haptics from "@/src/design-system/haptics";
import { PrefKeys, prefGet, prefSet } from "@/src/storage";

interface HideBalanceValue {
  hidden: boolean;
  toggle: () => void;
}

const HideBalanceContext = createContext<HideBalanceValue | null>(null);

// Provider wraps any screen displaying a sensitive balance so the
// header eye toggle and the balance below it stay in sync across
// re-renders, and the preference survives app restart.
export function HideBalanceProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  // Hydrate from storage on mount.
  useEffect(() => {
    let alive = true;
    prefGet(PrefKeys.HIDE_BALANCE).then((value) => {
      if (!alive) return;
      setHidden(value === "true");
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = useCallback(() => {
    haptics.select();
    setHidden((prev) => {
      const next = !prev;
      prefSet(PrefKeys.HIDE_BALANCE, next ? "true" : "false");
      return next;
    });
  }, []);

  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle]);

  return <HideBalanceContext.Provider value={value}>{children}</HideBalanceContext.Provider>;
}

export function useHideBalance(): HideBalanceValue {
  const ctx = useContext(HideBalanceContext);
  if (!ctx) {
    throw new Error("useHideBalance must be used inside HideBalanceProvider");
  }
  return ctx;
}

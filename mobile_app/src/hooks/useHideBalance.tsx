import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import * as haptics from "@/src/design-system/haptics";

interface HideBalanceValue {
  hidden: boolean;
  toggle: () => void;
}

const HideBalanceContext = createContext<HideBalanceValue | null>(null);

// Provider wraps any screen displaying a sensitive balance so the
// header eye toggle and the balance below it stay in sync.
//
// NOTE: Persistence across app restart is deferred — requires
// @react-native-async-storage/async-storage which isn't in upstream deps
// yet. Add the dep and restore AsyncStorage hydration when port stabilizes.
export function HideBalanceProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  const toggle = useCallback(() => {
    haptics.select();
    setHidden((prev) => !prev);
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

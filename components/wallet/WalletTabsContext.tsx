import { createContext, useContext } from 'react';

type Tab = 'wallet' | 'swap' | 'send';

type WalletTabsContextType = {
    tab: Tab;
    setTab: (t: Tab) => void;
    showSettings: boolean;
    setShowSettings: (show: boolean) => void;
};

const defaultValue: WalletTabsContextType = {
    tab: 'wallet',
    setTab: () => {},
    showSettings: false,
    setShowSettings: () => {},
};

const WalletTabsContext = createContext(defaultValue);

export const WalletTabsProvider = WalletTabsContext.Provider;

export function useWalletTabs() {
    return useContext(WalletTabsContext);
}

export default WalletTabsContext;

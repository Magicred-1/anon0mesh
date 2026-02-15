/**
 * React Hook for Stealth Wallet
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { StealthAddressResult } from "../lib/stealth/StealthAddressGenerator";
import { ScannedPayment } from "../lib/stealth/StealthScanner";
import {
    StealthPayment,
    StealthWalletManager,
} from "../lib/stealth/StealthWalletManager";

export function useStealthWallet(connection: Connection) {
  const [manager] = useState(() => new StealthWalletManager(connection));
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [metaAddress, setMetaAddress] = useState<string>("");
  const [payments, setPayments] = useState<StealthPayment[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  // Initialize stealth wallet
  useEffect(() => {
    const init = async () => {
      try {
        await manager.initialize();
        setMetaAddress(manager.getMetaAddress());
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize stealth wallet:", error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [manager]);

  // Scan for incoming payments
  const scanForPayments = useCallback(
    async (limit: number = 100) => {
      if (!isInitialized) return;

      setIsScanning(true);
      try {
        const scanned = await manager.scanForPayments(limit);
        const allPayments = manager.getPayments();
        setPayments(allPayments);

        // Update total balance
        const balance = await manager.getTotalStealthBalance();
        setTotalBalance(balance);

        return scanned;
      } catch (error) {
        console.error("Failed to scan for payments:", error);
        return [];
      } finally {
        setIsScanning(false);
      }
    },
    [manager, isInitialized],
  );

  // Generate stealth address for sending
  const generatePaymentAddress = useCallback(
    async (
      recipientMetaAddress: string,
    ): Promise<StealthAddressResult | null> => {
      if (!isInitialized) return null;

      try {
        return await manager.generatePaymentAddress(recipientMetaAddress);
      } catch (error) {
        console.error("Failed to generate payment address:", error);
        return null;
      }
    },
    [manager, isInitialized],
  );

  // Shield funds to stealth address
  const shieldFunds = useCallback(
    async (amount: number, signerKeypair: any): Promise<string | null> => {
      if (!isInitialized) return null;

      try {
        const signature = await manager.shieldFromWallet(amount, signerKeypair);

        // Refresh payments
        await scanForPayments();

        return signature;
      } catch (error) {
        console.error("Failed to shield funds:", error);
        return null;
      }
    },
    [manager, isInitialized, scanForPayments],
  );

  // Unshield funds to main wallet
  const unshieldFunds = useCallback(
    async (
      mainWalletAddress: PublicKey,
      selectedPayments: ScannedPayment[],
    ): Promise<string[]> => {
      if (!isInitialized) return [];

      try {
        const signatures = await manager.unshieldToWallet(
          mainWalletAddress,
          selectedPayments,
        );

        // Refresh payments
        await scanForPayments();

        return signatures;
      } catch (error) {
        console.error("Failed to unshield funds:", error);
        return [];
      }
    },
    [manager, isInitialized, scanForPayments],
  );

  // Get total balance
  const refreshBalance = useCallback(async () => {
    if (!isInitialized) return;

    try {
      const balance = await manager.getTotalStealthBalance();
      setTotalBalance(balance);
    } catch (error) {
      console.error("Failed to refresh balance:", error);
    }
  }, [manager, isInitialized]);

  // Export wallet for backup
  const exportWallet = useCallback(() => {
    if (!isInitialized) return null;

    try {
      return manager.exportWallet();
    } catch (error) {
      console.error("Failed to export wallet:", error);
      return null;
    }
  }, [manager, isInitialized]);

  return {
    isInitialized,
    isLoading,
    metaAddress,
    payments,
    totalBalance,
    isScanning,
    scanForPayments,
    generatePaymentAddress,
    shieldFunds,
    unshieldFunds,
    refreshBalance,
    exportWallet,
  };
}

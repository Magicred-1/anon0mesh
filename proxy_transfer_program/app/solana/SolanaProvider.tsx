import { useEffect, useState } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import { Outlet } from "react-router";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  LedgerWalletAdapter,
  UnsafeBurnerWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { BaseSignerWalletAdapter } from "@solana/wallet-adapter-base";

const SOLANA_LOCALNET = window.location.href.split("/preview")[0] + "/preview/local-validator";

enum Network {
  Mainnet = "mainnet-beta",
  Testnet = "testnet",
  Devnet = "devnet",
  Localnet = "localnet",
}

export default function SolanaProvider() {
  const [endpoint, setEndpoint] = useState<string>(SOLANA_LOCALNET);
  const [wallets, setWallets] = useState<BaseSignerWalletAdapter[]>([]);

  useEffect(() => {
    const main = async () => {
      // Configure the Solana Network
      if (import.meta.env.VITE_SOLANA_RPC_URL) {
        setEndpoint(import.meta.env.VITE_SOLANA_RPC_URL);
      } else {
        let networkEnvVar = import.meta.env.VITE_SOLANA_NETWORK as
          | "mainnet-beta"
          | "testnet"
          | "devnet"
          | "localnet"
          | undefined;

        if (!networkEnvVar) {
          console.warn(
            "Env var VITE_SOLANA_NETWORK is undefined, defaulting to:",
            Network.Localnet,
          );
          networkEnvVar = Network.Localnet;
        }

        if (
          networkEnvVar !== Network.Mainnet &&
          networkEnvVar !== Network.Testnet &&
          networkEnvVar !== Network.Devnet &&
          networkEnvVar !== Network.Localnet
        ) {
          console.error(
            "Env var VITE_SOLANA_NETWORK is invalid, defaulting to:",
            Network.Localnet,
          );
          networkEnvVar = Network.Localnet;
        }

        setEndpoint(
          networkEnvVar === Network.Localnet
            ? SOLANA_LOCALNET
            : clusterApiUrl(networkEnvVar),
        );
      }

      // Configure the available wallets
      let walletsEnvVar = import.meta.env.VITE_SOLANA_WALLETS;

      if (!walletsEnvVar || typeof walletsEnvVar !== "string") {
        console.warn(
          "Env var VITE_SOLANA_WALLETS is undefined, defaulting to: PhantomWalletAdapter, SolflareWalletAdapter, LedgerWalletAdapter and UnsafeBurnerWalletAdapter",
        );
        setWallets([
          new PhantomWalletAdapter(),
          new SolflareWalletAdapter(),
          new LedgerWalletAdapter(),
          new UnsafeBurnerWalletAdapter(),
        ]);
      } else {
        const walletsToImport = walletsEnvVar.split(",").map((n) => n.trim());
        const module = await import("@solana/wallet-adapter-wallets");
        const walletList = new Array<BaseSignerWalletAdapter>();

        for (const className of walletsToImport) {
          if (className in module) {
            const WalletClass = module[className as keyof typeof module];
            walletList.push(new (WalletClass as any)());
          }
        }

        setWallets(walletList);
      }
    };

    main();
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider autoConnect wallets={wallets}>
        <Outlet />
      </WalletProvider>
    </ConnectionProvider>
  );
}
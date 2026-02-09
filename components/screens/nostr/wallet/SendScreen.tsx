/**
 * SendScreen - Send SOL, USDC, and ZEC transactions
 *
 * Supports three transaction modes:
 * 1. Online (Internet) - Standard Solana transactions
 * 2. BLE Mesh - Peer-to-peer mesh network transactions
 * 3. Offline Wallets - Durable nonce accounts via BLE (BLE-only)
 *
 * ✨ v2.0 Improvement: Transactions Flow Like Messages
 * - Transactions are broadcast to all connected peers like regular messages
 * - Uses existing mesh sessions - no new handshakes needed
 * - Any peer can accept the transaction and be the second signer
 * - No timeout delays - transactions flow through established sessions
 *
 * ✨ v1.3.0 Improvement: Non-blocking Handshakes
 * - Transactions are sent immediately to native layer
 * - Noise protocol handshakes happen asynchronously in background
 * - No more 5-second timeout delays!
 * - Native layer automatically queues messages if session isn't ready
 *
 * Offline wallets use durable nonce accounts which:
 * - Create transactions that NEVER expire
 * - Enable truly offline transaction signing
 * - Can be broadcast via BLE mesh and relayed to Solana network later
 */

import SolanaIcon from "@/components/icons/SolanaIcon";
import USDCIcon from "@/components/icons/USDCIcon";
import ZECIcon from "@/components/icons/ZECIcon";
import QRScannerModal from "@/components/modals/QRScannerModal";
import SendConfirmationModal from "@/components/modals/SendConfirmationModal";
import NumericKeyboard from "@/components/ui/NumericKeyboard";
import { useMWAOfflineWallets } from "@/hooks/useMWAOfflineWallets";
import { useOfflineWallets } from "@/hooks/useOfflineWallets";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { useWallet } from "@/src/contexts/WalletContext";
import { Packet } from "@/src/domain/entities/Packet";
// import { useBLENotificationUpdater } from "@/src/hooks/useBLENotificationUpdater";
import {
  TransactionApprovalModal,
  useMeshChat,
} from "@/src/contexts/MeshBLEContext";
import { useSolanaTransaction } from "@/src/hooks/useSolanaTransaction";
import { IWalletAdapter } from "@/src/infrastructure/wallet/transaction/MWADurableNonce";
import type { ConnectivityStatus } from "@/src/infrastructure/wallet/utils/connectivity";
import * as ConnectivityUtils from "@/src/infrastructure/wallet/utils/connectivity";
import "@/src/polyfills";
import { createSolanaConnection } from "@/src/utils/solana";
import { PublicKey, Transaction } from "@solana/web3.js";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  CaretDown,
  CaretLeft,
  CaretUp,
  Scan,
  SlidersHorizontal,
} from "phosphor-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Type for transaction mode
type TransactionMode = "online" | "ble_mesh" | "offline_wallet";

// Wallet mode type
type WalletMode = "local" | "mwa" | "unknown";

type TokenType = "SOL" | "USDC" | "ZEC";

const USDC_DEVNET_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const SOL_USD_RATE = 141.457; // Approximate SOL/USD exchange rate

export default function SendScreen() {
  const router = useRouter();
  const {
    wallet,
    publicKey,
    isConnected,
    isLoading: isWalletLoading,
    walletMode: contextWalletMode,
  } = useWallet();
  const [amount, setAmount] = useState("0.00");
  const [token, setToken] = useState<TokenType>("SOL");
  const [recipient, setRecipient] = useState("");
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [_selectedFrom, setSelectedFrom] = useState<
    "primary" | "disposable1" | "disposable2"
  >("primary");
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [connectivity, setConnectivity] = useState<ConnectivityStatus | null>(
    null,
  );
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Use wallet balances hook
  const { balances, isRefreshing, fetchBalances } = useWalletBalances();

  // Mesh chat context for discovering nearby peers
  const {
    peers: meshPeers,
    isInitialized: bleInitialized,
    isConnected: bleConnected,
    shouldUseBLEForNonceTx,
  } = useMeshChat();

  // Map mesh peers to legacy format for compatibility
  const discoveredDevices = React.useMemo(() => {
    return meshPeers.map((p) => ({
      id: p.peerId,
      name: p.nickname,
      isConnected: p.isConnected,
    }));
  }, [meshPeers]);

  // Create a keypair from wallet for transaction signing (Local wallet mode)
  const [walletKeypair, setWalletKeypair] = useState<any>(null);

  // Use wallet mode from context (single source of truth)
  const walletMode = contextWalletMode || "unknown";

  // Transaction mode state
  const [transactionMode, setTransactionMode] =
    useState<TransactionMode>("online");
  // Multiple wallet selection (array of selected wallet IDs)
  const [selectedOfflineWalletIds, setSelectedOfflineWalletIds] = useState<
    string[]
  >([]);

  // Connection for Solana transactions (memoized to prevent recreating)
  const connection = React.useMemo(
    () => createSolanaConnection({ network: "devnet" }),
    [],
  );

  // Load keypair for local wallet mode (needed for signing)
  // Try to export - if it fails, it's an MWA wallet (which is fine)
  useEffect(() => {
    const loadLocalKeypair = async () => {
      if (!wallet || !wallet.isConnected()) return;

      try {
        // Try to export secret key (only works for LocalWalletAdapter)
        const secretKey = await wallet.exportSecretKey();
        const { Keypair } = await import("@solana/web3.js");
        const kp = Keypair.fromSecretKey(secretKey);
        setWalletKeypair(kp);
        console.log("[SendScreen] ✅ Local wallet keypair loaded");
      } catch (error) {
        // Expected for MWA wallets - they can't export keys
        console.log(
          "[SendScreen] Not a local wallet (MWA detected), skipping keypair load",
        );
      }
    };
    loadLocalKeypair();
  }, [wallet]);

  // Create MWA wallet adapter as soon as we have wallet and publicKey
  // MWA wallet = has signTransaction (exportSecretKey may exist but throws for MWA)
  const mwaWalletAdapter: IWalletAdapter | null = React.useMemo(() => {
    console.log(
      "[SendScreen] Creating MWA adapter check - wallet:",
      !!wallet,
      "publicKey:",
      !!publicKey,
    );
    if (!wallet || !publicKey) return null;

    // Check if wallet can sign transactions
    const hasSignTransaction = typeof wallet.signTransaction === "function";

    if (!hasSignTransaction) {
      console.log("[SendScreen] Wallet cannot sign, skipping adapter");
      return null;
    }

    console.log("[SendScreen] ✅ Creating MWA wallet adapter");

    return {
      getPublicKey: () => publicKey,
      signTransaction: async (transaction: Transaction) => {
        const signed = await wallet.signTransaction(transaction);
        return signed as Transaction;
      },
      signAllTransactions: async (transactions: Transaction[]) => {
        const signed = await wallet.signAllTransactions(transactions);
        return signed as Transaction[];
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey?.toBase58()]); // Only recreate when public key changes

  // Use offline wallets hook for Local wallets (only when in local mode)
  const localWalletsHook = useOfflineWallets({
    connection,
    authority: walletKeypair,
    bleMode: true,
  });

  // Use MWA offline wallets hook for MWA wallets (only when in mwa mode)
  const mwaWalletsHook = useMWAOfflineWallets({
    connection,
    walletAdapter: mwaWalletAdapter,
    bleMode: true,
  });

  // Select the appropriate hook based on wallet mode
  // For MWA mode or unknown mode with MWA adapter available, use MWA hook
  const useMWA =
    walletMode === "mwa" ||
    (walletMode === "unknown" && mwaWalletAdapter !== null);

  const {
    wallets: offlineWallets,
    isLoading: isOfflineWalletsLoading,
    isBLEMode,
    isBLEReady,
    createWallet: createOfflineWallet,
    sweepFunds,
    addFunds,
    reloadWallets,
    refreshBalances,
    createNonceTransaction,
    submitNonceTransaction,
    sendNonceTransactionBLE,
  } = useMWA ? mwaWalletsHook : localWalletsHook;

  // Debug logging
  useEffect(() => {
    console.log("[SendScreen] ========== DEBUG ==========");
    console.log("[SendScreen] Wallet mode from context:", walletMode);
    console.log("[SendScreen] Using MWA hook:", useMWA);
    console.log(
      "[SendScreen] MWA adapter available:",
      mwaWalletAdapter !== null,
    );
    console.log("[SendScreen] Offline wallets count:", offlineWallets.length);
    console.log("[SendScreen] Is MWA mode:", walletMode === "mwa");
    console.log("[SendScreen] Wallet object:", wallet ? "exists" : "null");
    console.log(
      "[SendScreen] PublicKey:",
      publicKey ? publicKey.toBase58().slice(0, 8) + "..." : "null",
    );
    console.log("[SendScreen] ==============================");
  }, [
    walletMode,
    useMWA,
    offlineWallets.length,
    mwaWalletAdapter,
    wallet,
    publicKey,
  ]);

  // Force reload wallets when MWA adapter becomes available
  useEffect(() => {
    console.log(
      "[SendScreen] Reload effect - mode:",
      walletMode,
      "adapter:",
      !!mwaWalletAdapter,
    );
    if (walletMode === "mwa" && mwaWalletAdapter && reloadWallets) {
      console.log(
        "[SendScreen] MWA adapter ready, triggering wallet reload...",
      );
      reloadWallets()
        .then(() => {
          console.log("[SendScreen] Wallet reload completed successfully");
        })
        .catch((err) => {
          console.error("[SendScreen] Failed to reload wallets:", err);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletMode, mwaWalletAdapter?.getPublicKey()?.toBase58()]);

  // Security: Clear keypair from memory when component unmounts
  useEffect(() => {
    return () => {
      if (walletKeypair?.secretKey) {
        walletKeypair.secretKey.fill(0);
      }
    };
  }, [walletKeypair]);

  // Solana transaction hook for BLE offline transactions
  const {
    sendTransactionRequest,
    pendingTransactions,
    incomingRequests,
    approveTransaction,
    rejectTransaction,
  } = useSolanaTransaction({
    connection,
    wallet: walletKeypair,
    onTransactionRequest: async (request, senderId) => {
      // Show approval UI for incoming transaction requests
      return new Promise((resolve) => {
        Alert.alert(
          "Transaction Request",
          `${senderId.slice(0, 8)} wants to co-sign a transaction.\n\n${request.memo || "No memo"}`,
          [
            { text: "Reject", style: "cancel", onPress: () => resolve(false) },
            { text: "Approve", onPress: () => resolve(true) },
          ],
        );
      });
    },
    onReceipt: (receipt) => {
      // Show receipt notification
      Alert.alert(
        receipt.status === "success"
          ? "Transaction Confirmed"
          : "Transaction Failed",
        `Signature: ${receipt.signature.slice(0, 8)}...${receipt.signature.slice(-8)}`,
        [{ text: "OK" }],
      );
    },
    onPacketReady: (packets: Packet[]) => {
      // Send packets via BLE - this will be handled by the BLE adapter
      console.log(
        "[SendScreen] Ready to send",
        packets.length,
        "packets via BLE",
      );
      // Packets will be sent automatically by the transaction service
    },
  });

  // Update BLE notification with pending transaction count
  // NOTE: useBLENotificationUpdater removed - using kard-network-ble-mesh now
  // useBLENotificationUpdater({
  //   connectedPeerCount: discoveredDevices.length,
  //   pendingTransactionCount: pendingTransactions.length,
  //   updateInterval: 5000,
  // });

  // Get balance for selected token
  const balance = balances.find((b) => b.symbol === token)?.balance ?? 0;

  // Get selected offline wallets and total balance
  const selectedOfflineWallets = offlineWallets.filter((w) =>
    selectedOfflineWalletIds.includes(w.id),
  );
  const totalOfflineBalance = selectedOfflineWallets.reduce(
    (sum, w) => sum + w.balances.sol,
    0,
  );
  const selectedWalletCount = selectedOfflineWallets.length;

  // Check connectivity
  useEffect(() => {
    const checkConnectivity = async () => {
      const status = await ConnectivityUtils.getConnectivityStatus();
      setConnectivity(status);
    };

    checkConnectivity();
    const unsubscribe =
      ConnectivityUtils.subscribeToConnectivityChanges(checkConnectivity);

    return () => {
      unsubscribe();
    };
  }, []);

  // Initialize wallet and fetch balances
  useEffect(() => {
    if (!isWalletLoading && !isConnected) {
      Alert.alert("Wallet Required", "Please connect your wallet first.");
      router.replace("/wallet" as any);
      return;
    }

    if (publicKey) {
      console.log(
        "[Send] Wallet loaded:",
        publicKey.toBase58().slice(0, 8) + "...",
      );
      // Fetch real balances from blockchain
      fetchBalances(publicKey);
    }
  }, [isConnected, isWalletLoading, publicKey, router, fetchBalances]);

  const handleCreateNewAddress = () => {
    router.push("/wallet/settings");
  };

  const handleQRScan = () => {
    setShowQRScanner(true);
  };

  const handleQRScanned = (data: string) => {
    console.log("[Send] QR scanned:", data);
    setRecipient(data);
    setShowQRScanner(false);
  };

  const handleTokenDropdown = () => {
    setShowTokenDropdown(!showTokenDropdown);
  };

  const handleSelectToken = (selectedToken: TokenType) => {
    setToken(selectedToken);
    setShowTokenDropdown(false);
  };

  const handleMaxAmount = () => {
    // Use nonce wallet balance if selected, otherwise use main wallet balance
    const currentBalance =
      selectedOfflineWalletIds.length > 0 ? totalOfflineBalance : balance;
    // Leave a small amount for transaction fees
    const maxAmount = Math.max(0, currentBalance - 0.001);
    setAmount(maxAmount.toFixed(token === "SOL" ? 4 : 2));
  };

  const handleBack = () => {
    router.back();
  };

  const handleSettings = () => {
    router.push("/wallet/settings");
  };

  const handleSendTransaction = async () => {
    if (!recipient) {
      Alert.alert("Error", "Please enter recipient address");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    if (!publicKey) {
      Alert.alert("Error", "Wallet not initialized");
      return;
    }

    // Validate recipient address
    let recipientPubKey: PublicKey;
    try {
      recipientPubKey = new PublicKey(recipient);
    } catch (error) {
      Alert.alert("Error", "Invalid recipient address");
      return;
    }

    // Check if sufficient balance based on transaction mode
    const amountNum = parseFloat(amount);
    const currentBalance =
      transactionMode === "offline_wallet" && selectedWalletCount > 0
        ? totalOfflineBalance
        : balance;

    if (amountNum > currentBalance) {
      Alert.alert(
        "Insufficient Balance",
        `You only have ${currentBalance} ${token} available`,
      );
      return;
    }

    // Only SOL and USDC transfers supported (ZEC coming soon)
    if (token === "ZEC") {
      Alert.alert(
        "Coming Soon",
        `${token} transfers will be available soon. Currently only SOL and USDC transfers are supported.`,
      );
      return;
    }

    // === OFFLINE WALLET MODE (Nonce Account via BLE) ===
    if (transactionMode === "offline_wallet") {
      if (selectedWalletCount === 0) {
        Alert.alert("Error", "Please select at least one nonce wallet");
        return;
      }

      if (!isBLEReady) {
        Alert.alert(
          "BLE Not Ready",
          "BLE mesh is not initialized. Please wait for BLE to connect.",
        );
        return;
      }

      setIsSending(true);

      try {
        console.log("[Send] 📡 Creating nonce transactions for BLE mesh broadcast...");
        console.log(`[Send] From ${selectedWalletCount} nonce wallet(s)`);
        console.log(`[Send] To: ${recipientPubKey.toBase58()}`);
        console.log(`[Send] Total Amount: ${amountNum} SOL`);
        console.log("[Send] ✨ Transactions flow like messages - any peer can co-sign!");

        // Calculate amount per wallet (split equally for now)
        const amountPerWallet = amountNum / selectedWalletCount;
        const { SystemProgram, LAMPORTS_PER_SOL } =
          await import("@solana/web3.js");

        // Create transactions for each selected wallet
        const bleRequestIds: string[] = [];

        for (const wallet of selectedOfflineWallets) {
          // Check if wallet has enough balance
          if (wallet.balances.sol < amountPerWallet) {
            console.warn(
              `[Send] Wallet ${wallet.publicKey.slice(0, 8)} has insufficient balance`,
            );
            continue;
          }

          // Create transfer instruction
          const instruction = SystemProgram.transfer({
            fromPubkey: new PublicKey(wallet.publicKey),
            toPubkey: recipientPubKey,
            lamports: amountPerWallet * LAMPORTS_PER_SOL,
          });

          // Create durable nonce transaction
          const { serialized, nonceValue } = await createNonceTransaction(
            wallet.id,
            [instruction],
          );

          console.log(
            `[Send] Nonce transaction created for ${wallet.publicKey.slice(0, 8)}, nonce: ${nonceValue.slice(0, 16)}`,
          );

          // Broadcast transaction via BLE mesh
          // ✨ Flows like a regular message to all connected peers
          // Uses existing mesh sessions - no new handshakes needed
          // Any peer can accept and be the second signer
          // firstSignerPublicKey should be the WALLET's public key (the signer), not the nonce account
          const bleRequestId = await sendNonceTransactionBLE(
            wallet.id,
            serialized,
            wallet.publicKey, // This is the actual signer (offline wallet)
            "transfer",
            {
              description: `Transfer ${amountPerWallet.toFixed(4)} SOL from ${wallet.publicKey.slice(0, 8)}`,
            },
          );

          bleRequestIds.push(bleRequestId);
        }

        if (bleRequestIds.length === 0) {
          throw new Error(
            "No transactions could be created. Check wallet balances.",
          );
        }

        Alert.alert(
          "Nonce Transactions Broadcast via BLE",
          `✨ Broadcast ${bleRequestIds.length} transaction(s) to all connected peers!\n\n` +
            `Transactions flow like regular messages through the mesh.\n` +
            `Any peer can accept and co-sign - no targeted handshakes needed.\n\n` +
            `Total Amount: ${amountNum} SOL\n` +
            `Per Wallet: ${amountPerWallet.toFixed(4)} SOL\n\n` +
            `Request IDs:\n${bleRequestIds.join("\n").slice(0, 100)}...`,
          [
            {
              text: "OK",
              onPress: () => {
                setAmount("0.00");
                setRecipient("");
                setSelectedOfflineWalletIds([]);
                router.back();
              },
            },
          ],
        );
      } catch (err) {
        console.error("[Send] Nonce transaction error:", err);
        Alert.alert(
          "Transaction Failed",
          err instanceof Error ? err.message : "Unknown error occurred",
          [{ text: "OK" }],
        );
      } finally {
        setIsSending(false);
      }
      return;
    }

    // === BLE MESH MODE (Standard) ===
    // Transactions flow like regular messages through the mesh
    // - Broadcast to all connected peers without new handshakes
    // - Uses existing mesh sessions (established during normal chat flow)
    // - Any peer can accept and be the second signer
    if (transactionMode === "ble_mesh") {
      if (!bleInitialized) {
        Alert.alert("BLE Not Ready", "Bluetooth is not initialized.");
        return;
      }

      if (discoveredDevices.length === 0) {
        Alert.alert(
          "No Peers Found",
          "No Bluetooth peers detected. Make sure there are nearby devices.",
          [{ text: "OK" }],
        );
        return;
      }

      setIsSending(true);

      try {
        console.log("[Send] 📡 Broadcasting transaction via BLE mesh...");
        console.log("[Send] Transaction flows like a regular message to all peers");
        console.log(`[Send] Amount: ${amountNum} ${token}`);
        console.log(`[Send] ${discoveredDevices.length} peer(s) available to co-sign`);

        const requestId = await sendTransactionRequest({
          recipientPubkey: recipientPubKey,
          amountSOL: token === "SOL" ? amountNum : 0,
          memo: `${token} transfer via BLE mesh`,
          // targetPeerId is not set, so it broadcasts to all peers like a public message
        });

        if (requestId) {
          const peerNames = discoveredDevices
            .map((d) => d.name || d.id.slice(0, 8))
            .join(", ");
          Alert.alert(
            "Transaction Broadcast",
            `Transaction sent to ${discoveredDevices.length} peer(s): ${peerNames}\n\nAny peer can accept and co-sign this transaction.`,
            [{ text: "OK", onPress: () => router.back() }],
          );
        }
      } catch (err) {
        console.error("[Send] BLE error:", err);
        Alert.alert(
          "Failed",
          err instanceof Error ? err.message : "Unknown error",
        );
      } finally {
        setIsSending(false);
      }
      return;
    }

    // === ONLINE MODE ===
    setIsSending(true);

    try {
      console.log("[Send] Sending online transaction...");
      console.log("[Send] Token:", token);
      console.log("[Send] From:", publicKey.toBase58());
      console.log("[Send] To:", recipientPubKey.toBase58());
      console.log("[Send] Amount:", amountNum, token);

      if (!wallet || !wallet.isConnected()) {
        throw new Error("Wallet not connected");
      }

      const walletAdapter = wallet;

      // Create connection
      const connection = createSolanaConnection({ network: "devnet" });

      // Build transaction using wallet adapter
      const {
        Transaction,
        SystemProgram,
        LAMPORTS_PER_SOL,
        TransactionInstruction,
      } = await import("@solana/web3.js");

      const transaction = new Transaction();

      if (token === "SOL") {
        // SOL transfer
        console.log("[Send] Building SOL transfer...");
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubKey,
            lamports: amountNum * LAMPORTS_PER_SOL,
          }),
        );
      } else if (token === "USDC") {
        // USDC (SPL Token) transfer - Manual implementation for React Native compatibility
        console.log("[Send] Building USDC transfer...");

        const mintPubKey = new PublicKey(USDC_DEVNET_MINT);

        // Token Program IDs
        const TOKEN_PROGRAM_ID = new PublicKey(
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        );
        const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
          "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
        );

        // Manually derive associated token addresses
        const getAssociatedTokenAddressSync = (
          mint: PublicKey,
          owner: PublicKey,
        ): PublicKey => {
          const [address] = PublicKey.findProgramAddressSync(
            [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
            ASSOCIATED_TOKEN_PROGRAM_ID,
          );
          return address;
        };

        const senderTokenAccount = getAssociatedTokenAddressSync(
          mintPubKey,
          publicKey,
        );
        const recipientTokenAccount = getAssociatedTokenAddressSync(
          mintPubKey,
          recipientPubKey,
        );

        console.log(
          "[Send] Sender token account:",
          senderTokenAccount.toBase58(),
        );
        console.log(
          "[Send] Recipient token account:",
          recipientTokenAccount.toBase58(),
        );

        // Check if recipient token account exists
        const recipientAccountInfo = await connection.getAccountInfo(
          recipientTokenAccount,
        );

        if (!recipientAccountInfo) {
          console.log(
            "[Send] Recipient token account does not exist, creating...",
          );

          // Manually create associated token account instruction
          const keys = [
            { pubkey: publicKey, isSigner: true, isWritable: true }, // payer
            {
              pubkey: recipientTokenAccount,
              isSigner: false,
              isWritable: true,
            }, // associated token account
            { pubkey: recipientPubKey, isSigner: false, isWritable: false }, // wallet address
            { pubkey: mintPubKey, isSigner: false, isWritable: false }, // token mint
            {
              pubkey: new PublicKey("11111111111111111111111111111111"),
              isSigner: false,
              isWritable: false,
            }, // system program
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token program
          ];

          transaction.add(
            new TransactionInstruction({
              keys,
              programId: ASSOCIATED_TOKEN_PROGRAM_ID,
              data: Buffer.from([]), // Create instruction has no data
            }),
          );
        }

        // Add token transfer instruction
        // USDC has 6 decimals on devnet
        const usdcDecimals = 6;
        const transferAmount = Math.floor(
          amountNum * Math.pow(10, usdcDecimals),
        );

        console.log("[Send] Transfer amount (base units):", transferAmount);

        // Manually create transfer instruction
        // Instruction: 3 (Transfer) + amount (u64, 8 bytes)
        const dataLayout = Buffer.alloc(9);
        dataLayout.writeUInt8(3, 0); // Transfer instruction
        dataLayout.writeBigUInt64LE(BigInt(transferAmount), 1);

        const transferKeys = [
          { pubkey: senderTokenAccount, isSigner: false, isWritable: true }, // source
          {
            pubkey: recipientTokenAccount,
            isSigner: false,
            isWritable: true,
          }, // destination
          { pubkey: publicKey, isSigner: true, isWritable: false }, // owner
        ];

        transaction.add(
          new TransactionInstruction({
            keys: transferKeys,
            programId: TOKEN_PROGRAM_ID,
            data: dataLayout,
          }),
        );
      }

      // Add memo
      transaction.add(
        new TransactionInstruction({
          keys: [],
          programId: new PublicKey(
            "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
          ),
          data: Buffer.from(`Sent ${token} from anon0mesh`, "utf-8"),
        }),
      );

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      console.log("[Send] Transaction built, signing...");

      // Sign transaction using wallet adapter
      const signedTransaction =
        await walletAdapter.signTransaction(transaction);

      console.log("[Send] Transaction signed, submitting...");

      // Submit transaction
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: 3,
        },
      );

      console.log("[Send] Transaction submitted:", signature);
      console.log("[Send] Waiting for confirmation...");

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      if (confirmation.value.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        );
      }

      console.log("[Send] ✅ Transaction confirmed!");

      // Refresh balances
      await fetchBalances(publicKey);

      // Show success
      Alert.alert(
        "Transaction Sent!",
        `Successfully sent ${amountNum} ${token} to ${recipientPubKey.toBase58().slice(0, 8)}...\n\nSignature: ${signature.slice(0, 8)}...`,
        [
          {
            text: "View Details",
            onPress: () => {
              // TODO: Open transaction details or explorer
              console.log("View tx:", signature);
              console.log(
                "Explorer:",
                `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
              );
            },
          },
          {
            text: "Done",
            onPress: () => {
              setShowConfirmation(true);
              // Reset form
              setAmount("0.00");
              setRecipient("");
            },
          },
        ],
      );
    } catch (error) {
      console.error("[Send] Transaction failed:", error);
      Alert.alert(
        "Transaction Failed",
        error instanceof Error ? error.message : "An unknown error occurred",
        [{ text: "OK" }],
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <LinearGradient
      colors={["#0D0D0D", "#06181B", "#072B31"]}
      locations={[0, 0.94, 1]}
      start={{ x: 0.21, y: 0 }}
      end={{ x: 0.79, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <CaretLeft size={24} color="#22D3EE" weight="regular" />
            <Text style={styles.headerTitle}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleSettings}
          >
            <SlidersHorizontal size={24} color="#fff" weight="regular" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Network Badge */}
          <View style={styles.networkBadge}>
            <View style={styles.networkIcon}>
              <SolanaIcon size={16} color="#22D3EE" />
            </View>
            <Text style={styles.networkText}>Solana Network</Text>
          </View>

          {/* Token Selector & Amount */}
          <View style={styles.amountCard}>
            <View style={styles.amountCardHeader}>
              <View style={styles.tokenSelectorContainer}>
                <TouchableOpacity
                  style={styles.tokenSelector}
                  onPress={handleTokenDropdown}
                >
                  <View style={styles.tokenIconWrapper}>
                    {token === "SOL" && (
                      <Image
                        source={require("../../../../assets/images/sol-logo.png")}
                        style={styles.tokenImage}
                      />
                    )}
                    {token === "USDC" && <USDCIcon size={24} />}
                    {token === "ZEC" && <ZECIcon size={24} />}
                  </View>
                  <Text style={styles.tokenText}>{token}</Text>
                  {showTokenDropdown ? (
                    <CaretUp size={20} color="#22D3EE" weight="regular" />
                  ) : (
                    <CaretDown size={20} color="#22D3EE" weight="regular" />
                  )}
                </TouchableOpacity>

                {/* Token Dropdown */}
                {showTokenDropdown && (
                  <View style={styles.tokenDropdown}>
                    {(["SOL", "USDC", "ZEC"] as TokenType[])
                      .filter((t) => t !== token)
                      .map((t, index) => (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.tokenOption,
                            index === 0 && styles.tokenOptionFirst,
                          ]}
                          onPress={() => handleSelectToken(t)}
                        >
                          <View style={styles.tokenIconWrapper}>
                            {t === "SOL" && (
                              <Image
                                source={require("../../../../assets/images/sol-logo.png")}
                                style={styles.tokenImage}
                              />
                            )}
                            {t === "USDC" && <USDCIcon size={24} />}
                            {t === "ZEC" && <ZECIcon size={24} />}
                          </View>
                          <Text style={styles.tokenOptionText}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
              </View>

              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                showSoftInputOnFocus={false}
                placeholder="0.00"
                placeholderTextColor="#4a6c6c"
                caretHidden={false}
              />
            </View>

            <View style={styles.balanceRow}>
              <View style={styles.balanceLeft}>
                <Text style={styles.balanceLabel}>Balance:</Text>
                {isRefreshing || isOfflineWalletsLoading ? (
                  <ActivityIndicator size="small" color="#22D3EE" />
                ) : (
                  <>
                    <Text style={styles.balanceAmount}>
                      {selectedOfflineWalletIds.length > 0
                        ? `${totalOfflineBalance.toFixed(token === "SOL" ? 4 : 2)} ${token} (nonce)`
                        : `${balance.toFixed(token === "SOL" ? 4 : 2)} ${token}`}
                    </Text>
                    {selectedOfflineWalletIds.length > 0 && (
                      <Text style={styles.nonceWalletIndicator}>
                        (Using offline wallet)
                      </Text>
                    )}
                  </>
                )}
              </View>
              {!isRefreshing && !isOfflineWalletsLoading && (
                <Text style={styles.usdValue}>
                  ≈${" "}
                  {token === "SOL"
                    ? (balance * SOL_USD_RATE).toFixed(2)
                    : token === "USDC"
                      ? balance.toFixed(2)
                      : "0.00"}
                </Text>
              )}
            </View>
          </View>

          {/* To Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>To</Text>
            <View style={styles.recipientContainer}>
              <TextInput
                style={styles.recipientInput}
                placeholder="Enter recipient address..."
                value={recipient}
                onChangeText={setRecipient}
                placeholderTextColor="#22D3EE"
              />
              <TouchableOpacity onPress={handleQRScan} style={styles.qrButton}>
                <Scan size={24} color="#22D3EE" weight="regular" />
              </TouchableOpacity>
            </View>
          </View>

          {/* From Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>From</Text>
            <View style={styles.fromContainer}>
              <TouchableOpacity
                style={styles.fromSelector}
                onPress={() => setShowFromDropdown(!showFromDropdown)}
              >
                {/* Show Primary or Nonce Wallet selection */}
                {selectedOfflineWalletIds.length > 0 ? (
                  <View style={styles.fromSelectorContent}>
                    <Text style={styles.fromPrimaryText}>Official Wallet</Text>
                    <Text style={styles.fromSecondaryText}>
                      Balance: {totalOfflineBalance.toFixed(4)} SOL
                    </Text>
                  </View>
                ) : (
                  <View style={styles.fromSelectorContent}>
                    <Text style={styles.fromPrimaryText}>
                      Primary Wallet (
                      {publicKey
                        ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
                        : "Loading..."}
                      )
                    </Text>
                    {walletMode !== "unknown" && (
                      <Text style={styles.walletModeText}>
                        {walletMode === "mwa" ? "Seeker Mode" : "🔑 Local Mode"}
                      </Text>
                    )}
                  </View>
                )}
                {showFromDropdown ? (
                  <CaretUp size={20} color="#9CA3AF" weight="regular" />
                ) : (
                  <CaretDown size={20} color="#9CA3AF" weight="regular" />
                )}
              </TouchableOpacity>

              {/* From Dropdown */}
              {showFromDropdown && (
                <View style={styles.fromDropdown}>
                  {/* MWA Mode Indicator */}
                  {walletMode === "mwa" && (
                    <View style={styles.mwaModeBanner}>
                      <Text style={styles.mwaModeText}>
                        Seeker Mode - Offline Wallets via Wallet Adapter
                      </Text>
                    </View>
                  )}

                  {/* Nonce Wallets Section */}
                  {/* Show wallets section always, but content varies */}
                  <View style={styles.fromSection}>
                    <View style={styles.fromSectionHeader}>
                      <Text style={styles.fromSectionTitle}>
                        Nonce Wallets {walletMode === "mwa" && "(MWA)"}
                      </Text>
                      <View style={styles.fromSectionActions}>
                        {isOfflineWalletsLoading && (
                          <ActivityIndicator
                            size="small"
                            color="#22D3EE"
                            style={{ marginRight: 8 }}
                          />
                        )}
                        <Text style={styles.fromSectionCount}>
                          {selectedOfflineWalletIds.length > 0
                            ? "● Selected"
                            : "Tap to select"}
                        </Text>
                      </View>
                    </View>

                    {/* Show wallet list if we have wallets */}
                    {offlineWallets.length > 0 ? (
                      <>
                        <View style={styles.fromWalletList}>
                          {offlineWallets.map((wallet) => {
                            const isSelected =
                              selectedOfflineWalletIds.includes(wallet.id);
                            return (
                              <TouchableOpacity
                                key={wallet.id}
                                style={[
                                  styles.fromWalletOption,
                                  isSelected && styles.fromWalletOptionSelected,
                                ]}
                                onPress={() => {
                                  if (isSelected) {
                                    // Deselect if already selected
                                    setSelectedOfflineWalletIds([]);
                                    setTransactionMode("online");
                                  } else {
                                    // Single selection: replace any previously selected
                                    setSelectedOfflineWalletIds([wallet.id]);
                                    setTransactionMode("offline_wallet");
                                  }
                                }}
                              >
                                <View style={styles.fromWalletCheckbox}>
                                  <View
                                    style={[
                                      styles.checkbox,
                                      isSelected && styles.checkboxSelected,
                                    ]}
                                  >
                                    {isSelected && (
                                      <Text style={styles.checkmark}>✓</Text>
                                    )}
                                  </View>
                                </View>
                                <View style={styles.fromWalletInfo}>
                                  <Text style={styles.fromWalletLabel}>
                                    {wallet.label || "Wallet"}
                                  </Text>
                                  <Text style={styles.fromWalletBalance}>
                                    {wallet.balances.sol.toFixed(4)} SOL
                                  </Text>
                                  <Text style={styles.fromWalletAddress}>
                                    {wallet.publicKey.slice(0, 6)}...
                                    {wallet.publicKey.slice(-4)}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* Selected Wallet Balance */}
                        {selectedOfflineWalletIds.length > 0 && (
                          <View style={styles.fromTotalBalance}>
                            <Text style={styles.fromTotalLabel}>Balance:</Text>
                            <Text style={styles.fromTotalValue}>
                              {totalOfflineBalance.toFixed(4)} SOL
                            </Text>
                          </View>
                        )}

                        {/* Clear / Refresh */}
                        <View style={styles.fromActions}>
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedOfflineWalletIds([]);
                              setTransactionMode("online");
                            }}
                          >
                            <Text style={styles.fromActionText}>
                              Clear Selection
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={async () => {
                              console.log(
                                "[SendScreen] Manual refresh triggered",
                              );
                              await refreshBalances();
                            }}
                          >
                            <Text
                              style={[
                                styles.fromActionText,
                                { color: "#22D3EE" },
                              ]}
                            >
                              ↻ Refresh
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      /* Show message when no wallets found */
                      <View style={styles.noWalletsMessage}>
                        <Text style={styles.noWalletsText}>
                          No offline wallets found
                        </Text>
                        <Text style={styles.noWalletsSubtext}>
                          {walletMode === "mwa"
                            ? "Create wallets in Wallet Settings first"
                            : "Create a wallet using the button below"}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Create New Wallet */}
                  <TouchableOpacity
                    style={styles.createNewButton}
                    onPress={async () => {
                      try {
                        const newWallet = await createOfflineWallet({
                          label: `Wallet ${offlineWallets.length + 1}`,
                          createNonceAccount: true,
                        });
                        if (newWallet) {
                          Alert.alert(
                            "Nonce Wallet Created",
                            `Address: ${newWallet.data.publicKey.slice(0, 8)}...\n\n` +
                              "This wallet uses BLE mesh for transactions.",
                          );
                        }
                      } catch (err) {
                        Alert.alert(
                          "Error",
                          err instanceof Error
                            ? err.message
                            : "Failed to create wallet",
                        );
                      }
                    }}
                  >
                    <Text style={styles.createNewIcon}>+</Text>
                    <Text style={styles.createNewText}>
                      Create new nonce wallet
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (isSending || !recipient || !amount || parseFloat(amount) <= 0) &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleSendTransaction}
            disabled={
              isSending || !recipient || !amount || parseFloat(amount) <= 0
            }
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>

          {/* Custom Numeric Keyboard */}
          {!isSending && (
            <NumericKeyboard
              showDoneButton={false}
              maxAmount={
                selectedOfflineWalletIds.length > 0
                  ? totalOfflineBalance
                  : balance
              }
              onPercentage={(percentage) => {
                // Use nonce wallet balance if selected, otherwise main wallet
                const currentBalance =
                  selectedOfflineWalletIds.length > 0
                    ? totalOfflineBalance
                    : balance;
                const calculatedAmount = (currentBalance * percentage) / 100;
                setAmount(calculatedAmount.toFixed(5));
              }}
              onPress={(key) => {
                setAmount((prev) => {
                  // If current amount is "0.00" or "0", replace it
                  if (prev === "0.00" || prev === "0") {
                    return key === "." ? "0." : key;
                  }

                  // Prevent multiple decimal points
                  if (key === "." && prev.includes(".")) {
                    return prev;
                  }

                  // Limit to 5 decimal places
                  if (prev.includes(".")) {
                    const decimalPart = prev.split(".")[1];
                    if (decimalPart && decimalPart.length >= 5) {
                      return prev; // Don't add more digits
                    }
                  }

                  return prev + key;
                });
              }}
              onBackspace={() =>
                setAmount((prev) => {
                  const newAmount = prev.slice(0, -1);
                  return newAmount || "0.00";
                })
              }
            />
          )}

          {/* Connectivity Status */}
          {connectivity && transactionMode === "online" && (
            <View style={styles.connectivityBanner}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: connectivity.isInternetConnected
                      ? "#22D3EE"
                      : connectivity.isBluetoothAvailable
                        ? "#ffa500"
                        : "#ff4444",
                  },
                ]}
              />
              <Text style={styles.connectivityText}>
                {connectivity.isInternetConnected
                  ? "Connected to Internet"
                  : connectivity.isBluetoothAvailable
                    ? "Offline mode - Using Bluetooth Mesh"
                    : "No connection available"}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <SendConfirmationModal
        visible={showConfirmation}
        onClose={() => {
          setShowConfirmation(false);
          router.back();
        }}
        isBluetooth={connectivity?.isBluetoothAvailable}
      />

      <QRScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScanned}
      />

      {/* Transaction Approval Modal - Shows when peers send tx requests */}
      <TransactionApprovalModal />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#22D3EE",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  settingsButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  networkBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    gap: 8,
  },
  networkIcon: {
    flexDirection: "row",
    gap: 2,
    alignItems: "flex-end",
  },
  networkText: {
    fontSize: 16,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  // Amount Card
  amountCard: {
    backgroundColor: "#072B31",
    borderRadius: 16,
    padding: 14,
    marginVertical: 12,
    overflow: "visible",
  },
  amountCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  tokenSelectorContainer: {
    position: "relative",
    width: "40%",
    backgroundColor: "#106471",
    borderRadius: 12,
    overflow: "visible",
  },
  tokenSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tokenIconWrapper: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenImage: {
    width: 24,
    height: 24,
  },
  tokenText: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  amountInput: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "600",
    textAlign: "right",
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  balanceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  balanceLabel: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  balanceAmount: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  maxLabel: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  usdValue: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  // Token Dropdown
  tokenDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#106471",
    borderRadius: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(34, 211, 238, 0.3)",
    marginTop: 4,
    zIndex: 100,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  tokenOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(34, 211, 238, 0.2)",
  },
  tokenOptionFirst: {
    borderTopWidth: 0,
  },
  tokenOptionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  // Section
  section: {
    marginBottom: 12,
  },
  sectionLabel: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 8,
  },
  // Recipient Input
  recipientContainer: {
    backgroundColor: "transparent",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#22D3EE",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recipientInput: {
    flex: 1,
    color: "#22D3EE",
    fontSize: 16,
  },
  recipientPlaceholder: {
    color: "#22D3EE",
    fontSize: 14,
  },
  qrButton: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  // From Selector
  fromContainer: {
    backgroundColor: "#06181B",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#22D3EE",
    overflow: "hidden",
  },
  fromSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  fromPrimaryText: {
    color: "#22D3EE",
    fontSize: 16,
    fontWeight: "500",
  },
  fromDropdown: {
    borderTopWidth: 1,
    borderTopColor: "rgba(34, 211, 238, 0.3)",
    maxHeight: 300,
  },
  fromSelectorContent: {
    flexDirection: "column",
  },
  fromSecondaryText: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 2,
  },
  walletModeText: {
    color: "#22D3EE",
    fontSize: 10,
    marginTop: 2,
    fontWeight: "600",
  },
  fromSection: {
    paddingVertical: 12,
  },
  fromSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  fromSectionTitle: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fromSectionCount: {
    color: "#22D3EE",
    fontSize: 12,
    fontWeight: "500",
  },
  fromWalletList: {
    paddingHorizontal: 12,
  },
  fromWalletOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#072B31",
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#106471",
  },
  fromWalletOptionSelected: {
    borderColor: "#22D3EE",
    backgroundColor: "#106471",
  },
  fromWalletCheckbox: {
    marginRight: 12,
  },
  fromWalletInfo: {
    flex: 1,
  },
  fromWalletLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  fromWalletBalance: {
    color: "#22D3EE",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  fromWalletAddress: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 2,
  },
  fromTotalBalance: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
    backgroundColor: "#06181B",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.2)",
  },
  fromTotalLabel: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  fromTotalValue: {
    color: "#22D3EE",
    fontSize: 14,
    fontWeight: "600",
  },
  fromActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  fromActionText: {
    color: "#22D3EE",
    fontSize: 12,
    textDecorationLine: "underline",
  },
  fromOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(34, 211, 238, 0.2)",
  },
  fromOptionText: {
    color: "#22D3EE",
    fontSize: 16,
    fontWeight: "500",
  },
  fromOptionBalance: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
  },
  createNewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(34, 211, 238, 0.2)",
  },
  createNewIcon: {
    color: "#9CA3AF",
    fontSize: 18,
    fontWeight: "bold",
  },
  createNewText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
  },
  // Send Button
  sendButton: {
    backgroundColor: "#0C2425",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#22D3EE",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  sendButtonDisabled: {
    opacity: 0.3,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "500",
  },
  // Connectivity Status
  connectivityBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectivityText: {
    color: "#22D3EE",
    fontSize: 12,
  },
  // Transaction Mode Selector
  modeSelector: {
    marginVertical: 12,
  },
  modeLabel: {
    color: "#9CA3AF",
    fontSize: 14,
    marginBottom: 8,
  },
  modeButtons: {
    flexDirection: "row",
    gap: 8,
  },
  modeButton: {
    backgroundColor: "#072B31",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#106471",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeButtonActive: {
    backgroundColor: "#106471",
    borderColor: "#22D3EE",
  },
  modeButtonText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "500",
  },
  modeButtonTextActive: {
    color: "#22D3EE",
  },
  // BLE Status Banner
  bleStatusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    flexWrap: "wrap",
  },
  bleModeText: {
    color: "#9CA3AF",
    fontSize: 10,
    width: "100%",
    textAlign: "center",
    marginTop: 4,
  },
  // Wallet List
  walletList: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  walletCard: {
    backgroundColor: "#072B31",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#106471",
    padding: 12,
    minWidth: 120,
    alignItems: "center",
  },
  walletCardActive: {
    borderColor: "#22D3EE",
    backgroundColor: "#106471",
  },
  walletCardLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 4,
  },
  walletCardBalance: {
    color: "#22D3EE",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  walletCardAddress: {
    color: "#9CA3AF",
    fontSize: 10,
  },
  walletCardCreate: {
    backgroundColor: "#06181B",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#106471",
    borderStyle: "dashed",
    padding: 12,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  walletCardCreateIcon: {
    color: "#22D3EE",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  walletCardCreateText: {
    color: "#22D3EE",
    fontSize: 10,
    textAlign: "center",
  },
  // Checkbox (used in From dropdown)
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#9CA3AF",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    borderColor: "#22D3EE",
    backgroundColor: "#22D3EE",
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  // MWA Mode Banner
  mwaModeBanner: {
    backgroundColor: "#106471",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#22D3EE",
  },
  mwaModeText: {
    color: "#22D3EE",
    fontSize: 12,
    fontWeight: "600",
  },
  // Section Actions (for loading spinner)
  fromSectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // No wallets message
  noWalletsMessage: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
  },
  noWalletsText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
  },
  noWalletsSubtext: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 4,
  },
  // Nonce wallet indicator
  nonceWalletIndicator: {
    color: "#22D3EE",
    fontSize: 11,
    marginLeft: 4,
    fontStyle: "italic",
  },
});

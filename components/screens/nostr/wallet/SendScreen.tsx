import SolanaIcon from "@/components/icons/SolanaIcon";
import USDCIcon from "@/components/icons/USDCIcon";
import ZECIcon from "@/components/icons/ZECIcon";
import QRScannerModal from "@/components/modals/QRScannerModal";
import SendConfirmationModal from "@/components/modals/SendConfirmationModal";
import NumericKeyboard from "@/components/ui/NumericKeyboard";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { useWallet } from "@/src/contexts/WalletContext";
import { Packet } from "@/src/domain/entities/Packet";
// import { useBLENotificationUpdater } from "@/src/hooks/useBLENotificationUpdater";
import { useMeshChat } from "@/src/contexts/MeshChatContext";
import { useSolanaTransaction } from "@/src/hooks/useSolanaTransaction";
import type { ConnectivityStatus } from "@/src/infrastructure/wallet/utils/connectivity";
import * as ConnectivityUtils from "@/src/infrastructure/wallet/utils/connectivity";
import "@/src/polyfills";
import { createSolanaConnection } from "@/src/utils/solana";
import { PublicKey } from "@solana/web3.js";
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
  const { peers: meshPeers, isInitialized: bleInitialized } = useMeshChat();
  
  // Map mesh peers to legacy format for compatibility
  const discoveredDevices = React.useMemo(() => {
    return meshPeers.map(p => ({
      id: p.peerId,
      name: p.nickname,
      isConnected: p.isConnected,
    }));
  }, [meshPeers]);

  // Create a keypair from wallet for transaction signing
  // Note: This is a workaround - we'll use wallet.signTransaction instead
  const [walletKeypair, setWalletKeypair] = useState<any>(null);

  useEffect(() => {
    const loadKeypair = async () => {
      if (wallet && wallet.isConnected()) {
        try {
          // Try to export secret key (only works for LocalWalletAdapter)
          const secretKey = await wallet.exportSecretKey();
          const { Keypair } = await import("@solana/web3.js");
          const kp = Keypair.fromSecretKey(secretKey);
          setWalletKeypair(kp);
          console.log(
            "[SendScreen] Wallet keypair loaded for BLE transactions",
          );
        } catch (error) {
          console.warn("[SendScreen] Could not load keypair:", error);
          // MWA wallets won't support this - that's OK
        }
      }
    };
    loadKeypair();
  }, [wallet]);

  // Security: Clear keypair from memory when component unmounts
  useEffect(() => {
    return () => {
      if (walletKeypair?.secretKey) {
        walletKeypair.secretKey.fill(0);
      }
    };
  }, [walletKeypair]);

  // Solana transaction hook for BLE offline transactions
  const connection = createSolanaConnection({ network: "devnet" });
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
    // Leave a small amount for transaction fees
    const maxAmount = Math.max(0, balance - 0.001);
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

    // Check if sufficient balance
    const amountNum = parseFloat(amount);
    if (amountNum > balance) {
      Alert.alert(
        "Insufficient Balance",
        `You only have ${balance} ${token} available`,
      );
      return;
    }

    // Check connectivity before sending
    const sendCheck = await ConnectivityUtils.canSendTransaction();

    if (!sendCheck.canSend) {
      Alert.alert(
        "Cannot Send",
        sendCheck.reason || "No internet or Bluetooth connection available",
        [{ text: "OK" }],
      );
      return;
    }

    const useOfflineMode =
      sendCheck.useOfflineMode || !connectivity?.isInternetConnected;

    // Only SOL and USDC transfers supported (ZEC coming soon)
    if (token === "ZEC") {
      Alert.alert(
        "Coming Soon",
        `${token} transfers will be available soon. Currently only SOL and USDC transfers are supported.`,
      );
      return;
    }

    setIsSending(true);

    try {
      if (useOfflineMode) {
        // Offline BLE Transaction
        console.log("[Send] 📡 Initiating offline BLE transaction...");

        if (!bleInitialized) {
          Alert.alert(
            "BLE Not Ready",
            "Bluetooth is not initialized. Please try again.",
          );
          setIsSending(false);
          return;
        }

        // Check if there are nearby peers
        if (discoveredDevices.length === 0) {
          Alert.alert(
            "No Peers Found",
            "No Bluetooth peers detected. Make sure there are nearby devices with Bluetooth enabled and the app running.",
            [{ text: "OK" }],
          );
          setIsSending(false);
          return;
        }

        console.log(
          `[Send] 📡 Broadcasting to ${discoveredDevices.length} peer(s)`,
        );
        console.log(`[Send] Amount: ${amountNum} ${token}`);
        console.log(`[Send] Final recipient: ${recipientPubKey.toBase58()}`);

        try {
          // Broadcast transaction request to ALL nearby BLE peers
          // Any connected peer can co-sign with their keypair
          const requestId = await sendTransactionRequest({
            recipientPubkey: recipientPubKey, // Final recipient of funds
            amountSOL: token === "SOL" ? amountNum : 0,
            memo: `${token} transfer via BLE mesh - ${amountNum} ${token} to ${recipientPubKey.toBase58().slice(0, 8)}`,
            // No targetPeerId = broadcast to all peers
          });

          if (requestId) {
            const peerNames = discoveredDevices
              .map((d) => d.name || d.id.slice(0, 8))
              .join(", ");
            Alert.alert(
              "Transaction Broadcast via BLE",
              `Your transaction request has been broadcast to ${discoveredDevices.length} nearby peer(s): ${peerNames}\n\nRequest ID: ${requestId}\n\nAny peer can co-sign this transaction. It will be completed when someone approves it.`,
              [
                {
                  text: "OK",
                  onPress: () => {
                    // Clear form and go back
                    setAmount("0.00");
                    setRecipient("");
                    router.back();
                  },
                },
              ],
            );
          } else {
            throw new Error("Failed to create transaction request");
          }
        } catch (bleError) {
          console.error("[Send] BLE transaction error:", bleError);
          Alert.alert(
            "BLE Transaction Failed",
            bleError instanceof Error
              ? bleError.message
              : "Unknown error occurred",
            [{ text: "OK" }],
          );
        }
      } else {
        // Online transaction
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
      }
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
                {isRefreshing ? (
                  <ActivityIndicator size="small" color="#22D3EE" />
                ) : (
                  <>
                    <Text style={styles.balanceAmount}>
                      {balance.toFixed(token === "SOL" ? 4 : 2)} {token}
                    </Text>
                  </>
                )}
              </View>
              {!isRefreshing && (
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
                {/* Primary Wallet Address */}
                <Text style={styles.fromPrimaryText}>
                  Primary Wallet (
                  {publicKey
                    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
                    : "Loading..."}
                  )
                </Text>
                {showFromDropdown ? (
                  <CaretUp size={20} color="#9CA3AF" weight="regular" />
                ) : (
                  <CaretDown size={20} color="#9CA3AF" weight="regular" />
                )}
              </TouchableOpacity>

              {/* From Dropdown */}
              {showFromDropdown && (
                <View style={styles.fromDropdown}>
                  {/* <TouchableOpacity 
                      style={styles.fromOption}
                      onPress={() => {
                        setSelectedFrom('disposable1');
                        setShowFromDropdown(false);
                      }}
                    >
                      <Text style={styles.fromOptionText}>
                        Disposable Address (8nXF...QyaS)
                      </Text>
                      <Text style={styles.fromOptionBalance}>75.89 SOL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.fromOption}
                      onPress={() => {
                        setSelectedFrom('disposable2');
                        setShowFromDropdown(false);
                      }}
                    >
                      <Text style={styles.fromOptionText}>
                        Disposable Address (8nXF...QyaS)
                      </Text>
                      <Text style={styles.fromOptionBalance}>75.89 SOL</Text>
                    </TouchableOpacity> */}
                  <TouchableOpacity
                    style={styles.createNewButton}
                    onPress={handleCreateNewAddress}
                  >
                    <Text style={styles.createNewIcon}>+</Text>
                    <Text style={styles.createNewText}>
                      Create new disposable address
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
              maxAmount={balance}
              onPercentage={(percentage) => {
                const calculatedAmount = (balance * percentage) / 100;
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
          {connectivity && (
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
});

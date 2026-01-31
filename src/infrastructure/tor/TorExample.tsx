/**
 * Tor Integration Example Component
 *
 * Demonstrates how to use the Tor service for anonymous Solana transactions.
 * This can be used as a reference for implementing Tor in your own components.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { PublicKey, Keypair } from "@solana/web3.js";
import { useTorDevnet } from "@/src/hooks/useTor";

// ============================================
// EXAMPLE COMPONENT
// ============================================

export function TorExample() {
  // Initialize Tor connection to devnet
  const {
    isInitialized,
    isRunning,
    isLoading,
    error,
    connection,
    initialize,
    shutdown,
    sendTransfer,
    getBalance,
  } = useTorDevnet({ autoInit: true });

  // State for transaction
  const [recipient, setRecipient] = useState(
    "11111111111111111111111111111111" // Example: System program (for demo)
  );
  const [amount, setAmount] = useState("0.001");
  const [logs, setLogs] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  // Add log helper
  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Log status changes
  useEffect(() => {
    if (isRunning) addLog("✅ Tor is running");
    if (error) addLog(`❌ Error: ${error.message}`);
  }, [isRunning, error]);

  // Handle manual init
  const handleInit = async () => {
    addLog("🧅 Initializing Tor...");
    const success = await initialize();
    if (success) {
      addLog("✅ Tor initialized");
    } else {
      addLog("❌ Failed to initialize Tor");
    }
  };

  // Handle shutdown
  const handleShutdown = async () => {
    addLog("🛑 Shutting down Tor...");
    await shutdown();
    addLog("✅ Tor shutdown complete");
  };

  // Handle balance check
  const handleCheckBalance = async () => {
    if (!connection) {
      addLog("❌ Connection not available");
      return;
    }

    try {
      const pubKey = new PublicKey(recipient);
      addLog(`🔍 Checking balance for ${recipient.slice(0, 16)}...`);
      const balance = await getBalance(pubKey);
      addLog(`💰 Balance: ${balance / 1e9} SOL`);
    } catch (err) {
      addLog(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Handle send (demo only - won't actually send without a real keypair)
  const handleSend = async () => {
    if (!connection) {
      addLog("❌ Connection not available");
      return;
    }

    setSending(true);
    try {
      addLog("🚀 Sending transaction through Tor...");

      // NOTE: In a real app, load your keypair from secure storage
      // This is just a demo with a random keypair (will fail with insufficient funds)
      const demoKeypair = Keypair.generate();
      const recipientPubKey = new PublicKey(recipient);
      const amountNum = parseFloat(amount);

      const result = await sendTransfer(
        demoKeypair,
        recipientPubKey,
        amountNum,
        "Demo via Tor"
      );

      addLog(`✅ Transaction sent: ${result.signature}`);
      addLog(`📦 Block time: ${result.blockTime}`);
      addLog(`🔗 Slot: ${result.slot}`);
    } catch (err) {
      addLog(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  };

  // Handle get latest blockhash
  const handleGetBlockhash = async () => {
    if (!connection) {
      addLog("❌ Connection not available");
      return;
    }

    try {
      addLog("🔍 Getting latest blockhash...");
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      addLog(`📦 Blockhash: ${blockhash.slice(0, 20)}...`);
      addLog(`📊 Valid until block: ${lastValidBlockHeight}`);
    } catch (err) {
      addLog(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🧅 Tor Solana Integration</Text>

      {/* Status Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.statusRow}>
          <Text>Tor:</Text>
          <Text style={isRunning ? styles.statusOk : styles.statusError}>
            {isRunning ? "🟢 Running" : isLoading ? "🟡 Loading..." : "🔴 Stopped"}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text>Connection:</Text>
          <Text style={connection ? styles.statusOk : styles.statusError}>
            {connection ? "🟢 Ready" : "🔴 Not ready"}
          </Text>
        </View>
        {error && (
          <Text style={styles.errorText}>Error: {error.message}</Text>
        )}
      </View>

      {/* Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Controls</Text>
        <View style={styles.buttonRow}>
          <Button
            title="Initialize"
            onPress={handleInit}
            disabled={isLoading || isRunning}
          />
          <Button
            title="Shutdown"
            onPress={handleShutdown}
            disabled={!isRunning}
            color="#ff4444"
          />
        </View>
      </View>

      {/* Transaction Form */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transaction</Text>
        <TextInput
          style={styles.input}
          placeholder="Recipient Public Key"
          value={recipient}
          onChangeText={setRecipient}
          multiline
        />
        <TextInput
          style={styles.input}
          placeholder="Amount (SOL)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <View style={styles.buttonRow}>
          <Button
            title="Check Balance"
            onPress={handleCheckBalance}
            disabled={!isInitialized}
          />
          <Button
            title="Get Blockhash"
            onPress={handleGetBlockhash}
            disabled={!isInitialized}
          />
        </View>
        <View style={styles.buttonRow}>
          <Button
            title={sending ? "Sending..." : "Send via Tor (Demo)"}
            onPress={handleSend}
            disabled={!isInitialized || sending}
          />
          {sending && <ActivityIndicator style={{ marginLeft: 10 }} />}
        </View>
        <Text style={styles.note}>
          Note: Send uses a random keypair and will fail with "insufficient
          funds". Replace with your keypair in production.
        </Text>
      </View>

      {/* Logs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Logs</Text>
        <View style={styles.logs}>
          {logs.length === 0 ? (
            <Text style={styles.emptyLogs}>No logs yet...</Text>
          ) : (
            logs.map((log, i) => (
              <Text key={i} style={styles.logLine}>
                {log}
              </Text>
            ))
          )}
        </View>
        <Button title="Clear Logs" onPress={() => setLogs([])} />
      </View>
    </ScrollView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  section: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  statusOk: {
    color: "#22c55e",
    fontWeight: "600",
  },
  statusError: {
    color: "#ef4444",
    fontWeight: "600",
  },
  errorText: {
    color: "#ef4444",
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  note: {
    fontSize: 12,
    color: "#666",
    marginTop: 12,
    fontStyle: "italic",
  },
  logs: {
    backgroundColor: "#1a1a1a",
    padding: 12,
    borderRadius: 4,
    minHeight: 150,
    maxHeight: 250,
  },
  logLine: {
    color: "#22c55e",
    fontFamily: "monospace",
    fontSize: 12,
    marginBottom: 4,
  },
  emptyLogs: {
    color: "#666",
    fontStyle: "italic",
  },
});

export default TorExample;

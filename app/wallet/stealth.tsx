/**
 * Stealth Wallet Screen
 *
 * Main interface for stealth address privacy features
 */

import { Ionicons } from "@expo/vector-icons";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Clipboard,
    ScrollView,
    Share,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useConnection } from "../../hooks/useConnection";
import { useStealthWallet } from "../../hooks/useStealthWallet";
import { StealthPayment } from "../../lib/stealth/StealthWalletManager";

export default function StealthWalletScreen() {
  const { connection } = useConnection();
  const {
    isInitialized,
    isLoading,
    metaAddress,
    payments,
    totalBalance,
    isScanning,
    scanForPayments,
    refreshBalance,
  } = useStealthWallet(connection);

  const [showQR, setShowQR] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"overview" | "activity">(
    "overview",
  );

  useEffect(() => {
    if (isInitialized) {
      scanForPayments();
      refreshBalance();
    }
  }, [isInitialized]);

  const handleCopyMetaAddress = () => {
    Clipboard.setString(metaAddress);
    Alert.alert("Copied", "Meta-address copied to clipboard");
  };

  const handleShareMetaAddress = async () => {
    try {
      await Share.share({
        message: `My Stealth Address:\n${metaAddress}`,
        title: "Share Stealth Meta-Address",
      });
    } catch (error) {
      console.error("Failed to share:", error);
    }
  };

  const handleRefresh = async () => {
    await scanForPayments();
    await refreshBalance();
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-950">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-white mt-4">
            Initializing Stealth Wallet...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-950">
      {/* Header */}
      <View className="px-4 py-4 border-b border-gray-800">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Ionicons name="shield-checkmark" size={24} color="#3B82F6" />
            <Text className="text-white text-xl font-bold ml-2">
              Stealth Wallet
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleRefresh}
            disabled={isScanning}
            className="p-2"
          >
            <Ionicons
              name="refresh"
              size={24}
              color={isScanning ? "#6B7280" : "#3B82F6"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-800">
        <TouchableOpacity
          onPress={() => setSelectedTab("overview")}
          className={`flex-1 py-3 ${
            selectedTab === "overview" ? "border-b-2 border-blue-500" : ""
          }`}
        >
          <Text
            className={`text-center font-semibold ${
              selectedTab === "overview" ? "text-blue-500" : "text-gray-400"
            }`}
          >
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSelectedTab("activity")}
          className={`flex-1 py-3 ${
            selectedTab === "activity" ? "border-b-2 border-blue-500" : ""
          }`}
        >
          <Text
            className={`text-center font-semibold ${
              selectedTab === "activity" ? "text-blue-500" : "text-gray-400"
            }`}
          >
            Activity
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1">
        {selectedTab === "overview" ? (
          <OverviewTab
            metaAddress={metaAddress}
            totalBalance={totalBalance}
            showQR={showQR}
            setShowQR={setShowQR}
            onCopy={handleCopyMetaAddress}
            onShare={handleShareMetaAddress}
          />
        ) : (
          <ActivityTab payments={payments} isScanning={isScanning} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface OverviewTabProps {
  metaAddress: string;
  totalBalance: number;
  showQR: boolean;
  setShowQR: (show: boolean) => void;
  onCopy: () => void;
  onShare: () => void;
}

function OverviewTab({
  metaAddress,
  totalBalance,
  showQR,
  setShowQR,
  onCopy,
  onShare,
}: OverviewTabProps) {
  return (
    <View className="p-4">
      {/* Balance Card */}
      <View className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 mb-6">
        <Text className="text-white/80 text-sm mb-2">
          Total Stealth Balance
        </Text>
        <Text className="text-white text-4xl font-bold mb-4">
          {(totalBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL
        </Text>

        <View className="flex-row space-x-3">
          <TouchableOpacity className="flex-1 bg-white/20 rounded-xl py-3 items-center">
            <Ionicons name="shield-outline" size={20} color="white" />
            <Text className="text-white text-xs mt-1">Shield</Text>
          </TouchableOpacity>

          <TouchableOpacity className="flex-1 bg-white/20 rounded-xl py-3 items-center">
            <Ionicons name="arrow-undo-outline" size={20} color="white" />
            <Text className="text-white text-xs mt-1">Unshield</Text>
          </TouchableOpacity>

          <TouchableOpacity className="flex-1 bg-white/20 rounded-xl py-3 items-center">
            <Ionicons name="send-outline" size={20} color="white" />
            <Text className="text-white text-xs mt-1">Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Meta-Address Section */}
      <View className="bg-gray-900 rounded-2xl p-4 mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-white font-semibold">Your Meta-Address</Text>
          <TouchableOpacity onPress={() => setShowQR(!showQR)}>
            <Ionicons name="qr-code-outline" size={24} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {showQR && (
          <View className="items-center mb-4">
            <View className="bg-white p-4 rounded-xl">
              <QRCode value={metaAddress} size={200} />
            </View>
          </View>
        )}

        <View className="bg-gray-800 rounded-xl p-3 mb-3">
          <Text className="text-gray-400 text-xs font-mono break-all">
            {metaAddress}
          </Text>
        </View>

        <View className="flex-row space-x-2">
          <TouchableOpacity
            onPress={onCopy}
            className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
          >
            <Text className="text-white font-semibold">Copy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onShare}
            className="flex-1 bg-gray-800 rounded-xl py-3 items-center"
          >
            <Text className="text-white font-semibold">Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Info Cards */}
      <View className="space-y-3">
        <InfoCard
          icon="shield-checkmark"
          title="Zero On-Chain Linkage"
          description="Payments use one-time addresses derived from your meta-address"
        />

        <InfoCard
          icon="eye-off-outline"
          title="Private by Default"
          description="Only you can see incoming payments with your viewing key"
        />

        <InfoCard
          icon="bluetooth-outline"
          title="Offline Capable"
          description="Send via BLE mesh, auto-settles when online"
        />
      </View>
    </View>
  );
}

interface ActivityTabProps {
  payments: StealthPayment[];
  isScanning: boolean;
}

function ActivityTab({ payments, isScanning }: ActivityTabProps) {
  return (
    <View className="p-4">
      {isScanning && (
        <View className="bg-blue-900/30 border border-blue-700 rounded-xl p-3 mb-4 flex-row items-center">
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text className="text-blue-400 ml-3">Scanning for payments...</Text>
        </View>
      )}

      {payments.length === 0 ? (
        <View className="items-center justify-center py-12">
          <Ionicons name="receipt-outline" size={64} color="#6B7280" />
          <Text className="text-gray-400 text-center mt-4">
            No stealth payments yet
          </Text>
          <Text className="text-gray-500 text-center text-sm mt-2">
            Share your meta-address to receive private payments
          </Text>
        </View>
      ) : (
        <View className="space-y-3">
          {payments.map((payment) => (
            <PaymentCard key={payment.id} payment={payment} />
          ))}
        </View>
      )}
    </View>
  );
}

function PaymentCard({ payment }: { payment: StealthPayment }) {
  const isIncoming = payment.isIncoming;
  const icon = isIncoming ? "arrow-down" : "arrow-up";
  const iconColor = isIncoming ? "#10B981" : "#EF4444";
  const sign = isIncoming ? "+" : "-";

  return (
    <View className="bg-gray-900 rounded-xl p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: `${iconColor}20` }}
          >
            <Ionicons name={icon} size={20} color={iconColor} />
          </View>

          <View className="ml-3 flex-1">
            <View className="flex-row items-center">
              <Text className="text-white font-semibold">
                {isIncoming ? "Received" : "Sent"}
              </Text>
              {payment.spendingKey && (
                <View className="ml-2 bg-blue-900/30 px-2 py-0.5 rounded">
                  <Text className="text-blue-400 text-xs">PQ</Text>
                </View>
              )}
            </View>

            <Text className="text-gray-400 text-xs mt-0.5">
              {new Date(payment.timestamp * 1000).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View className="items-end">
          <Text className="font-bold" style={{ color: iconColor }}>
            {sign}
            {(payment.amount / LAMPORTS_PER_SOL).toFixed(4)} SOL
          </Text>
          <View className="flex-row items-center mt-1">
            <View
              className={`w-2 h-2 rounded-full mr-1 ${
                payment.status === "confirmed"
                  ? "bg-green-500"
                  : payment.status === "failed"
                    ? "bg-red-500"
                    : "bg-yellow-500"
              }`}
            />
            <Text className="text-gray-400 text-xs capitalize">
              {payment.status}
            </Text>
          </View>
        </View>
      </View>

      {payment.signature && (
        <View className="mt-3 pt-3 border-t border-gray-800">
          <Text className="text-gray-500 text-xs">
            {payment.signature.slice(0, 8)}...{payment.signature.slice(-8)}
          </Text>
        </View>
      )}
    </View>
  );
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <View className="bg-gray-900 rounded-xl p-4 flex-row">
      <View className="w-10 h-10 bg-blue-900/30 rounded-full items-center justify-center mr-3">
        <Ionicons name={icon} size={20} color="#3B82F6" />
      </View>

      <View className="flex-1">
        <Text className="text-white font-semibold mb-1">{title}</Text>
        <Text className="text-gray-400 text-sm">{description}</Text>
      </View>
    </View>
  );
}

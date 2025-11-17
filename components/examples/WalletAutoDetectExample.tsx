/**
 * WalletAutoDetectExample - Example component showing wallet auto-detection
 * 
 * This component demonstrates:
 * 1. Automatic device detection (Solana Mobile vs Regular)
 * 2. Automatic wallet mode selection (MWA vs Local)
 * 3. Conditional UI based on wallet type
 * 4. Connection handling for MWA
 * 
 * Usage:
 * - On Solana Mobile devices (Saga/Seeker): Uses MWA
 * - On other devices: Uses Local Wallet
 */

import { useWalletAutoDetect } from '@/src/hooks/useWalletAutoDetect';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WalletAutoDetectExample() {
    const {
        mode,
        isLocal,
        isMWA,
        isSolanaMobile,
        deviceName,
        deviceModel,
        isConnected,
        needsConnection,
        publicKey,
        publicKeyShort,
        isLoading,
        connect,
        disconnect,
    } = useWalletAutoDetect();

    if (isLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#22D3EE" />
                <Text style={styles.loadingText}>Detecting wallet...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Device Info */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>🎯 Device Detection</Text>
                <Text style={styles.infoText}>Device: {deviceName}</Text>
                <Text style={styles.infoText}>Model: {deviceModel}</Text>
                <Text style={styles.infoText}>
                    Solana Mobile: {isSolanaMobile ? '✅ Yes' : '❌ No'}
                </Text>
            </View>

            {/* Wallet Mode */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>
                    {isLocal ? '📱 Local Wallet' : '🔐 Mobile Wallet Adapter'}
                </Text>
                <Text style={styles.infoText}>Mode: {mode?.toUpperCase()}</Text>
                <Text style={styles.infoText}>
                    Status: {isConnected ? '✅ Connected' : '⏳ Disconnected'}
                </Text>
                
                {publicKey && (
                    <View style={styles.addressContainer}>
                        <Text style={styles.addressLabel}>Public Key:</Text>
                        <Text style={styles.addressText}>{publicKeyShort}</Text>
                    </View>
                )}
            </View>

            {/* Wallet Features */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>✨ Features</Text>
                {isLocal && (
                    <>
                        <Text style={styles.featureText}>✅ Auto-sign transactions</Text>
                        <Text style={styles.featureText}>✅ No user approval needed</Text>
                        <Text style={styles.featureText}>✅ Offline capability</Text>
                        <Text style={styles.featureText}>⚠️  Device-dependent security</Text>
                    </>
                )}
                {isMWA && (
                    <>
                        <Text style={styles.featureText}>✅ Maximum security</Text>
                        <Text style={styles.featureText}>✅ User approval required</Text>
                        <Text style={styles.featureText}>✅ External wallet app</Text>
                        <Text style={styles.featureText}>⚠️  Requires connection</Text>
                    </>
                )}
            </View>

            {/* Connection Controls (MWA only) */}
            {isMWA && (
                <View style={styles.card}>
                    {needsConnection ? (
                        <>
                            <Text style={styles.warningText}>
                                🔗 MWA wallet needs to be connected
                            </Text>
                            <TouchableOpacity 
                                style={styles.connectButton}
                                onPress={connect}
                            >
                                <Text style={styles.buttonText}>Connect Wallet</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <Text style={styles.successText}>
                                ✅ MWA wallet is connected
                            </Text>
                            <TouchableOpacity 
                                style={styles.disconnectButton}
                                onPress={disconnect}
                            >
                                <Text style={styles.buttonText}>Disconnect</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            )}

            {/* Auto-Detection Info */}
            <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>ℹ️ Auto-Detection Info</Text>
                <Text style={styles.infoCardText}>
                    This wallet was automatically selected based on your device type:
                </Text>
                {isSolanaMobile ? (
                    <Text style={styles.infoCardText}>
                        • Solana Mobile detected → Using MWA for maximum security
                    </Text>
                ) : (
                    <Text style={styles.infoCardText}>
                        • Regular device detected → Using Local Wallet for convenience
                    </Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#0D0D0D',
    },
    card: {
        backgroundColor: '#0d3333',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#22D3EE',
        padding: 16,
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#22D3EE',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        color: '#FFFFFF',
        marginBottom: 6,
    },
    addressContainer: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#0a2828',
        borderRadius: 8,
    },
    addressLabel: {
        fontSize: 12,
        color: '#8a9999',
        marginBottom: 4,
    },
    addressText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#22D3EE',
    },
    featureText: {
        fontSize: 14,
        color: '#FFFFFF',
        marginBottom: 6,
    },
    warningText: {
        fontSize: 14,
        color: '#FFA500',
        marginBottom: 12,
        textAlign: 'center',
    },
    successText: {
        fontSize: 14,
        color: '#22D3EE',
        marginBottom: 12,
        textAlign: 'center',
    },
    connectButton: {
        backgroundColor: '#22D3EE',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    disconnectButton: {
        backgroundColor: '#ff6b6b',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0D0D0D',
    },
    infoCard: {
        backgroundColor: '#0a2828',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#22D3EE',
        padding: 16,
        marginTop: 8,
    },
    infoCardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#22D3EE',
        marginBottom: 8,
    },
    infoCardText: {
        fontSize: 13,
        color: '#FFFFFF',
        lineHeight: 20,
        marginBottom: 4,
    },
    loadingText: {
        fontSize: 16,
        color: '#8a9999',
        marginTop: 12,
        textAlign: 'center',
    },
});

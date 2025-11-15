import SendIcon from '@/components/icons/SendIcon';
import ReceiveIcon from '@/components/icons/wallet/ReceiveIcon';
import SwapIcon from '@/components/icons/wallet/SwapIcon';
import SendScreen from '@/components/screens/wallet/SendScreen';
import SwapScreen from '@/components/screens/wallet/SwapScreen';
import WalletScreen from '@/components/screens/wallet/WalletScreen';
import WalletHeader from '@/components/wallet/WalletHeader';
import { WalletTabsProvider } from '@/components/wallet/WalletTabsContext';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WalletTabs() {
	const router = useRouter();
	const [tab, setTab] = useState<'wallet' | 'swap' | 'send'>('wallet');
	const [showSettings, setShowSettings] = useState(false);

	const handleReceive = () => setTab('wallet');
	const handleSwap = () => setTab('swap');
	const handleSend = () => setTab('send');

	return (
			<WalletTabsProvider value={{ tab, setTab, showSettings, setShowSettings }}>
				<SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
					<WalletHeader
						title={tab === 'wallet' ? 'Wallet' : tab === 'swap' ? 'Swap' : 'Send'}
						onBack={() => router.back()}
						onRightPress={() => setShowSettings(true)}
					/>

					{/* Action Buttons */}
					<View style={styles.actionsContainer}>
						<TouchableOpacity style={styles.actionButton} onPress={handleReceive}>
							<View style={styles.actionIconContainer}>
								<View style={styles.receiveIcon}>
									<ReceiveIcon />
								</View>
							</View>
							<Text style={styles.actionLabel}>Receive</Text>
						</TouchableOpacity>

						<TouchableOpacity style={styles.actionButton} onPress={handleSwap}>
							<View style={styles.actionIconContainer}>
								<View style={styles.swapIcon}>
									<SwapIcon />
								</View>
							</View>
							<Text style={styles.actionLabel}>Swap</Text>
						</TouchableOpacity>

						<TouchableOpacity style={styles.actionButton} onPress={handleSend}>
							<View style={styles.actionIconContainer}>
								<View style={styles.sendIcon}>
									<SendIcon />
								</View>
							</View>
							<Text style={styles.actionLabel}>Send</Text>
						</TouchableOpacity>
					</View>

					{tab === 'wallet' ? (
						<WalletScreen hideHeader />
					) : tab === 'swap' ? (
						<SwapScreen hideHeader />
					) : (
						<SendScreen hideHeader />
					)}
				</SafeAreaView>
			</WalletTabsProvider>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#0a1a1a' },
	actionsContainer: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		paddingHorizontal: 32,
		paddingVertical: 32,
	},
	actionButton: {
		alignItems: 'center',
		gap: 8,
	},
	actionIconContainer: {
		width: 64,
		height: 64,
		borderRadius: 16,
		borderWidth: 2,
		borderColor: '#00d9ff',
		backgroundColor: 'rgba(0, 217, 255, 0.1)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	actionLabel: {
		fontSize: 14,
		color: '#00d9ff',
		fontWeight: '500',
	},
	receiveIcon: {
		width: 32,
		height: 32,
		justifyContent: 'center',
		alignItems: 'center',
	},
	swapIcon: {
		width: 32,
		height: 32,
		justifyContent: 'center',
		alignItems: 'center',
	},
	sendIcon: {
		width: 32,
		height: 32,
		justifyContent: 'center',
		alignItems: 'center',
	},
});

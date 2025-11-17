/**
 * MainMenuModal Component Usage Example
 * 
 * This is a bottom sheet modal with 6 navigation options:
 * - Messages
 * - Wallet
 * - History
 * - Mesh_Zone
 * - Profil
 * - Disconnect
 */

import MainMenuModal from '@/components/modals/MainMenuModal';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export default function ExampleScreen() {
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      {/* Trigger button */}
      <TouchableOpacity onPress={() => setShowMenu(true)}>
        <Text>Open Menu</Text>
      </TouchableOpacity>

      {/* Main Menu Modal */}
      <MainMenuModal
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        onNavigateToMessages={() => {
          console.log('Navigate to Messages');
          router.push('/chat');
        }}
        onNavigateToWallet={() => {
          console.log('Navigate to Wallet');
          router.push('/wallet');
        }}
        onNavigateToHistory={() => {
          console.log('Navigate to History');
          // router.push('/history');
        }}
        onNavigateToMeshZone={() => {
          console.log('Navigate to Mesh Zone');
          // router.push('/mesh-zone');
        }}
        onNavigateToProfile={() => {
          console.log('Navigate to Profile');
          // router.push('/profile');
        }}
        onDisconnect={() => {
          console.log('Disconnect');
          // Handle disconnect logic
        }}
      />
    </View>
  );
}

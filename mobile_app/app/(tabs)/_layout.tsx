import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';

const MessagesIcon = ({ color }: { color: string }) => <Feather name="message-circle" size={22} color={color} />;
const NodesIcon    = ({ color }: { color: string }) => <Feather name="share-2"        size={22} color={color} />;
const WalletIcon   = ({ color }: { color: string }) => <Feather name="credit-card"    size={22} color={color} />;
const SettingsIcon = ({ color }: { color: string }) => <Feather name="sliders"        size={22} color={color} />;

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface0,
          borderTopColor: colors.borderSubtle,
          ...(Platform.OS === 'ios' && { paddingBottom: 0 }),
        },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Messages', tabBarIcon: MessagesIcon }} />
      <Tabs.Screen name="wallet"   options={{ title: 'Wallet',   tabBarIcon: WalletIcon }}   />
      <Tabs.Screen name="nodes"    options={{ title: 'Nodes',    tabBarIcon: NodesIcon }}    />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: SettingsIcon }} />
    </Tabs>
  );
}

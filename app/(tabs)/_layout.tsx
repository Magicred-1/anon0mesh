// Import polyfills FIRST (before any other imports)
import '@/src/polyfills';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false }} />
    </Tabs>
  );
}

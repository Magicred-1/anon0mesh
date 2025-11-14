// Import polyfills FIRST (before any other imports)
import '@/src/polyfills';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
    >
    </Tabs>
  );
}

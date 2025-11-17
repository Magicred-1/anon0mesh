import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

export default function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(34, 211, 238, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a3333',
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 22,
    marginRight: 10,
  },
  title: {
    color: '#22D3EE',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'monospace',
    flex: 1,
  },
  description: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 32,
  },
});

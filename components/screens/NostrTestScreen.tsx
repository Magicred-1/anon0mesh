/**
 * NostrTestScreen.tsx - UI Screen for Running Nostr Tests
 * 
 * Provides a simple interface to run Nostr integration tests
 * and view results in the app.
 * 
 * Usage: Add to your navigation or call from a debug menu
 */

import { runNostrTests, runQuickNostrTest } from '@/src/infrastructure/nostr/NostrTest';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    error?: string;
}

export function NostrTestScreen() {
    const [testing, setTesting] = useState(false);
    const [results, setResults] = useState<TestResult[]>([]);
    const [summary, setSummary] = useState<{ total: number; passed: number; failed: number } | null>(null);

    const handleRunFullTests = async () => {
        setTesting(true);
        setResults([]);
        setSummary(null);
        
        try {
        const testResults = await runNostrTests();
        setResults(testResults.results);
        setSummary({
            total: testResults.total,
            passed: testResults.passed,
            failed: testResults.failed,
        });
        } catch (error) {
        console.error('Test error:', error);
        } finally {
        setTesting(false);
        }
    };

    const handleRunQuickTest = async () => {
        setTesting(true);
        setResults([]);
        setSummary(null);
        
        try {
        const success = await runQuickNostrTest();
        setSummary({
            total: 1,
            passed: success ? 1 : 0,
            failed: success ? 0 : 1,
        });
        } catch (error) {
        console.error('Quick test error:', error);
        } finally {
        setTesting(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#1e1e1e', padding: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#26C6DA', marginBottom: 20 }}>
            Nostr Integration Tests
        </Text>

        {/* Buttons */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            <TouchableOpacity
            onPress={handleRunQuickTest}
            disabled={testing}
            style={{
                flex: 1,
                backgroundColor: testing ? '#555' : '#26C6DA',
                padding: 15,
                borderRadius: 8,
                alignItems: 'center',
            }}
            >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                Quick Test
            </Text>
            </TouchableOpacity>

            <TouchableOpacity
            onPress={handleRunFullTests}
            disabled={testing}
            style={{
                flex: 1,
                backgroundColor: testing ? '#555' : '#26C6DA',
                padding: 15,
                borderRadius: 8,
                alignItems: 'center',
            }}
            >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                Full Test Suite
            </Text>
            </TouchableOpacity>
        </View>

        {/* Loading */}
        {testing && (
            <View style={{ alignItems: 'center', padding: 20 }}>
            <ActivityIndicator size="large" color="#26C6DA" />
            <Text style={{ color: '#fff', marginTop: 10 }}>Running tests...</Text>
            </View>
        )}

        {/* Summary */}
        {summary && !testing && (
            <View style={{ backgroundColor: '#2a2a2a', padding: 15, borderRadius: 8, marginBottom: 20 }}>
            <Text style={{ color: '#26C6DA', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
                Test Summary
            </Text>
            <Text style={{ color: '#fff' }}>Total: {summary.total}</Text>
            <Text style={{ color: '#4CAF50' }}>Passed: {summary.passed}</Text>
            <Text style={{ color: summary.failed > 0 ? '#F44336' : '#fff' }}>
                Failed: {summary.failed}
            </Text>
            </View>
        )}

        {/* Results */}
        <ScrollView style={{ flex: 1 }}>
            {results.map((result, index) => (
            <View
                key={index}
                style={{
                backgroundColor: '#2a2a2a',
                padding: 15,
                borderRadius: 8,
                marginBottom: 10,
                borderLeftWidth: 4,
                borderLeftColor: result.passed ? '#4CAF50' : '#F44336',
                }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', flex: 1 }}>
                    {result.passed ? '✅' : '❌'} {result.name}
                </Text>
                <Text style={{ color: '#888' }}>{result.duration}ms</Text>
                </View>
                {result.error && (
                <Text style={{ color: '#F44336', fontSize: 12, marginTop: 5 }}>
                    {result.error}
                </Text>
                )}
            </View>
            ))}
        </ScrollView>
        </View>
    );
}

import { SOLANA_NETWORKS } from '@/src/application/use-cases/blockchain/constants';
import { getAllDomains, reverseLookup } from '@bonfida/spl-name-service';
import { Connection, PublicKey } from '@solana/web3.js';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface SnsNicknameSelectorProps {
    pubKey: string;
    onSelect: (nickname: string) => void;
    onDomainsLoaded?: (domains: string[]) => void;
}

export default function SnsNicknameSelector({ pubKey, onSelect, onDomainsLoaded }: SnsNicknameSelectorProps) {
    const [snsDomains, setSnsDomains] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [customNickname, setCustomNickname] = useState('');
    const [selected, setSelected] = useState<string | null>(null);

    // Fetch SNS domains for the user
    const fetchDomains = React.useCallback(async () => {
        setLoading(true);
        try {
        // Use the Bonfida SPL Name Service library to fetch domains owned by the pubkey
        const connection = new Connection(SOLANA_NETWORKS.devnet);
        const owner = new PublicKey(pubKey);
        const domainKeys = await getAllDomains(connection, owner);
        // domainKeys is an array of PublicKey domain registry keys; perform reverse lookup to get the readable name
        const domains: string[] = [];
        for (const dk of domainKeys) {
            try {
            const name = await reverseLookup(connection, dk);
            if (name) domains.push(name);
            } catch {
            // ignore lookup failures for individual domains
            }
        }
        setSnsDomains(domains);
        if (onDomainsLoaded) onDomainsLoaded(domains);
        } catch {
        setSnsDomains([]);
        if (onDomainsLoaded) onDomainsLoaded([]);
        } finally {
        setLoading(false);
        }
    }, [pubKey, onDomainsLoaded]);

    React.useEffect(() => {
        if (pubKey) fetchDomains();
    }, [pubKey, fetchDomains]);

    const handleSelect = (nickname: string) => {
        setSelected(nickname);
        onSelect(nickname);
    };

    return (
        <View style={styles.container}>
        <Text style={styles.label}>Select SNS domain as nickname:</Text>
        {loading ? (
            <ActivityIndicator color="#26C6DA" />
        ) : (
            snsDomains.length > 0 ? (
            snsDomains.map(domain => (
                <TouchableOpacity
                key={domain}
                style={[styles.domainButton, selected === domain && styles.selectedDomainButton]}
                onPress={() => handleSelect(domain)}
                >
                <Text style={styles.domainText}>{domain}</Text>
                </TouchableOpacity>
            ))
            ) : (
            <Text style={styles.noDomains}>No SNS domains found for this wallet.</Text>
            )
        )}
        <Text style={styles.label}>Or enter a custom nickname:</Text>
        <TextInput
            style={styles.input}
            placeholder="Custom nickname"
            value={customNickname}
            onChangeText={setCustomNickname}
            onSubmitEditing={() => handleSelect(customNickname)}
        />
        <TouchableOpacity
            style={styles.saveButton}
            onPress={() => handleSelect(customNickname)}
        >
            <Text style={styles.saveButtonText}>Save Nickname</Text>
        </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: '#0A0A0A',
        borderRadius: 12,
        margin: 8,
    },
    label: {
        color: '#26C6DA',
        fontWeight: 'bold',
        marginBottom: 8,
    },
    domainButton: {
        backgroundColor: '#222',
        padding: 10,
        borderRadius: 8,
        marginBottom: 6,
    },
    selectedDomainButton: {
        backgroundColor: '#26C6DA',
    },
    domainText: {
        color: '#fff',
        fontFamily: 'monospace',
    },
    noDomains: {
        color: '#888',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#111',
        color: '#fff',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
        fontSize: 16,
    },
    saveButton: {
        backgroundColor: '#26C6DA',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
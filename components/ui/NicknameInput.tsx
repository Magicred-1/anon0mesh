import React, { useRef, useState } from 'react';
import { Alert, Animated, Easing, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SnsNicknameSelector from './SnsNicknameSelector';

interface Props {
    onSave: (name: string) => void;
    pubKey: string;
}

export default function NicknameInput({ onSave, pubKey }: Props) {
    const [tempName, setTempName] = useState('');
    const [expanded, setExpanded] = useState(false);
    const [snsNickname, setSnsNickname] = useState<string | null>(null);
    const [useSns, setUseSns] = useState(false);
    const [snsAvailable, setSnsAvailable] = useState<boolean>(true); // true by default, will be set by selector
    const heightAnim = useRef(new Animated.Value(50)).current;

    const toggleExpand = () => {
        Animated.timing(heightAnim, {
            toValue: expanded ? 50 : 220,
            duration: 250,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
        }).start();
        setExpanded(!expanded);
    };

    const save = (nickname?: string) => {
        const name = nickname !== undefined ? nickname : tempName;
        if (!name.trim()) {
            Alert.alert('Nickname cannot be empty');
            return;
        }
        onSave(name.trim());
        Alert.alert('Nickname Updated', `You are now anon0mesh/@${name.trim()}`);
        setTempName('');
        setExpanded(false);
        setSnsNickname(useSns ? name : null);
    };

    // Custom SnsNicknameSelector wrapper to detect SNS domain availability
    const SnsSelector = (
        <SnsNicknameSelector
            pubKey={pubKey}
            onSelect={nickname => {
                setSnsNickname(nickname);
                save(nickname);
            }}
            onDomainsLoaded={domains => setSnsAvailable(domains.length > 0)}
        />
    );

    return (
        <Animated.View
            style={{
                height: heightAnim,
                padding: 8,
                backgroundColor: '#0A0A0A',
                borderBottomWidth: 1,
                borderColor: '#26C6DA',
                borderRadius: 12,
                margin: 8,
                overflow: 'hidden',
            }}
        >
            {expanded ? (
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <Switch
                            value={useSns}
                            onValueChange={setUseSns}
                            trackColor={{ false: '#333', true: '#26C6DA' }}
                            thumbColor={useSns ? '#fff' : '#888'}
                            disabled={!snsAvailable}
                        />
                        <Text style={{ color: snsAvailable ? '#26C6DA' : '#888', marginLeft: 8, fontWeight: 'bold' }}>
                            Use SNS domain as nickname
                        </Text>
                    </View>
                    {useSns && snsAvailable ? (
                        SnsSelector
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                            <TextInput
                                style={{
                                    flex: 1,
                                    borderWidth: 1,
                                    borderColor: '#26C6DA',
                                    borderRadius: 12,
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    marginRight: 8,
                                    color: '#b0b0b0',
                                    fontFamily: 'monospace',
                                    backgroundColor: '#000000',
                                }}
                                placeholder="Set or change nickname"
                                placeholderTextColor="#555"
                                value={tempName}
                                onChangeText={setTempName}
                            />
                            <TouchableOpacity
                                onPress={() => save()}
                                style={{
                                    backgroundColor: '#26C6DA',
                                    paddingHorizontal: 16,
                                    paddingVertical: 6,
                                    borderRadius: 12,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ color: '#FFFFFF', fontWeight: 'regular', fontFamily: 'Lexend_400Regular' }}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            ) : (
                <TouchableOpacity
                    onPress={toggleExpand}
                    style={{ justifyContent: 'center', alignItems: 'center', flex: 1 }}
                >
                    <Text style={{ color: '#26C6DA', fontFamily: 'Lexend_400Regular', fontWeight: 'regular' }}>
                        {useSns && snsNickname ? `SNS Nickname: ${snsNickname}` : 'Edit Nickname'}
                    </Text>
                    {useSns && snsNickname && (
                        <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                            (Selected from SNS)
                        </Text>
                    )}
                </TouchableOpacity>
            )}
        </Animated.View>
    );
}
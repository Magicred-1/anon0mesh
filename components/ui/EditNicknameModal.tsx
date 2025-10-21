import React, { useState } from 'react';
import {
    Alert,
    Modal,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SnsNicknameSelector from './SnsNicknameSelector';

interface EditNicknameModalProps {
    visible: boolean;
    currentNickname: string;
    onSave: (newNickname: string) => void;
    onClose: () => void;
    pubKey: string;
}

const EditNicknameModal: React.FC<EditNicknameModalProps> = ({
    visible,
    currentNickname,
    onSave,
    onClose,
    pubKey,
}) => {
    const [nickname, setNickname] = useState(currentNickname);
    const [isValidating, setIsValidating] = useState(false);
    const [useSns, setUseSns] = useState(false);
    const [snsNickname, setSnsNickname] = useState<string | null>(null);
    const [snsAvailable, setSnsAvailable] = useState(false);
    const [snsDomains, setSnsDomains] = useState<string[]>([]);

    const validateAndSave = async (nick?: string) => {
        const trimmedNickname = (nick ?? nickname).trim();
        // Validation rules
        if (!trimmedNickname) {
            Alert.alert('Invalid Nickname', 'Nickname cannot be empty');
            return;
        }
        if (trimmedNickname.length < 2) {
            Alert.alert('Invalid Nickname', 'Nickname must be at least 2 characters long');
            return;
        }
        if (trimmedNickname.length > 20) {
            Alert.alert('Invalid Nickname', 'Nickname must be 20 characters or less');
            return;
        }
        if (!/^[a-zA-Z0-9\s\-_.]+$/.test(trimmedNickname)) {
            Alert.alert('Invalid Nickname', 'Nickname can only contain letters, numbers, spaces, and basic punctuation');
            return;
        }
        setIsValidating(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            onSave(trimmedNickname);
            onClose();
            Alert.alert('Success', 'Nickname updated successfully!');
        } catch {
            Alert.alert('Error', 'Failed to update nickname. Please try again.');
        } finally {
            setIsValidating(false);
        }
    };

    const handleClose = () => {
        setNickname(currentNickname);
        setSnsNickname(null);
        setUseSns(false);
        setSnsDomains([]);
        setSnsAvailable(false);
        onClose();
    };

    // Handle switch logic and reset SNS nickname when toggling off
    const handleSnsSwitch = (val: boolean) => {
        setUseSns(val);
        if (!val) {
            setSnsNickname(null);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <SafeAreaView style={{ flex: 1, backgroundColor: '#212122' }}>
                {/* Header */}
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingHorizontal: 20,
                        paddingVertical: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: '#333',
                    }}
                >
                    <TouchableOpacity onPress={handleClose}>
                        <Text style={{ color: '#007AFF', fontSize: 16, fontFamily: 'monospace' }}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600', fontFamily: 'Lexend_400Regular' }}>
                        Edit Nickname
                    </Text>
                    <TouchableOpacity
                        onPress={() => useSns && snsNickname ? validateAndSave(snsNickname) : validateAndSave()}
                        disabled={isValidating || ((useSns && !snsNickname) || (!useSns && nickname.trim() === currentNickname))}
                        style={{ opacity: isValidating || ((useSns && !snsNickname) || (!useSns && nickname.trim() === currentNickname)) ? 0.5 : 1 }}
                    >
                        <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: '600', fontFamily: 'Lexend_400Regular' }}>
                            {isValidating ? 'Saving...' : 'Save'}
                        </Text>
                    </TouchableOpacity>
                </View>
                {/* Content */}
                <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 30 }}>
                    {/* SNS Section */}
                    <View style={{
                        backgroundColor: '#23232A',
                        borderRadius: 14,
                        padding: 16,
                        marginBottom: 24,
                        borderWidth: 1,
                        borderColor: '#333',
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Switch
                                value={useSns}
                                onValueChange={handleSnsSwitch}
                                trackColor={{ false: '#333', true: '#26C6DA' }}
                                thumbColor={useSns ? '#fff' : '#888'}
                                disabled={snsDomains.length === 0}
                            />
                            <Text style={{ color: snsAvailable ? '#26C6DA' : '#888', marginLeft: 8, fontWeight: 'bold', fontSize: 16 }}>
                                Use SNS domain as nickname
                            </Text>
                        </View>
                        <Text style={{ color: '#AAA', fontSize: 13, marginBottom: 8 }}>
                            {snsAvailable
                                ? 'Select a Solana Name Service domain linked to your wallet.'
                                : 'No SNS domains found for this wallet. You can only use a custom nickname.'}
                        </Text>
                        {/* SNS selector or custom input */}
                        {useSns && snsAvailable ? (
                            <View style={{ marginTop: 8 }}>
                                <SnsNicknameSelector
                                    pubKey={pubKey}
                                    onSelect={nick => {
                                        setSnsNickname(nick);
                                    }}
                                    onDomainsLoaded={domains => {
                                        setSnsDomains(domains);
                                        setSnsAvailable(domains.length > 0);
                                        // If no domains, force switch off
                                        if (domains.length === 0 && useSns) {
                                            setUseSns(false);
                                            setSnsNickname(null);
                                        }
                                    }}
                                />
                                {snsDomains.length === 0 && (
                                    <Text style={{ color: '#888', fontSize: 14, marginTop: 8 }}>
                                        No SNS domains available. Switch to custom nickname.
                                    </Text>
                                )}
                            </View>
                        ) : null}
                    </View>
                    {/* Custom Nickname Section */}
                    {!useSns || !snsAvailable ? (
                        <View style={{
                            backgroundColor: '#23232A',
                            borderRadius: 14,
                            padding: 16,
                            marginBottom: 24,
                            borderWidth: 1,
                            borderColor: '#333',
                        }}>
                            <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: 'Lexend_400Regular', marginBottom: 8 }}>
                                Custom Nickname
                            </Text>
                            <TextInput
                                style={{
                                    backgroundColor: '#333',
                                    borderRadius: 12,
                                    paddingHorizontal: 16,
                                    paddingVertical: 14,
                                    color: '#FFFFFF',
                                    fontSize: 16,
                                    fontFamily: 'Lexend_400Regular',
                                    borderWidth: 1,
                                    borderColor: '#444',
                                }}
                                value={nickname}
                                onChangeText={setNickname}
                                placeholder="Enter your nickname"
                                placeholderTextColor="#888"
                                maxLength={20}
                                autoFocus={true}
                                selectTextOnFocus={true}
                                returnKeyType="done"
                                onSubmitEditing={() => validateAndSave()}
                                blurOnSubmit={true}
                            />
                            {/* Character count */}
                            <Text style={{ color: '#888', fontSize: 14, fontFamily: 'Lexend_400Regular', marginTop: 8, textAlign: 'right' }}>
                                {nickname.length}/20
                            </Text>
                        </View>
                    ) : null}
                    {/* Preview */}
                    {(useSns && snsNickname) || (!useSns && nickname.trim() && nickname.trim() !== currentNickname) ? (
                        <View
                            style={{
                                marginBottom: 24,
                                backgroundColor: '#2A2A2A',
                                borderRadius: 12,
                                padding: 16,
                                borderWidth: 1,
                                borderColor: '#444',
                                marginTop: 0,
                            }}
                        >
                            <Text style={{ color: '#AAAAAA', fontSize: 14, fontFamily: 'Lexend_400Regular', marginBottom: 8 }}>
                                Preview:
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', fontFamily: 'Lexend_400Regular' }}>
                                        {(useSns && snsNickname ? snsNickname : nickname).charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: 'Lexend_400Regular' }}>
                                    {useSns && snsNickname ? snsNickname : nickname.trim()}
                                </Text>
                            </View>
                        </View>
                    ) : null}
                    {/* Guidelines */}
                    <View style={{ marginTop: 10 }}>
                        <Text style={{ color: '#AAAAAA', fontSize: 16, fontWeight: '600', fontFamily: 'Lexend_400Regular', marginBottom: 12 }}>
                            Guidelines:
                        </Text>
                        <View style={{ marginLeft: 10 }}>
                            <Text style={{ color: '#888', fontSize: 14, marginBottom: 6, fontFamily: 'Lexend_400Regular' }}>
                                • 2-20 characters long
                            </Text>
                            <Text style={{ color: '#888', fontSize: 14, marginBottom: 6, fontFamily: 'Lexend_400Regular' }}>
                                • Letters, numbers, and basic punctuation only
                            </Text>
                            <Text style={{ color: '#888', fontSize: 14, marginBottom: 6, fontFamily: 'Lexend_400Regular' }}>
                                • Will be visible to other mesh users
                            </Text>
                            <Text style={{ color: '#888', fontSize: 14, marginBottom: 6, fontFamily: 'Lexend_400Regular' }}>
                                • Choose something memorable and appropriate
                            </Text>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

export default EditNicknameModal;
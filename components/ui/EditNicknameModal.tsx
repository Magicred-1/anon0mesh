import React, { useState } from 'react';
import {
    Alert,
    Modal,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface EditNicknameModalProps {
    visible: boolean;
    currentNickname: string;
    onSave: (newNickname: string) => void;
    onClose: () => void;
}

const EditNicknameModal: React.FC<EditNicknameModalProps> = ({
    visible,
    currentNickname,
    onSave,
    onClose,
}) => {
    const [nickname, setNickname] = useState(currentNickname);
    const [isValidating, setIsValidating] = useState(false);

    const validateAndSave = async () => {
        const trimmedNickname = nickname.trim();
        
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
        
        // Check for special characters (allow letters, numbers, spaces, basic punctuation)
        if (!/^[a-zA-Z0-9\s\-_.]+$/.test(trimmedNickname)) {
        Alert.alert('Invalid Nickname', 'Nickname can only contain letters, numbers, spaces, and basic punctuation');
        return;
        }

        setIsValidating(true);
        
        try {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate validation delay
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
        setNickname(currentNickname); // Reset to current nickname
        onClose();
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
                <Text
                style={{
                    color: '#007AFF',
                    fontSize: 16,
                    fontFamily: 'monospace',
                }}
                >
                Cancel
                </Text>
            </TouchableOpacity>
            
            <Text
                style={{
                color: '#FFFFFF',
                fontSize: 18,
                fontWeight: '600',
                fontFamily: 'Lexend_400Regular',
                }}
            >
                Edit Nickname
            </Text>
            
            <TouchableOpacity
                onPress={validateAndSave}
                disabled={isValidating || nickname.trim() === currentNickname}
                style={{
                opacity: isValidating || nickname.trim() === currentNickname ? 0.5 : 1,
                }}
            >
                <Text
                style={{
                    color: '#007AFF',
                    fontSize: 16,
                    fontWeight: '600',
                    fontFamily: 'Lexend_400Regular',
                }}
                >
                {isValidating ? 'Saving...' : 'Save'}
                </Text>
            </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 30 }}>
            {/* Preview */}
            {nickname.trim() && nickname.trim() !== currentNickname && (
                <View
                style={{
                    marginBottom: 24,
                    backgroundColor: '#2A2A2A',
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: '#444',
                }}
                >
                <Text
                    style={{
                    color: '#AAAAAA',
                    fontSize: 14,
                    fontFamily: 'Lexend_400Regular',
                    marginBottom: 8,
                    }}
                >
                    Preview:
                </Text>
                <View
                    style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    }}
                >
                    <View
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: '#007AFF',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 12,
                    }}
                    >
                    <Text
                        style={{
                        color: '#FFFFFF',
                        fontSize: 14,
                        fontWeight: '600',
                        fontFamily: 'Lexend_400Regular',
                        }}
                    >
                        {nickname.trim().charAt(0).toUpperCase()}
                    </Text>
                    </View>
                    <Text
                    style={{
                        color: '#FFFFFF',
                        fontSize: 16,
                        fontFamily: 'Lexend_400Regular',
                    }}
                    >
                    {nickname.trim()}
                    </Text>
                </View>
                </View>
            )}

            <Text
                style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontFamily: 'Lexend_400Regular',
                marginBottom: 8,
                }}
            >
                Nickname
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
                onSubmitEditing={validateAndSave}
                blurOnSubmit={true}
            />
            
            {/* Character count */}
            <Text
                style={{
                color: '#888',
                fontSize: 14,
                fontFamily: 'Lexend_400Regular',
                marginTop: 8,
                textAlign: 'right',
                }}
            >
                {nickname.length}/20
            </Text>

            {/* Guidelines */}
            <View style={{ marginTop: 30 }}>
                <Text
                style={{
                    color: '#AAAAAA',
                    fontSize: 16,
                    fontWeight: '600',
                    fontFamily: 'Lexend_400Regular',
                    marginBottom: 12,
                }}
                >
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
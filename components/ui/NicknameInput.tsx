import React, { useRef, useState } from 'react';
import { Alert, Animated, Easing, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
    onSave: (name: string) => void;
}

export default function NicknameInput({ onSave }: Props) {
    const [tempName, setTempName] = useState('');
    const [expanded, setExpanded] = useState(false);
    const heightAnim = useRef(new Animated.Value(50)).current; // initial height collapsed

    const toggleExpand = () => {
        Animated.timing(heightAnim, {
        toValue: expanded ? 50 : 80, // collapsed vs expanded
        duration: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
        }).start();
        setExpanded(!expanded);
    };

    const save = () => {
        if (!tempName.trim()) {
        Alert.alert('Nickname cannot be empty');
        return;
        }
        onSave(tempName.trim());
        Alert.alert('Nickname Updated', `You are now anon0mesh/@${tempName.trim()}`);
        setTempName('');
        toggleExpand(); // collapse after saving
    };

    return (
        <Animated.View
        style={{
            height: heightAnim,
            padding: 8,
            backgroundColor: '#111111',
            borderBottomWidth: 1,
            borderColor: '#00FF9C',
            borderRadius: 12,
            margin: 8,
            overflow: 'hidden',
        }}
        >
        {expanded ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
                style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#00FF9C',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 6,
                marginRight: 8,
                color: '#00FF9C',
                fontFamily: 'Courier',
                backgroundColor: '#0F0F0F',
                }}
                placeholder="Set or change nickname"
                placeholderTextColor="#555"
                value={tempName}
                onChangeText={setTempName}
            />
            <TouchableOpacity
                onPress={save}
                style={{
                backgroundColor: '#00FF9C',
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 12,
                justifyContent: 'center',
                alignItems: 'center',
                }}
            >
                <Text
                style={{
                    color: '#0A0A0A',
                    fontWeight: 'bold',
                    fontFamily: 'Courier',
                }}
                >
                Save
                </Text>
            </TouchableOpacity>
            </View>
        ) : (
            <TouchableOpacity
            onPress={toggleExpand}
            style={{
                justifyContent: 'center',
                alignItems: 'center',
                flex: 1,
            }}
            >
            <Text
                style={{
                color: '#00FF9C',
                fontFamily: 'Courier',
                fontWeight: 'bold',
                }}
            >
                Edit Nickname
            </Text>
            </TouchableOpacity>
        )}
        </Animated.View>
    );
}

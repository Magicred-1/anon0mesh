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
            backgroundColor: '#0A0A0A',
            borderBottomWidth: 1,
            borderColor: '#A855F7',
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
                borderColor: '#A855F7',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 6,
                marginRight: 8,
                color: '#C084FC',
                fontFamily: 'Courier',
                backgroundColor: '#000000',
                }}
                placeholder="Set or change nickname"
                placeholderTextColor="#555"
                value={tempName}
                onChangeText={setTempName}
            />
            <TouchableOpacity
                onPress={save}
                style={{
                backgroundColor: '#A855F7',
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 12,
                justifyContent: 'center',
                alignItems: 'center',
                }}
            >
                <Text
                style={{
                    color: '#FFFFFF',
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
                color: '#A855F7',
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
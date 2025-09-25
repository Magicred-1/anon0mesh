import React from 'react';
import { Button, Text, TextInput, View } from 'react-native';

interface Props {
    tempNickname: string;
    setTempNickname: (v: string) => void;
    onboard: () => void;
}

export default function OnboardingScreen({ tempNickname, setTempNickname, onboard }: Props) {
    return (
        <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#121212' }}>
        <Text style={{ color:'#fff', marginBottom:8, fontSize:16 }}>
            Set a nickname (optional) and onboard
        </Text>
        <TextInput
            style={{
            borderWidth:1, borderColor:'#555', borderRadius:8,
            width:'80%', padding:8, marginBottom:12,
            color:'#fff', backgroundColor:'#2A2A2A'
            }}
            placeholder="Nickname (optional)"
            placeholderTextColor="#888"
            value={tempNickname}
            onChangeText={setTempNickname}
        />
        <Button title="Onboard with Passkey" color="#1E90FF" onPress={onboard} />
        </View>
    );
}

import React from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface Props {
  tempNickname: string;
  setTempNickname: (v: string) => void;
  onboard: () => void;
}

export default function OnboardingScreen({
  tempNickname,
  setTempNickname,
  onboard,
}: Props) {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Welcome to anon0mesh</Text>
        <Text style={styles.subtitle}>
          Set a nickname to personalize your wallet (optional).
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Nickname (optional)"
          placeholderTextColor="#888"
          value={tempNickname}
          onChangeText={setTempNickname}
          returnKeyType="done"
        />

        <TouchableOpacity style={styles.button} onPress={onboard} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Create Wallet</Text>
        </TouchableOpacity>

        <Text style={styles.helper}>
          Your keys stay on this device and will be protected by biometrics or
          device passcode.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#bbb',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    width: '100%',
    backgroundColor: '#0A0A0A',
    borderColor: '#A855F7',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 28,
  },
  button: {
    backgroundColor: '#A855F7',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  helper: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 20,
  },
});
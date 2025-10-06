import { useRouter } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { CipherText } from '../ui/CipherText';

interface IndexScreenProps {
    onEnter?: () => void;
    isReturningUser?: boolean;
}

export default function IndexScreen({ onEnter, isReturningUser }: IndexScreenProps) {
    const navigation = useRouter();

    const handleEnterPress = () => {
        if (onEnter) {
            onEnter();
        } else {
            navigation.back();
        }
    };

    const features = [
        {
            icon: '🔐',
            title: 'End-to-End Encrypted',
            description: 'Your messages are secured with military-grade encryption',
        },
        {
            icon: '📡',
            title: 'Mesh Network',
            description: 'Connect directly with peers via Bluetooth, no internet needed',
        },
        {
            icon: '👻',
            title: 'Stay Anonymous',
            description: 'Own your identity with Solana keys, no sign-up required',
        },
        {
            icon: '🌐',
            title: 'Zone-Based Reach',
            description: 'From local to global, control your message range',
        },
    ];

    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <CipherText text="ANON0MESH" style={styles.title} duration={1500} delay={300} />
                    <Text style={styles.subtitle}>Decentralized P2P Messaging</Text>
                </View>

                {/* Description */}
                <Text style={styles.description}>
                    A self-healing mesh network for private, censorship-resistant communication.
                    Stay connected without relying on centralized servers.
                </Text>

                {/* Features Grid */}
                <View style={styles.featuresContainer}>
                    {features.map((feature, index) => (
                        <View key={index} style={styles.featureCard}>
                            <View style={styles.iconContainer}>
                                <Text style={styles.featureIcon}>{feature.icon}</Text>
                            </View>
                            <Text style={styles.featureTitle}>{feature.title}</Text>
                            <Text style={styles.featureDescription}>{feature.description}</Text>
                        </View>
                    ))}
                </View>

                {/* CTA Button */}
                <TouchableOpacity 
                    style={styles.button}
                    onPress={handleEnterPress}
                    activeOpacity={0.85}
                >
                    <View style={styles.buttonContent}>
                        <Text style={styles.buttonText}>
                            {isReturningUser ? 'CONTINUE' : 'ENTER THE MESH'}
                        </Text>
                        <Text style={styles.buttonArrow}>→</Text>
                    </View>
                    <View style={styles.buttonGlow} />
                </TouchableOpacity>

                {/* Footer */}
                <Text style={styles.footer}>
                    🔒 Open Source • Private • Decentralized
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    container: {
        flexGrow: 1,
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: '8%',
        minHeight: '100%',
    },
    content: {
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        maxWidth: 500,
        flex: 1,
    },
    header: {
        alignItems: 'center',
        marginBottom: '6%',
        marginTop: '4%',
    },
    logo: {
        fontSize: 48,
        marginBottom: 8,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 34,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 6,
        letterSpacing: 2,
        textShadowColor: '#B10FF280',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
        fontFamily: 'Primal',
    },
    subtitle: {
        color: '#888888',
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        fontFamily: 'Lexend_400Regular',
    },
    featuresContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        marginBottom: '6%',
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
    },
    featureCard: {
        width: '47%',
        minWidth: 140,
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2a2a2a',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#B10FF220',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        borderWidth: 2,
        borderColor: '#B10FF240',
    },
    featureIcon: {
        fontSize: 22,
    },
    featureTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 4,
        letterSpacing: -0.2,
        fontFamily: 'Lexend_400Regular',
    },
    featureDescription: {
        color: '#999999',
        fontSize: 10,
        textAlign: 'center',
        lineHeight: 14,
        fontFamily: 'Lexend_400Regular',
    },
    description: {
        color: '#CCCCCC',
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
        marginBottom: '5%',
        marginTop: 0,
        paddingHorizontal: '4%',
        maxWidth: 400,
        fontFamily: 'Lexend_400Regular',
    },
    button: {
        position: 'relative',
        backgroundColor: '#B10FF2',
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 14,
        shadowColor: '#B10FF2',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 10,
        marginBottom: '4%',
        overflow: 'visible',
        borderWidth: 2,
        borderColor: '#C84FFE',
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 15,
        letterSpacing: 1.2,
        textShadowColor: '#00000040',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
        fontFamily: 'Lexend_400Regular',
    },
    buttonArrow: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Lexend_400Regular',
    },
    buttonGlow: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: 16,
        backgroundColor: '#B10FF240',
        zIndex: -1,
        opacity: 0.5,
    },
    footer: {
        color: '#666666',
        fontSize: 10,
        textAlign: 'center',
        fontWeight: '500',
        letterSpacing: 0.5,
        fontFamily: 'Lexend_400Regular',
    },
});
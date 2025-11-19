import React, { useRef, useState } from 'react';
import {
    PanResponder,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import MainMenuModal from '../modals/MainMenuModal';

interface BottomNavWithMenuProps {
    onNavigateToMessages?: () => void;
    onNavigateToWallet?: () => void;
    onNavigateToHistory?: () => void;
    onNavigateToMeshZone?: () => void;
    onNavigateToProfile?: () => void;
    onDisconnect?: () => void;
}

export default function BottomNavWithMenu({
    onNavigateToMessages,
    onNavigateToWallet,
    onNavigateToHistory,
    onNavigateToMeshZone,
    onNavigateToProfile,
    onDisconnect,
}: BottomNavWithMenuProps) {
    const [showMenu, setShowMenu] = useState(false);

    // Pan responder for swipe up gesture
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only respond to upward swipes
                return gestureState.dy < -10;
            },
            onPanResponderRelease: (_, gestureState) => {
                // If swiped up (negative dy) with enough velocity or distance
                if (gestureState.dy < -50 || gestureState.vy < -0.5) {
                    setShowMenu(true);
                }
            },
        })
    ).current;

    return (
        <>
            {/* Bottom Navigation Bar */}
            <View style={styles.container} {...panResponder.panHandlers}>
                <TouchableOpacity 
                    onPress={() => setShowMenu(true)}
                    style={styles.touchable}
                >
                    <View style={styles.handle} />
                    <View style={styles.handle} />
                </TouchableOpacity>
            </View>

            {/* Main Menu Modal */}
            <MainMenuModal
                visible={showMenu}
                onClose={() => setShowMenu(false)}
                onNavigateToMessages={() => {
                    setShowMenu(false);
                    onNavigateToMessages?.();
                }}
                onNavigateToWallet={() => {
                    setShowMenu(false);
                    onNavigateToWallet?.();
                }}
                onNavigateToHistory={() => {
                    setShowMenu(false);
                    onNavigateToHistory?.();
                }}
                onNavigateToMeshZone={() => {
                    setShowMenu(false);
                    onNavigateToMeshZone?.();
                }}
                onNavigateToProfile={() => {
                    setShowMenu(false);
                    onNavigateToProfile?.();
                }}
                onDisconnect={() => {
                    setShowMenu(false);
                    onDisconnect?.();
                }}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        borderWidth: 2,
        borderColor: '#22D3EE',
        borderBottomWidth: 0,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 15,
        paddingBottom: 10,
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    touchable: {
        alignItems: 'center',
        gap: 6,
    },
    handle: {
        width: 40,
        height: 3,
        backgroundColor: '#22D3EE',
        borderRadius: 2,
    },
});

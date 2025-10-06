import React, { useRef } from 'react';
import { FlatList, Text, View, StyleSheet } from 'react-native';

export interface Message {
    from: string;
    to?: string;
    msg: string;
    ts: number;
}

interface Props {
    messages: Message[];
    currentUser: string;
    showUsername?: boolean;
}

export default function MessageList({
    messages,
    currentUser,
    showUsername = false,
}: Props) {
    const ref = useRef<FlatList>(null);

    const renderItem = ({ item }: { item: Message }) => {
        const isMe = currentUser === item.from;
        const isPrivate = !!item.to;

        return (
            <View style={styles.messageContainer}>
                {/* Username and message inline */}
                <Text style={styles.messageText}>
                    {showUsername && (
                        <Text style={[styles.username, isMe && styles.usernameMe]}>
                            {item.from}
                            {isPrivate && (
                                <Text style={styles.privateIndicator}> → {item.to}</Text>
                            )}
                            {': '}
                        </Text>
                    )}
                    <Text style={[styles.messageContent, isMe && styles.messageContentMe]}>
                        {item.msg}
                    </Text>
                    <Text style={styles.timestamp}>
                        {' '}
                        {new Date(item.ts).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        })}
                    </Text>
                </Text>
            </View>
        );
    };

    return (
        <FlatList
            ref={ref}
            data={messages}
            keyExtractor={(item, index) => `${item.ts}-${index}`}
            renderItem={renderItem}
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0f0f',
    },
    contentContainer: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        paddingBottom: 90,
        flexGrow: 1,
        justifyContent: 'flex-start',
    },
    messageContainer: {
        marginVertical: 2,
        paddingHorizontal: 4,
        alignItems: 'flex-start',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#e5e7eb',
        letterSpacing: 0.2,
        fontFamily: 'Lexend_400Regular',
        textAlign: 'left',
    },
    username: {
        fontWeight: '600',
        color: '#9ca3af',
        fontFamily: 'Lexend_400Regular',
    },
    usernameMe: {
        color: '#0084ff',
        fontFamily: 'Lexend_400Regular',
    },
    privateIndicator: {
        color: '#4ade80',
        fontWeight: '500',
        fontFamily: 'Lexend_400Regular',
    },
    messageContent: {
        color: '#e5e7eb',
        fontFamily: 'Lexend_400Regular',
    },
    messageContentMe: {
        color: '#e5e7eb',
        fontFamily: 'Lexend_400Regular',
    },
    timestamp: {
        fontSize: 11,
        color: '#6b7280',
        fontWeight: '400',
        fontFamily: 'Lexend_400Regular',
    },
});

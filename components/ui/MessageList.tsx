import React, { useRef } from 'react';
import { FlatList, Text, View } from 'react-native';

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

        const bgColor = isMe ? '#00FF9C' : isPrivate ? '#FF00FF' : '#1A1A1A';
        const textColor = isMe ? '#0A0A0A' : '#FFFFFF';
        const borderColor = isMe ? '#00FF9C' : isPrivate ? '#FF00FF' : '#333';

        return (
            <View
                style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    backgroundColor: bgColor,
                    borderRadius: 16,
                    padding: 10,
                    marginVertical: 4,
                    maxWidth: '70%',
                    borderWidth: 1,
                    borderColor,
                    shadowColor: bgColor,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.6,
                    shadowRadius: 4,
                }}
            >
                {/* ✅ Username now shows for EVERY message when showUsername is true */}
                {showUsername && (
                    <Text
                        style={{
                            fontSize: 12,
                            color: isMe ? '#333333' : '#AAAAAA',
                            fontFamily: 'Courier',
                            marginBottom: 2,
                        }}
                    >
                        {item.from}
                        {isPrivate ? ` → ${item.to}` : ''}:
                    </Text>
                )}

                <Text
                    style={{
                        color: textColor,
                        fontFamily: 'Courier',
                    }}
                >
                    {item.msg}
                </Text>

                <Text
                    style={{
                        fontSize: 10,
                        color: '#888888',
                        alignSelf: 'flex-end',
                        fontFamily: 'Courier',
                    }}
                >
                    {new Date(item.ts).toLocaleTimeString()}
                </Text>
            </View>
        );
    };

    return (
        <FlatList
            ref={ref}
            data={messages}
            keyExtractor={(_, i) => i.toString()}
            renderItem={renderItem}
            contentContainerStyle={{
                padding: 12,
                backgroundColor: '#0A0A0A',
                flexGrow: 1,
            }}
            onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
            onLayout={() => ref.current?.scrollToEnd({ animated: true })}
        />
    );
}

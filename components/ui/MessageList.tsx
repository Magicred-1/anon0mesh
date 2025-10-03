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

        const bgColor = isMe
            ? '#404040' // my messages - darker
            : isPrivate
            ? '#4a4a4a' // private incoming - slightly lighter
            : '#3a3a3a'; // public incoming

        const textColor = '#FFFFFF';

        return (
            <View
                style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    backgroundColor: bgColor,
                    borderRadius: 12,
                    padding: 8,
                    marginVertical: 2,
                    maxWidth: '75%',
                    marginHorizontal: 12,
                    borderWidth: 0,
                }}
            >
                {showUsername && (
                    <Text
                        style={{
                            fontSize: 11,
                            color: '#cccccc',
                            fontFamily: 'System',
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
                        fontSize: 14,
                        fontFamily: 'System',
                        lineHeight: 18,
                    }}
                >
                    {item.msg}
                </Text>

                <Text
                    style={{
                        fontSize: 9,
                        color: '#999999',
                        alignSelf: 'flex-end',
                        fontFamily: 'System',
                        marginTop: 2,
                    }}
                >
                    {new Date(item.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            style={{ 
                flex: 1, 
                backgroundColor: '#212122',
                paddingHorizontal: 0,
            }}
            contentContainerStyle={{ 
                paddingVertical: 8,
                paddingBottom: 80, // Add bottom padding for message input
                flexGrow: 1,
            }}
            showsVerticalScrollIndicator={false}
            inverted
        />
    );
}

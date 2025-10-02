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
            ? '#A855F7' // my messages
            : isPrivate
            ? '#C084FC' // private incoming
            : '#111111'; // public incoming

        const textColor = isMe ? '#0A0A0A' : '#FFFFFF';

        const borderColor = isMe
            ? '#C084FC'
            : isPrivate
            ? '#A855F7'
            : '#333333';

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
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                }}
            >
                {showUsername && (
                    <Text
                        style={{
                            fontSize: 12,
                            color: isMe ? '#222222' : '#888888',
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
                        marginTop: 4,
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

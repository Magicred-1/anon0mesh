import { Box, Button, ButtonText, ScrollView, Text } from '@gluestack-ui/themed';
import { useNavigation } from '@react-navigation/native';
import React from 'react';

export default function IndexScreen() {
    const navigation = useNavigation();

    return (
        <ScrollView flex={1} bg="$black">
        <Box flex={1} justifyContent="center" alignItems="center" p="$6" mt="$20">
            {/* <Image
            source={require('../../assets/logo.png')}
            alt="Anon0Mesh Logo"
            size="xl"
            mb="$6"
            borderRadius="$lg"
            borderWidth={2}
            borderColor="$green500"
            /> */}
            <Text color="$green400" fontSize="$3xl" fontFamily="$mono" fontWeight="bold" textAlign="center" mb="$4">
            anon0mesh
            </Text>
            <Text color="$gray300" fontSize="$md" fontFamily="$mono" lineHeight="$lg" textAlign="center" mb="$8">
            A decentralized, peer-to-peer messaging experiment built with encrypted BLE mesh technology and Solana keys.
            {"\n"}Stay anonymous. Stay connected. Own your identity.
            </Text>
            <Button size="lg" bg="$green600" px="$10" rounded="$xl" onPress={() => navigation.navigate('chat' as never)}>
            <ButtonText color="$black" fontWeight="bold" fontFamily="$mono">
                ENTER THE MESH
            </ButtonText>
            </Button>
        </Box>
        </ScrollView>
    );
}

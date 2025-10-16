import { useFonts } from 'expo-font';
import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle } from 'react-native';

interface CipherTextProps {
    text: string;
    style?: TextStyle;
    duration?: number;
    delay?: number;
}

const CIPHER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';

export const CipherText: React.FC<CipherTextProps> = ({ 
    text, 
    style, 
    duration = 1000,
    delay = 0 
}) => {
    const [displayText, setDisplayText] = useState(text);
    const [fontsLoaded] = useFonts({
        Primal: require('../fonts/Primal/Primal.ttf'), // Adjust path to your font file
    });
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!fontsLoaded) return;

        // Clear any existing timers
        if (timerRef.current) clearTimeout(timerRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);

        const startAnimation = () => {
            const frameTime = 50;
            const totalFrames = Math.ceil(duration / frameTime);
            let currentFrame = 0;

            intervalRef.current = setInterval(() => {
                // Calculate progress (0 to 1)
                const progress = currentFrame / totalFrames;
                
                const displayChars = text.split('').map((char, index) => {
                    // Space characters never change
                    if (char === ' ') return ' ';
                    
                    // Reveal characters progressively based on their position
                    const charProgress = Math.max(0, progress - (index / text.length) * 0.3);
                    
                    if (charProgress >= 1) {
                        return char; // Fully revealed
                    } else if (charProgress > 0) {
                        return Math.random() > charProgress ? generateRandomChar() : char;
                    } else {
                        return generateRandomChar(); // Not yet started revealing
                    }
                });

                setDisplayText(displayChars.join(''));
                currentFrame++;

                if (currentFrame > totalFrames) {
                    setDisplayText(text);
                    if (intervalRef.current) clearInterval(intervalRef.current);
                }
            }, frameTime);
        };

        timerRef.current = setTimeout(startAnimation, delay);

        // Cleanup function
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [fontsLoaded, text, duration, delay]);

    if (!fontsLoaded) {
        return <Text style={style}>{text}</Text>;
    }

    const generateRandomChar = () => {
        return CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
    };

    const mergedStyle: TextStyle = {
        fontFamily: 'Primal',
        ...style,
    };

    return (
        <Text style={mergedStyle}>
            {displayText}
        </Text>
    );
};

export default CipherText;
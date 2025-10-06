import React, { useState, useEffect, useRef } from 'react';
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
    const hasAnimated = useRef(false);

    const generateRandomChar = () => {
        return CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
    };

    const animateText = React.useCallback(() => {
        if (hasAnimated.current) return;
        hasAnimated.current = true;

        const iterations = Math.floor(duration / 50);
        let currentIteration = 0;

        const interval = setInterval(() => {
            if (currentIteration < iterations) {
                const randomText = text
                    .split('')
                    .map((char) => {
                        if (char === ' ') return ' ';
                        return Math.random() > 0.5 ? generateRandomChar() : char;
                    })
                    .join('');
                setDisplayText(randomText);
                currentIteration++;
            } else {
                setDisplayText(text);
                clearInterval(interval);
            }
        }, 50);

        return () => clearInterval(interval);
    }, [text, duration]);

    useEffect(() => {
        const timer = setTimeout(animateText, delay);
        return () => clearTimeout(timer);
    }, [text, delay, animateText]);

    return (
        <Text style={style}>
            {displayText}
        </Text>
    );
};

export default CipherText;

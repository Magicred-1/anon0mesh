/**
 * Solana Polyfills for React Native
 * 
 * Required for @solana/web3.js to work in React Native/Expo environment
 * 
 * Import this at the top of your root layout (_layout.tsx)
 */

// Crypto randomness - MUST BE FIRST
import 'react-native-get-random-values';

// Text encoding/decoding
import 'fast-text-encoding';

// Buffer global
import { Buffer } from 'buffer';
global.Buffer = Buffer;


// MessageChannel polyfill for nostr-tools
// React Native doesn't have MessageChannel, so we provide a simple implementation
if (typeof global.MessageChannel === 'undefined') {
  class MessageChannel {
    port1: any;
    port2: any;

    constructor() {
      const listeners: ((event: any) => void)[] = [];

      this.port1 = {
        postMessage: (message: any) => {
          // Use setImmediate to make it async
          setImmediate(() => {
            listeners.forEach(listener => listener({ data: message }));
          });
        },
        addEventListener: (type: string, listener: (event: any) => void) => {
          if (type === 'message') {
            listeners.push(listener);
          }
        },
        removeEventListener: () => { },
        start: () => { },
        close: () => { },
        onmessage: null,
        onmessageerror: null,
        dispatchEvent: () => false,
      };

      this.port2 = {
        postMessage: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        start: () => { },
        close: () => { },
        onmessage: null,
        onmessageerror: null,
        dispatchEvent: () => false,
      };
    }
  }

  (global as any).MessageChannel = MessageChannel;
}

console.log('✅ Solana polyfills loaded');

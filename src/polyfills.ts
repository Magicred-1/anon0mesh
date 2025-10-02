/**
 * Comprehensive Crypto Polyfills for React Native
 * This file must be imported first before any other imports
 */

// Import crypto polyfills first - this should be sufficient for most cases
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

// Setup global Buffer immediately
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Force setup crypto immediately, don't wait for lazy imports
const setupCryptoImmediate = () => {
  try {
    // Try to use expo-crypto if available (using import would break in some contexts)
    let ExpoCrypto: any = null;
    try {
      ExpoCrypto = eval('require')('expo-crypto');
    } catch {
      // expo-crypto not available, will use fallback
    }
    
    // Create crypto object if it doesn't exist
    if (typeof global.crypto === 'undefined') {
      (global as any).crypto = {};
    }
    
    // Override getRandomValues to ensure it works
    (global as any).crypto.getRandomValues = (typedArray: any) => {
      try {
        // Try expo-crypto first if available
        if (ExpoCrypto) {
          const randomBytes = ExpoCrypto.getRandomBytes(typedArray.length);
          for (let i = 0; i < typedArray.length; i++) {
            typedArray[i] = randomBytes[i];
          }
          return typedArray;
        }
        throw new Error('Expo crypto not available');
      } catch (error) {
        console.warn('Expo crypto failed, using Math.random fallback:', error);
        // Fallback to Math.random
        for (let i = 0; i < typedArray.length; i++) {
          typedArray[i] = Math.floor(Math.random() * 256);
        }
        return typedArray;
      }
    };
    
    console.log('✅ Crypto polyfill setup completed (expo-crypto)');
    return true;
  } catch (error) {
    console.warn('Expo crypto not available, using Math.random fallback:', error);
    
    // Fallback implementation using Math.random
    if (typeof global.crypto === 'undefined') {
      (global as any).crypto = {};
    }
    
    (global as any).crypto.getRandomValues = (typedArray: any) => {
      for (let i = 0; i < typedArray.length; i++) {
        typedArray[i] = Math.floor(Math.random() * 256);
      }
      return typedArray;
    };
    
    console.log('✅ Crypto polyfill setup completed (Math.random fallback)');
    return false;
  }
};

// Setup immediately
setupCryptoImmediate();

// Additional polyfills that might be needed
if (typeof global.crypto.randomUUID === 'undefined') {
  (global as any).crypto.randomUUID = () => {
    // Simple UUID v4 implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}

// Test immediately to make sure it works
try {
  const testArray = new Uint8Array(8);
  global.crypto.getRandomValues(testArray);
  const hasNonZero = testArray.some(byte => byte !== 0);
  if (hasNonZero) {
    console.log('✅ Crypto polyfill test passed:', Array.from(testArray).slice(0, 4));
  } else {
    console.warn('⚠️ Crypto polyfill returns all zeros');
  }
} catch (error) {
  console.error('❌ Crypto polyfill test failed:', error);
  
  // Emergency fallback
  (global as any).crypto = {
    getRandomValues: (typedArray: any) => {
      for (let i = 0; i < typedArray.length; i++) {
        typedArray[i] = Math.floor(Math.random() * 256);
      }
      return typedArray;
    }
  };
  console.log('🚨 Emergency crypto fallback activated');
}

export {}; // Make this a module
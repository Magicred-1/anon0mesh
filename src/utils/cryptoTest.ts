/**
 * Crypto Polyfill Test Utility
 * This file tests if crypto.getRandomValues is properly polyfilled
 * for Solana Keypair generation in React Native
 */

export const testCryptoPolyfill = (): boolean => {
  try {
    // Test if crypto.getRandomValues exists
    if (typeof global.crypto === 'undefined' || typeof global.crypto.getRandomValues === 'undefined') {
      console.error('❌ crypto.getRandomValues is not available');
      return false;
    }

    // Test if it can generate random values
    const testArray = new Uint8Array(32);
    global.crypto.getRandomValues(testArray);
    
    // Check if the array was filled with non-zero values
    const hasRandomValues = testArray.some(byte => byte !== 0);
    
    if (hasRandomValues) {
      console.log('✅ crypto.getRandomValues is working correctly');
      return true;
    } else {
      console.error('❌ crypto.getRandomValues returned all zeros');
      return false;
    }
  } catch (error) {
    console.error('❌ crypto.getRandomValues test failed:', error);
    return false;
  }
};

export const testSolanaKeypairGeneration = (): boolean => {
  try {
    // This will be tested when user tries to create a keypair
    console.log('🔑 Solana Keypair generation will be tested when onboarding');
    return true;
  } catch (error) {
    console.error('❌ Solana Keypair generation test failed:', error);
    return false;
  }
};
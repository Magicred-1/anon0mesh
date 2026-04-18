import 'react-native-get-random-values';
import { Buffer } from 'buffer';
// Buffer must be available globally before @solana/web3.js loads
(globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer ??= Buffer;

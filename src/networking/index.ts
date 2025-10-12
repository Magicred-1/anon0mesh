// src/networking/index.ts
// Clean exports for the new BLE Solana networking architecture

export { RealBLEManager } from './RealBLEManager';
export { BLEPacketEncoder } from './BLEPacketEncoder';

export {
    BLEMessageType,
    BLESolanaTransactionHelper,
    BLETransactionQueue,
} from '../types/BLESolanaTypes';

export type {
    BLESolanaPacket,
    ChatMessage,
    SolanaTransactionRequest,
    SolanaTransactionResponse,
    SolanaTransactionBroadcast,
    TransactionStatusRequest,
    TransactionStatusResponse,
    TransactionStatus,
    SerializedSolanaTransaction,
} from '../types/BLESolanaTypes';

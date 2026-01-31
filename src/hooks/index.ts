// Mesh chat exports (kard-network-ble-mesh)
export { useNoiseChat } from './useNoiseChat';
export type { NoiseMessage, NoiseSessionInfo } from './useNoiseChat';

// Nostr chat exports
export * from './useNostrChat';

// Wallet auto-detect exports
export * from './useWalletAutoDetect';

// Tor integration exports
export {
  useTor,
  useTorMainnet,
  useTorDevnet,
  useTorTestnet,
} from './useTor';
export type { UseTorOptions, UseTorReturn } from './useTor';

// Direct mesh chat exports (preferred for new code)
export { useMeshChat } from '../contexts/MeshChatContext';
export type { MeshChatMessage } from '../contexts/MeshChatContext';

/**
 * BLE Infrastructure - Clean Exports
 * 
 * Provides:
 * - BLEAdapter: Original dual-mode BLE adapter
 * - BLEAdapterEnhanced: Enhanced adapter with session management
 * - BLESessionsManager: Persistent session management with auto-reconnection
 * - BLEPlatformConfig: Platform-specific optimizations for iOS/Android
 */

// Core interfaces
export * from './IBLEAdapter';

// Original adapter (backward compatible)
export * from './BLEAdapter';

// Enhanced adapter with session management
export { BLEAdapterEnhanced } from './BLEAdapterEnhanced';

// Session management
export { 
  BLESessionsManager, 
  bleSessionsManager,
  DEFAULT_SESSION_CONFIG,
  type SessionConfig,
  type SessionInfo,
  type SessionState,
} from './BLESessionsManager';

// Platform configuration
export {
  getPlatform,
  isIOS,
  isAndroid,
  getPlatformBLEConfig,
  getiOSConfig,
  getAndroidConfig,
  getPlatformSessionConfig,
  getPlatformScanOptions,
  getPlatformAdvertiseOptions,
  defaultForegroundServiceConfig,
  type PlatformType,
  type iOSBLEConfig,
  type AndroidBLEConfig,
  type ConnectionPoolConfig,
  type PlatformBLEConfig,
  type ForegroundServiceConfig,
} from './BLEPlatformConfig';

// Serializers
export { serialize as serializePacket, deserialize as deserializePacket } from './PacketSerializer';
export { serializePeer, deserializePeer } from './PeerSerializer';

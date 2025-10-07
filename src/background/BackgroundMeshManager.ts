/* eslint-disable */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Anon0MeshPacket, MessageType } from '../gossip/types';
import { Buffer } from 'buffer';

// Optional imports - these may not be available in Expo Go
let BackgroundFetch: any = null;
let TaskManager: any = null;
let isBackgroundAvailable = false;

// Check if modules are available without throwing errors
const checkModuleAvailable = (moduleName: string): boolean => {
  try {
    require.resolve(moduleName);
    return true;
  } catch {
    return false;
  }
};

// Only require if modules exist
if (checkModuleAvailable('expo-background-fetch') && checkModuleAvailable('expo-task-manager')) {
  try {
    BackgroundFetch = require('expo-background-fetch');
    TaskManager = require('expo-task-manager');
    isBackgroundAvailable = true;
    console.log('[BG-MESH] Background task modules loaded successfully');
  } catch (error) {
    console.log('[BG-MESH] Background tasks not available:', error);
  }
} else {
  console.log('[BG-MESH] Background task modules not found (Expo Go or not installed)');
}
/* eslint-enable */

// Background task names
const MESH_RELAY_TASK = 'mesh-relay-task';
const MESH_GOSSIP_TASK = 'mesh-gossip-task';

// Storage keys for persistence
const STORAGE_KEYS = {
  PENDING_PACKETS: 'mesh_pending_packets',
  DEVICE_ID: 'mesh_device_id',
  RELAY_STATE: 'mesh_relay_state',
  LAST_GOSSIP: 'mesh_last_gossip',
} as const;

interface BackgroundMeshState {
  isActive: boolean;
  lastActivity: number;
  pendingPackets: Anon0MeshPacket[];
  deviceId?: string;
  relayEnabled: boolean;
  gossipEnabled: boolean;
}

/**
 * Background Mesh Manager
 * Handles mesh networking operations when the app is in the background
 * Ensures relay and gossip continue even when UI is not active
 */
export class BackgroundMeshManager {
  private static instance: BackgroundMeshManager | null = null;
  private isInitialized = false;
  private state: BackgroundMeshState = {
    isActive: false,
    lastActivity: 0,
    pendingPackets: [],
    relayEnabled: true,
    gossipEnabled: true,
  };

  // Singleton pattern
  public static getInstance(): BackgroundMeshManager {
    if (!BackgroundMeshManager.instance) {
      BackgroundMeshManager.instance = new BackgroundMeshManager();
    }
    return BackgroundMeshManager.instance;
  }

  /**
   * Initialize background mesh networking
   */
  async initialize(deviceId: string): Promise<void> {
    if (this.isInitialized) {
      console.log('[BG-MESH] Already initialized');
      return;
    }

    try {
      console.log('[BG-MESH] Initializing background mesh manager...');
      
      // Check if background fetch is available (not available in Expo Go)
      const isAvailable = await this.checkBackgroundFetchAvailable();
      if (!isAvailable) {
        console.warn('[BG-MESH] Background fetch not available - requires custom development build');
        console.warn('[BG-MESH] App will work normally but background tasks are disabled');
        console.warn('[BG-MESH] To enable: Run "expo run:android" or "expo run:ios" instead of Expo Go');
        this.isInitialized = true;
        this.state.isActive = false;
        return;
      }
      
      // Store device ID
      this.state.deviceId = deviceId;
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);

      // Load previous state
      await this.loadState();

      // Register background tasks
      await this.registerBackgroundTasks();

      // Start background operations
      await this.startBackgroundOperations();

      this.isInitialized = true;
      this.state.isActive = true;
      
      console.log('[BG-MESH] Background mesh manager initialized successfully');
    } catch (error) {
      console.error('[BG-MESH] Failed to initialize:', error);
      console.warn('[BG-MESH] Continuing without background tasks (requires custom dev build)');
      this.isInitialized = true;
      this.state.isActive = false;
      // Don't throw - allow app to continue without background support
    }
  }

  /**
   * Check if background fetch is available (not available in Expo Go)
   */
  private async checkBackgroundFetchAvailable(): Promise<boolean> {
    if (!BackgroundFetch) return false;
    
    try {
      const status = await BackgroundFetch.getStatusAsync();
      return status !== null;
    } catch {
      // Background fetch not available (Expo Go or not configured)
      return false;
    }
  }

  /**
   * Register background tasks with TaskManager
   */
  private async registerBackgroundTasks(): Promise<void> {
    // Check if modules are available
    if (!BackgroundFetch || !TaskManager) {
      console.log('[BG-MESH] Background modules not available');
      return;
    }

    // Check if background fetch is available first
    const isAvailable = await this.checkBackgroundFetchAvailable();
    if (!isAvailable) {
      throw new Error('Background fetch not available');
    }

    // Register relay task
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TaskManager.defineTask(MESH_RELAY_TASK, async ({ data, error }: any) => {
      if (error) {
        console.error('[BG-MESH] Relay task error:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }

      try {
        console.log('[BG-MESH] Running relay task in background');
        await this.handleRelayTask();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (taskError) {
        console.error('[BG-MESH] Relay task failed:', taskError);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });

    // Register gossip task
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TaskManager.defineTask(MESH_GOSSIP_TASK, async ({ data, error }: any) => {
      if (error) {
        console.error('[BG-MESH] Gossip task error:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }

      try {
        console.log('[BG-MESH] Running gossip task in background');
        await this.handleGossipTask();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (taskError) {
        console.error('[BG-MESH] Gossip task failed:', taskError);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });

    console.log('[BG-MESH] Background tasks registered');
  }

  /**
   * Start background operations
   */
  private async startBackgroundOperations(): Promise<void> {
    try {
      // Register background fetch for both tasks
      await BackgroundFetch.registerTaskAsync(MESH_RELAY_TASK, {
        minimumInterval: 15000, // 15 seconds minimum
        stopOnTerminate: false,
        startOnBoot: true,
      });

      await BackgroundFetch.registerTaskAsync(MESH_GOSSIP_TASK, {
        minimumInterval: 30000, // 30 seconds minimum
        stopOnTerminate: false,
        startOnBoot: true,
      });

      console.log('[BG-MESH] Background operations started');
    } catch (error) {
      console.error('[BG-MESH] Failed to start background operations:', error);
      console.warn('[BG-MESH] This is expected in Expo Go - use custom dev build for background tasks');
      throw error; // Re-throw to be caught by initialize()
    }
  }

  /**
   * Handle relay task - process and forward packets
   */
  private async handleRelayTask(): Promise<void> {
    if (!this.state.relayEnabled) {
      return;
    }

    try {
      // Process pending packets
      const pendingPackets = await this.getPendingPackets();
      
      if (pendingPackets.length > 0) {
        console.log(`[BG-MESH] Processing ${pendingPackets.length} pending packets in background`);
        
        // Note: Actual BLE relay happens in foreground via MeshNetworkingManager
        // Background task just maintains the queue and logs activity
        
        // Update last activity
        this.state.lastActivity = Date.now();
        await this.saveState();
        
        console.log(`[BG-MESH] Relay task completed - ${pendingPackets.length} packets ready for foreground relay`);
      }
      
    } catch (error) {
      console.error('[BG-MESH] Relay task error:', error);
    }
  }

  /**
   * Handle gossip task - maintain network presence and sync
   */
  private async handleGossipTask(): Promise<void> {
    if (!this.state.gossipEnabled) {
      return;
    }

    try {
      // Log gossip activity for monitoring
      console.log('[BG-MESH] Gossip task running - maintaining presence state');

      // Update gossip timestamp
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_GOSSIP, Date.now().toString());
      
      console.log('[BG-MESH] Gossip task completed');
      
    } catch (error) {
      console.error('[BG-MESH] Gossip task error:', error);
    }
  }

  /**
   * Relay a packet through the mesh network
   * Note: This is a simplified version for background - actual BLE relay happens in foreground
   */
  private async relayPacket(packet: Anon0MeshPacket): Promise<void> {
    if (!packet) {
      return;
    }

    try {
      // Check if packet should be relayed (TTL > 0)
      if (packet.ttl <= 0) {
        console.log('[BG-MESH] Packet TTL expired, not relaying');
        return;
      }

      // Decrement TTL
      const relayPacket = {
        ...packet,
        ttl: packet.ttl - 1,
      };

      // Log relay activity (actual BLE transmission happens in foreground)
      const data = Buffer.from(JSON.stringify(relayPacket));
      
      console.log(`[BG-MESH] Packet queued for relay - type: ${packet.type}, TTL: ${relayPacket.ttl}, data size: ${data.length}`);
      
    } catch (error) {
      console.error('[BG-MESH] Failed to relay packet:', error);
    }
  }

  /**
   * Announce presence to maintain network connectivity
   */
  private async announcePresence(): Promise<void> {
    if (!this.state.deviceId) {
      return;
    }

    try {
      const packet: Anon0MeshPacket = {
        type: MessageType.ANNOUNCE,
        senderID: Buffer.from(this.state.deviceId, 'hex'),
        recipientID: undefined,
        timestamp: BigInt(Date.now()),
        payload: Buffer.from(JSON.stringify({
          status: 'background_active',
          lastActivity: this.state.lastActivity,
        })),
        signature: undefined,
        ttl: 3,
      };

      await this.relayPacket(packet);
      console.log('[BG-MESH] Presence announced from background');
      
    } catch (error) {
      console.error('[BG-MESH] Failed to announce presence:', error);
    }
  }

  /**
   * Add packet to relay queue
   */
  async addPacketToQueue(packet: Anon0MeshPacket): Promise<void> {
    try {
      const pendingPackets = await this.getPendingPackets();
      pendingPackets.push(packet);
      
      // Limit queue size to prevent memory issues
      const maxQueueSize = 50;
      if (pendingPackets.length > maxQueueSize) {
        pendingPackets.splice(0, pendingPackets.length - maxQueueSize);
      }

      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_PACKETS,
        JSON.stringify(pendingPackets)
      );
      
      console.log(`[BG-MESH] Added packet to background queue (${pendingPackets.length} total)`);
    } catch (error) {
      console.error('[BG-MESH] Failed to add packet to queue:', error);
    }
  }

  /**
   * Get pending packets from storage
   */
  private async getPendingPackets(): Promise<Anon0MeshPacket[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_PACKETS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[BG-MESH] Failed to get pending packets:', error);
      return [];
    }
  }

  /**
   * Clear pending packets
   */
  private async clearPendingPackets(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_PACKETS, JSON.stringify([]));
    } catch (error) {
      console.error('[BG-MESH] Failed to clear pending packets:', error);
    }
  }

  /**
   * Load state from storage
   */
  private async loadState(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.RELAY_STATE);
      if (stored) {
        const savedState = JSON.parse(stored);
        this.state = { ...this.state, ...savedState };
      }
    } catch (error) {
      console.error('[BG-MESH] Failed to load state:', error);
    }
  }

  /**
   * Save state to storage
   */
  private async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.RELAY_STATE, JSON.stringify(this.state));
    } catch (error) {
      console.error('[BG-MESH] Failed to save state:', error);
    }
  }

  /**
   * Enable/disable relay functionality
   */
  async setRelayEnabled(enabled: boolean): Promise<void> {
    this.state.relayEnabled = enabled;
    await this.saveState();
    console.log(`[BG-MESH] Relay ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable/disable gossip functionality
   */
  async setGossipEnabled(enabled: boolean): Promise<void> {
    this.state.gossipEnabled = enabled;
    await this.saveState();
    console.log(`[BG-MESH] Gossip ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current background state
   */
  getState(): Readonly<BackgroundMeshState> {
    return { ...this.state };
  }

  /**
   * Stop background operations
   */
  async stop(): Promise<void> {
    try {
      // Only try to unregister if tasks are actually registered
      const isAvailable = await this.checkBackgroundFetchAvailable();
      if (isAvailable) {
        await BackgroundFetch.unregisterTaskAsync(MESH_RELAY_TASK);
        await BackgroundFetch.unregisterTaskAsync(MESH_GOSSIP_TASK);
      }
      
      this.state.isActive = false;
      await this.saveState();
      
      console.log('[BG-MESH] Background operations stopped');
    } catch {
      // Silently ignore errors when stopping (tasks might not be registered)
      console.log('[BG-MESH] Background tasks not registered or already stopped');
    }
  }

  /**
   * Check if background tasks are registered
   */
  async isBackgroundTaskRegistered(taskName: string): Promise<boolean> {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      return status === BackgroundFetch.BackgroundFetchStatus.Available;
    } catch (error) {
      console.error('[BG-MESH] Failed to check background task status:', error);
      return false;
    }
  }

  /**
   * Get background fetch status
   */
  async getBackgroundStatus(): Promise<number> {
    if (!BackgroundFetch) return 0;
    
    try {
      const status = await BackgroundFetch.getStatusAsync();
      return status ?? 0;
    } catch (error) {
      console.error('[BG-MESH] Failed to get background status:', error);
      return 0;
    }
  }
}

/**
 * Initialize background mesh networking
 */
export async function initializeBackgroundMesh(deviceId: string): Promise<void> {
  const manager = BackgroundMeshManager.getInstance();
  await manager.initialize(deviceId);
}

/**
 * Add packet to background relay queue
 */
export async function addPacketToBackgroundQueue(packet: Anon0MeshPacket): Promise<void> {
  const manager = BackgroundMeshManager.getInstance();
  await manager.addPacketToQueue(packet);
}

/**
 * Stop background mesh operations
 */
export async function stopBackgroundMesh(): Promise<void> {
  const manager = BackgroundMeshManager.getInstance();
  await manager.stop();
}

/**
 * Get background mesh status
 */
export async function getBackgroundMeshStatus(): Promise<{
  isActive: boolean;
  relayEnabled: boolean;
  gossipEnabled: boolean;
  backgroundFetchStatus: number;
}> {
  const manager = BackgroundMeshManager.getInstance();
  const state = manager.getState();
  const backgroundStatus = await manager.getBackgroundStatus();
  
  return {
    isActive: state.isActive,
    relayEnabled: state.relayEnabled,
    gossipEnabled: state.gossipEnabled,
    backgroundFetchStatus: backgroundStatus,
  };
}
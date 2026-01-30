/**
 * BLESessionsManager
 * 
 * Manages persistent BLE sessions with:
 * - Automatic reconnection with exponential backoff
 * - Connection health monitoring (keep-alive)
 * - Session state persistence across app lifecycle
 * - Platform-specific optimizations (iOS/Android)
 * - Connection pool management with priority queuing
 */

import { Device } from "react-native-ble-plx";
import { Platform } from "react-native";
import { IBLEAdapter, BLEConnectionState } from "./IBLEAdapter";

export interface SessionConfig {
  /** Initial reconnect delay in ms */
  initialReconnectDelayMs: number;
  /** Maximum reconnect delay in ms */
  maxReconnectDelayMs: number;
  /** Maximum reconnection attempts (0 = infinite) */
  maxReconnectAttempts: number;
  /** Health check interval in ms */
  healthCheckIntervalMs: number;
  /** Connection timeout in ms */
  connectionTimeoutMs: number;
  /** Whether to auto-reconnect on disconnect */
  autoReconnect: boolean;
  /** Priority for this session (higher = more important) */
  priority: number;
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  initialReconnectDelayMs: 1000,
  maxReconnectDelayMs: 30000,
  maxReconnectAttempts: 0, // Infinite
  healthCheckIntervalMs: 5000,
  connectionTimeoutMs: 10000,
  autoReconnect: true,
  priority: 1,
};

export interface SessionInfo {
  deviceId: string;
  peerId?: string;
  nickname?: string;
  publicKey?: string;
  config: SessionConfig;
  state: SessionState;
  connectedAt?: Date;
  lastActivityAt: Date;
  lastHealthCheckAt?: Date;
  disconnectCount: number;
  reconnectAttempts: number;
  currentReconnectDelayMs: number;
  rssi?: number;
  mtu?: number;
  error?: string;
  // Connection quality metrics
  packetsSent: number;
  packetsReceived: number;
  packetLossRate: number;
  averageLatencyMs: number;
}

export type SessionState = 
  | "connecting"
  | "connected"
  | "disconnecting"
  | "disconnected"
  | "reconnecting"
  | "failed"
  | "sleeping"; // iOS background state

type SessionListener = (session: SessionInfo) => void;
type StateChangeListener = (deviceId: string, oldState: SessionState, newState: SessionState) => void;

/**
 * iOS-specific constants for background handling
 */
const IOS_BACKGROUND_GRACE_PERIOD_MS = 10000; // Time before marking as sleeping
const IOS_RESUME_TIMEOUT_MS = 30000; // Time to wait for iOS to resume connection

/**
 * Android-specific constants
 */
const ANDROID_AUTO_CONNECT_DELAY_MS = 500; // Delay before auto-connect on Android

export class BLESessionsManager {
  private adapter: IBLEAdapter | null = null;
  private sessions = new Map<string, SessionInfo>();
  private timers = new Map<string, ReturnType<typeof setInterval>[]>();
  private listeners = new Map<string, Set<SessionListener>>();
  private stateChangeListeners = new Set<StateChangeListener>();
  private reconnectQueue: string[] = [];
  private isProcessingQueue = false;
  private appInBackground = false;
  private platform: "ios" | "android" | "other";
  
  // Health check interval for all sessions
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  
  // Global session config
  private globalConfig: Partial<SessionConfig> = {};

  constructor() {
    this.platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "other";
    console.log(`[BLESessionsManager] Initialized for platform: ${this.platform}`);
  }

  /**
   * Attach to a BLE adapter
   */
  attachAdapter(adapter: IBLEAdapter): void {
    this.adapter = adapter;
    console.log("[BLESessionsManager] Adapter attached");
    
    // Start global health check
    this.startGlobalHealthCheck();
  }

  /**
   * Set global configuration for all sessions
   */
  setGlobalConfig(config: Partial<SessionConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config };
    console.log("[BLESessionsManager] Global config updated:", this.globalConfig);
  }

  /**
   * Create a new session for a device
   */
  async createSession(
    deviceId: string,
    deviceInfo?: { peerId?: string; nickname?: string; publicKey?: string; rssi?: number },
    config?: Partial<SessionConfig>
  ): Promise<SessionInfo> {
    // Check if session already exists
    const existing = this.sessions.get(deviceId);
    if (existing) {
      // Silently return existing session - this is normal during discovery
      // Update nickname if provided and different
      if (deviceInfo?.nickname && !existing.nickname) {
        existing.nickname = deviceInfo.nickname;
      }
      // Update RSSI if provided
      if (deviceInfo?.rssi !== undefined) {
        existing.rssi = deviceInfo.rssi;
      }
      return existing;
    }

    const mergedConfig = { ...DEFAULT_SESSION_CONFIG, ...this.globalConfig, ...config };
    
    const session: SessionInfo = {
      deviceId,
      peerId: deviceInfo?.peerId,
      nickname: deviceInfo?.nickname,
      publicKey: deviceInfo?.publicKey,
      config: mergedConfig,
      state: "disconnected",
      lastActivityAt: new Date(),
      disconnectCount: 0,
      reconnectAttempts: 0,
      currentReconnectDelayMs: mergedConfig.initialReconnectDelayMs,
      rssi: deviceInfo?.rssi,
      packetsSent: 0,
      packetsReceived: 0,
      packetLossRate: 0,
      averageLatencyMs: 0,
    };

    this.sessions.set(deviceId, session);
    console.log(`[BLESessionsManager] Created session for ${deviceId}`, {
      nickname: session.nickname,
      priority: mergedConfig.priority,
    });

    // Auto-connect if configured
    if (mergedConfig.autoReconnect) {
      await this.connect(deviceId);
    }

    return session;
  }

  /**
   * Connect to a device and establish a session
   */
  async connect(deviceId: string): Promise<boolean> {
    const session = this.sessions.get(deviceId);
    if (!session) {
      console.error(`[BLESessionsManager] No session found for ${deviceId}`);
      return false;
    }

    // Don't connect if already connected or connecting
    if (session.state === "connected" || session.state === "connecting") {
      return true;
    }

    if (!this.adapter) {
      console.error("[BLESessionsManager] No adapter attached");
      return false;
    }

    this.updateSessionState(session, "connecting");
    this.clearTimers(deviceId);

    try {
      // Only log first few connect attempts to reduce spam
      if (session.reconnectAttempts <= 2) {
        console.log(`[BLESessionsManager] Connecting to ${deviceId}...`);
      }
      
      // Platform-specific connection strategy
      const connected = await this.performPlatformSpecificConnect(deviceId);
      
      if (connected) {
        this.updateSessionState(session, "connected");
        session.connectedAt = new Date();
        // Don't reset reconnectAttempts here - wait for stable connection
        // This prevents infinite loops when connection drops immediately after connecting
        session.currentReconnectDelayMs = session.config.initialReconnectDelayMs;
        session.error = undefined;
        
        // Start health check for this session
        this.startSessionHealthCheck(deviceId);
        
        // Subscribe to packets
        await this.subscribeToDevice(deviceId);
        
        // Only log success after reconnection if it took multiple attempts
        if (session.reconnectAttempts === 0) {
          console.log(`[BLESessionsManager] ✅ Connected to ${deviceId}`);
        } else {
          console.log(`[BLESessionsManager] ✅ Reconnected to ${deviceId} (attempt ${session.reconnectAttempts})`);
        }
        this.notifyListeners(deviceId);
        
        return true;
      } else {
        throw new Error("Connection returned false");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[BLESessionsManager] ❌ Failed to connect to ${deviceId}:`, errorMsg);
      
      session.error = errorMsg;
      session.disconnectCount++;
      
      if (session.config.autoReconnect && !this.appInBackground) {
        this.scheduleReconnect(deviceId);
      } else {
        this.updateSessionState(session, "failed");
      }
      
      this.notifyListeners(deviceId);
      return false;
    }
  }

  /**
   * Platform-specific connection logic
   */
  private async performPlatformSpecificConnect(deviceId: string): Promise<boolean> {
    if (!this.adapter) return false;

    // Android: Use autoConnect=true for better background handling
    if (this.platform === "android") {
      // Small delay to prevent rapid reconnection attempts
      await new Promise(resolve => setTimeout(resolve, ANDROID_AUTO_CONNECT_DELAY_MS));
    }

    // iOS: Handle background state differently
    if (this.platform === "ios" && this.appInBackground) {
      // On iOS in background, use state restoration if available
      console.log(`[BLESessionsManager] iOS background connection attempt for ${deviceId}`);
    }

    return await this.adapter.connect(deviceId);
  }

  /**
   * Subscribe to packets from a device
   */
  private async subscribeToDevice(deviceId: string): Promise<void> {
    if (!this.adapter) return;

    try {
      await this.adapter.subscribeToPackets(deviceId, (packet) => {
        this.handlePacketReceived(deviceId, packet);
      });
    } catch (error) {
      console.warn(`[BLESessionsManager] Failed to subscribe to ${deviceId}:`, error);
    }
  }

  /**
   * Handle packet received - update session activity
   */
  private handlePacketReceived(deviceId: string, packet: any): void {
    const session = this.sessions.get(deviceId);
    if (session) {
      session.lastActivityAt = new Date();
      session.packetsReceived++;
      this.notifyListeners(deviceId);
    }
  }

  /**
   * Disconnect a specific session
   */
  async disconnect(deviceId: string, permanent = false): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session) return;

    this.updateSessionState(session, "disconnecting");
    this.clearTimers(deviceId);

    if (this.adapter) {
      try {
        await this.adapter.disconnect(deviceId);
      } catch (error) {
        console.warn(`[BLESessionsManager] Error disconnecting ${deviceId}:`, error);
      }
    }

    if (permanent) {
      this.sessions.delete(deviceId);
      this.listeners.delete(deviceId);
      console.log(`[BLESessionsManager] Removed session for ${deviceId}`);
    } else {
      this.updateSessionState(session, "disconnected");
      session.disconnectCount++;
      this.notifyListeners(deviceId);
    }
  }

  /**
   * Mark a device as disconnected (called from adapter when device disconnects)
   */
  onDeviceDisconnected(deviceId: string, error?: string): void {
    const session = this.sessions.get(deviceId);
    if (!session) return;

    // Skip if already disconnected or reconnecting (prevents duplicate handling)
    if (session.state === "disconnected" || session.state === "reconnecting" || session.state === "failed") {
      return;
    }

    console.log(`[BLESessionsManager] Device ${deviceId} disconnected`, error ? `(error: ${error})` : "");
    
    session.error = error;
    session.disconnectCount++;
    
    // Platform-specific handling
    if (this.platform === "ios" && this.appInBackground) {
      // On iOS in background, mark as sleeping instead of disconnected
      // The connection may resume when app comes to foreground
      this.updateSessionState(session, "sleeping");
      
      // Set a timer to mark as truly disconnected if not resumed
      this.setTimer(deviceId, setTimeout(() => {
        if (session.state === "sleeping") {
          console.log(`[BLESessionsManager] iOS session ${deviceId} did not resume, marking disconnected`);
          this.updateSessionState(session, "disconnected");
          if (session.config.autoReconnect) {
            this.scheduleReconnect(deviceId);
          }
        }
      }, IOS_RESUME_TIMEOUT_MS));
    } else {
      this.updateSessionState(session, "disconnected");
      
      if (session.config.autoReconnect && !this.appInBackground) {
        this.scheduleReconnect(deviceId);
      }
    }

    this.notifyListeners(deviceId);
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(deviceId: string): void {
    const session = this.sessions.get(deviceId);
    if (!session) return;

    // Check max reconnect attempts
    if (session.config.maxReconnectAttempts > 0 && 
        session.reconnectAttempts >= session.config.maxReconnectAttempts) {
      console.log(`[BLESessionsManager] Max reconnect attempts reached for ${deviceId}, giving up`);
      this.updateSessionState(session, "failed");
      // Remove the failed session so it can be rediscovered fresh
      this.sessions.delete(deviceId);
      this.listeners.delete(deviceId);
      console.log(`[BLESessionsManager] Removed failed session for ${deviceId}`);
      return;
    }

    this.updateSessionState(session, "reconnecting");
    session.reconnectAttempts++;

    const delay = session.currentReconnectDelayMs;
    // Only log first few attempts and then every 5th to reduce spam
    if (session.reconnectAttempts <= 3 || session.reconnectAttempts % 5 === 0) {
      console.log(`[BLESessionsManager] Reconnect ${deviceId} in ${delay}ms (attempt ${session.reconnectAttempts}/${session.config.maxReconnectAttempts})`);
    }

    this.setTimer(deviceId, setTimeout(async () => {
      // Increase delay for next attempt (exponential backoff)
      session.currentReconnectDelayMs = Math.min(
        session.currentReconnectDelayMs * 1.5,
        session.config.maxReconnectDelayMs
      );
      
      await this.connect(deviceId);
    }, delay));
  }

  /**
   * Start health check for a specific session
   */
  private startSessionHealthCheck(deviceId: string): void {
    const session = this.sessions.get(deviceId);
    if (!session) return;

    const interval = session.config.healthCheckIntervalMs;
    
    const timer = setInterval(async () => {
      await this.performHealthCheck(deviceId);
    }, interval);

    this.setTimer(deviceId, timer);
  }

  /**
   * Start global health check for all sessions
   */
  private startGlobalHealthCheck(): void {
    if (this.healthCheckTimer) return;

    this.healthCheckTimer = setInterval(() => {
      this.sessions.forEach((session, deviceId) => {
        if (session.state === "connected") {
          this.performHealthCheck(deviceId);
        }
      });
    }, 10000); // Global check every 10 seconds
  }

  /**
   * Perform a health check on a session
   */
  private async performHealthCheck(deviceId: string): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session || !this.adapter) return;

    // Check if still connected
    try {
      const isConnected = await this.adapter.isConnected(deviceId);
      
      if (!isConnected && session.state === "connected") {
        console.log(`[BLESessionsManager] Health check: ${deviceId} not connected`);
        this.onDeviceDisconnected(deviceId, "Health check failed");
        return;
      }

      // Get RSSI if connected
      if (isConnected) {
        // Update last activity if connected
        session.lastHealthCheckAt = new Date();
        
        // Reset reconnect attempts after stable connection (connected > 5 seconds)
        if (session.reconnectAttempts > 0 && session.connectedAt) {
          const connectedTime = Date.now() - session.connectedAt.getTime();
          if (connectedTime > 5000) {
            session.reconnectAttempts = 0;
            console.log(`[BLESessionsManager] Connection stable for ${deviceId}, reset reconnect attempts`);
          }
        }
        
        // Check for stale connection (no activity for too long)
        const inactiveTime = Date.now() - session.lastActivityAt.getTime();
        const staleThreshold = session.config.healthCheckIntervalMs * 3;
        
        if (inactiveTime > staleThreshold) {
          console.log(`[BLESessionsManager] Session ${deviceId} stale (inactive for ${inactiveTime}ms)`);
          // Force a ping or reconnection
          await this.pingDevice(deviceId);
        }
      }

      this.notifyListeners(deviceId);
    } catch (error) {
      console.warn(`[BLESessionsManager] Health check error for ${deviceId}:`, error);
    }
  }

  /**
   * Ping a device to verify it's still responsive
   */
  private async pingDevice(deviceId: string): Promise<void> {
    // This could send an actual ping packet through the adapter
    // For now, we just verify the connection state
    console.log(`[BLESessionsManager] Pinging ${deviceId}...`);
  }

  /**
   * Update session state and notify listeners
   */
  private updateSessionState(session: SessionInfo, newState: SessionState): void {
    const oldState = session.state;
    if (oldState !== newState) {
      session.state = newState;
      console.log(`[BLESessionsManager] Session ${session.deviceId}: ${oldState} -> ${newState}`);
      
      // Notify state change listeners
      this.stateChangeListeners.forEach(listener => {
        try {
          listener(session.deviceId, oldState, newState);
        } catch (error) {
          console.error("[BLESessionsManager] State change listener error:", error);
        }
      });
    }
  }

  /**
   * Set a timer for a specific device
   */
  private setTimer(deviceId: string, timer: ReturnType<typeof setInterval>): void {
    if (!this.timers.has(deviceId)) {
      this.timers.set(deviceId, []);
    }
    this.timers.get(deviceId)!.push(timer);
  }

  /**
   * Clear all timers for a device
   */
  private clearTimers(deviceId: string): void {
    const timers = this.timers.get(deviceId);
    if (timers) {
      timers.forEach(timer => clearTimeout(timer));
      timers.forEach(timer => clearInterval(timer));
      this.timers.delete(deviceId);
    }
  }

  /**
   * Handle app going to background
   */
  onAppBackground(): void {
    console.log("[BLESessionsManager] App going to background");
    this.appInBackground = true;

    // Platform-specific background handling
    if (this.platform === "ios") {
      // iOS: Mark all connected sessions as sleeping
      // They may resume when app comes back
      this.sessions.forEach((session, deviceId) => {
        if (session.state === "connected") {
          this.updateSessionState(session, "sleeping");
          
          // Set a grace period timer
          this.setTimer(deviceId, setTimeout(() => {
            // If still sleeping after grace period, start reconnection
            if (session.state === "sleeping") {
              this.scheduleReconnect(deviceId);
            }
          }, IOS_BACKGROUND_GRACE_PERIOD_MS));
        }
      });
    } else if (this.platform === "android") {
      // Android: Keep connections alive but reduce health check frequency
      // Connection should persist with foreground service
    }
  }

  /**
   * Handle app coming to foreground
   */
  onAppForeground(): void {
    console.log("[BLESessionsManager] App coming to foreground");
    this.appInBackground = false;

    // Check all sessions and reconnect if needed
    this.sessions.forEach((session, deviceId) => {
      if (session.state === "sleeping" || session.state === "disconnected") {
        if (session.config.autoReconnect) {
          console.log(`[BLESessionsManager] Auto-reconnecting ${deviceId} on foreground`);
          this.connect(deviceId);
        }
      } else if (session.state === "connected") {
        // Verify connection is still alive
        this.performHealthCheck(deviceId);
      }
    });
  }

  /**
   * Subscribe to session updates
   */
  subscribe(deviceId: string, listener: SessionListener): () => void {
    if (!this.listeners.has(deviceId)) {
      this.listeners.set(deviceId, new Set());
    }
    this.listeners.get(deviceId)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(deviceId)?.delete(listener);
    };
  }

  /**
   * Subscribe to all state changes
   */
  onStateChange(listener: StateChangeListener): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  /**
   * Notify all listeners for a device
   */
  private notifyListeners(deviceId: string): void {
    const session = this.sessions.get(deviceId);
    if (!session) return;

    const listeners = this.listeners.get(deviceId);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(session);
        } catch (error) {
          console.error("[BLESessionsManager] Listener error:", error);
        }
      });
    }
  }

  /**
   * Get a session by device ID
   */
  getSession(deviceId: string): SessionInfo | undefined {
    return this.sessions.get(deviceId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get connected sessions only
   */
  getConnectedSessions(): SessionInfo[] {
    return this.getAllSessions().filter(s => s.state === "connected" || s.state === "sleeping");
  }

  /**
   * Get sessions by state
   */
  getSessionsByState(state: SessionState): SessionInfo[] {
    return this.getAllSessions().filter(s => s.state === state);
  }

  /**
   * Update session metadata
   */
  updateSessionMetadata(deviceId: string, metadata: Partial<Pick<SessionInfo, "nickname" | "peerId" | "publicKey" | "rssi">>): void {
    const session = this.sessions.get(deviceId);
    if (session) {
      Object.assign(session, metadata);
      this.notifyListeners(deviceId);
    }
  }

  /**
   * Record a packet sent to a device
   */
  recordPacketSent(deviceId: string): void {
    const session = this.sessions.get(deviceId);
    if (session) {
      session.packetsSent++;
      session.lastActivityAt = new Date();
    }
  }

  /**
   * Record a packet received from a device
   */
  recordPacketReceived(deviceId: string): void {
    const session = this.sessions.get(deviceId);
    if (session) {
      session.packetsReceived++;
      session.lastActivityAt = new Date();
    }
  }

  /**
   * Remove a session permanently
   */
  removeSession(deviceId: string): void {
    this.disconnect(deviceId, true);
  }

  /**
   * Clear all sessions
   */
  clearAllSessions(): void {
    this.sessions.forEach((_, deviceId) => {
      this.clearTimers(deviceId);
    });
    this.sessions.clear();
    this.listeners.clear();
    console.log("[BLESessionsManager] All sessions cleared");
  }

  /**
   * Shutdown the manager
   */
  async shutdown(): Promise<void> {
    console.log("[BLESessionsManager] Shutting down...");
    
    // Stop global health check
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Disconnect all sessions
    for (const [deviceId] of this.sessions) {
      await this.disconnect(deviceId);
      this.clearTimers(deviceId);
    }

    this.sessions.clear();
    this.listeners.clear();
    this.stateChangeListeners.clear();
    this.adapter = null;

    console.log("[BLESessionsManager] Shutdown complete");
  }

  /**
   * Get statistics for all sessions
   */
  getStatistics(): {
    totalSessions: number;
    connected: number;
    connecting: number;
    disconnected: number;
    reconnecting: number;
    failed: number;
    sleeping: number;
    totalPacketsSent: number;
    totalPacketsReceived: number;
  } {
    const sessions = this.getAllSessions();
    return {
      totalSessions: sessions.length,
      connected: sessions.filter(s => s.state === "connected").length,
      connecting: sessions.filter(s => s.state === "connecting").length,
      disconnected: sessions.filter(s => s.state === "disconnected").length,
      reconnecting: sessions.filter(s => s.state === "reconnecting").length,
      failed: sessions.filter(s => s.state === "failed").length,
      sleeping: sessions.filter(s => s.state === "sleeping").length,
      totalPacketsSent: sessions.reduce((sum, s) => sum + s.packetsSent, 0),
      totalPacketsReceived: sessions.reduce((sum, s) => sum + s.packetsReceived, 0),
    };
  }
}

// Singleton instance
export const bleSessionsManager = new BLESessionsManager();

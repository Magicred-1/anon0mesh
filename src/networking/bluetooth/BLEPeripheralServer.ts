// src/networking/BLEPeripheralServer.ts
// GATT Server implementation for mesh networking
import Peripheral, { Service, Characteristic } from 'react-native-peripheral';
import { SERVICE_UUID, CHARACTERISTIC_UUID } from './RealBLEManager';
// WiFi integration temporarily disabled
// import { WiFiMeshServer } from '../wifi/WiFiMeshServer';

export class BLEPeripheralServer {
  private service?: any;
  private characteristic?: any;
  private isAdvertising = false;
  private deviceId: string;
  private isAvailable = false;
  private hasAttemptedStart = false;
  private startFailed = false;
  
  // WiFi integration disabled
  // // Tor-secured WiFi fallback
  // private wifiMesh?: WiFiMeshServer;
  // private useWiFiFallback = false;
  
  private onDataReceived?: (data: string, from: string) => void;
  
  constructor(deviceId: string /* WiFi disabled: , enableTor: boolean = true */) {
    this.deviceId = deviceId;
    
    // Check if the Peripheral module is available
    try {
      if (Peripheral && typeof Peripheral.addService === 'function') {
        this.isAvailable = true;
        console.log('[PERIPHERAL] ✅ Peripheral module is available');
      } else {
        this.isAvailable = false;
        console.log('[PERIPHERAL] ⚠️ Peripheral module loaded but methods unavailable');
      }
    } catch (error) {
      this.isAvailable = false;
      console.log('[PERIPHERAL] ⚠️ Peripheral module not available');
    }
    
    if (!this.isAvailable) {
      console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[PERIPHERAL] ⚠️  PERIPHERAL MODE UNAVAILABLE');
      console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[PERIPHERAL] Running in Central-only mode');
      console.log('[PERIPHERAL] Your device can:');
      console.log('[PERIPHERAL]   ✅ Scan for other devices');
      console.log('[PERIPHERAL]   ✅ Connect TO other devices');
      console.log('[PERIPHERAL]   ✅ Send and receive messages');
      console.log('[PERIPHERAL] ');
      console.log('[PERIPHERAL] Your device CANNOT:');
      console.log('[PERIPHERAL]   ❌ Accept incoming BLE connections');
      // WiFi disabled
      // console.log('[PERIPHERAL]   ℹ️  WiFi+Tor fallback will be attempted...');
      console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    // WiFi integration disabled
    // Pre-initialize WiFi mesh with Tor
    // this.wifiMesh = new WiFiMeshServer(deviceId, enableTor, deviceId);
  }
  
  /**
   * Start the GATT server and begin advertising
   * WiFi fallback disabled
   */
  async start() {
    // Don't retry if we've already failed
    // WiFi disabled: if (this.startFailed && this.useWiFiFallback) {
    if (this.startFailed) {
      return;
    }
    
    if (!this.isAvailable) {
      console.log('[PERIPHERAL] ⏭️  Skipping GATT server (module not available)');
      // WiFi disabled: await this.startWiFiFallback();
      return;
    }
    
    if (this.hasAttemptedStart) {
      console.log('[PERIPHERAL] ⏭️  Already attempted start, skipping retry');
      return;
    }
    
    this.hasAttemptedStart = true;
    
    try {
      console.log('[PERIPHERAL] 🚀 Attempting to start GATT server...');
      
      // Validate Peripheral object before using
      if (!Peripheral || typeof Peripheral.addService !== 'function') {
        throw new Error('Peripheral.addService is not a function');
      }
      
      // Create characteristic with read/write/notify capabilities
      if (!Characteristic) {
        throw new Error('Characteristic class not available');
      }
      
      this.characteristic = new Characteristic({
        uuid: CHARACTERISTIC_UUID,
        properties: ['read', 'write', 'notify'],
        permissions: ['readable', 'writeable'],
        value: '', // Initial empty value
        
        // Handle incoming writes (receive data from peers that connected to us)
        onWriteRequest: async (data: string, offset?: number) => {
          console.log('[PERIPHERAL] 📥 Received write request, length:', data.length);
          if (this.onDataReceived && data) {
            this.onDataReceived(data, 'ble-peripheral');
          }
        },
        
        // Handle read requests (peers reading from us)
        onReadRequest: async (offset?: number) => {
          console.log('[PERIPHERAL] 📤 Received read request');
          return Promise.resolve('');
        },
      });
      
      // Create service with our characteristic
      if (!Service) {
        throw new Error('Service class not available');
      }
      
      const service = new Service({
        uuid: SERVICE_UUID,
        characteristics: [this.characteristic],
      });
      
      // Add service to peripheral (makes it available via GATT)
      await Peripheral.addService(service);
      console.log('[PERIPHERAL] ✅ Service added with UUID:', service.uuid);

      // Start advertising so others can discover us
      const deviceName = `MESH-${this.deviceId.substring(0, 6)}`;
      await Peripheral.startAdvertising({
        name: deviceName,
        serviceUuids: [service.uuid],
      });
      
      this.isAdvertising = true;
      console.log('[PERIPHERAL] ✅ GATT server advertising as:', deviceName);
      console.log('[PERIPHERAL] 📡 Others can now connect to us via BLE!');
      
      // WiFi disabled
      // Also start WiFi+Tor for hybrid connectivity
      // await this.startWiFiFallback();
      
    } catch (error: any) {
      this.startFailed = true;
      const errorMsg = error?.message || String(error);
      
      console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[PERIPHERAL] ⚠️  GATT SERVER START FAILED');
      console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[PERIPHERAL] Error:', errorMsg);
      console.log('[PERIPHERAL] ');
      console.log('[PERIPHERAL] This is expected if:');
      console.log('[PERIPHERAL]   • Using Expo Go (not a dev build)');
      console.log('[PERIPHERAL]   • react-native-peripheral not properly linked');
      console.log('[PERIPHERAL]   • Running on iOS simulator (BLE peripheral not supported)');
      console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // WiFi disabled
      // Try WiFi+Tor fallback
      // await this.startWiFiFallback();
    }
  }
  
  // /**
  //  * Start Tor-secured WiFi mesh as fallback when BLE peripheral fails
  //  */
  // private async startWiFiFallback() {
  //   if (!this.wifiMesh) {
  //     console.log('[PERIPHERAL] ⚠️ WiFi mesh not initialized');
  //     return;
  //   }
    
  //   try {
  //     console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  //     console.log('[PERIPHERAL] 🔄 Starting Tor-secured WiFi mesh...');
  //     console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
  //     // Set data handler to forward WiFi messages
  //     this.wifiMesh.setDataHandler((data: string, from: string) => {
  //       if (this.onDataReceived) {
  //         this.onDataReceived(data, `wifi-${from}`);
  //       }
  //     });
      
  //     await this.wifiMesh.start();
      
  //     if (this.wifiMesh.isActive()) {
  //       this.useWiFiFallback = true;
  //       const isTorActive = this.wifiMesh.isTorActive();
  //       const onionAddress = this.wifiMesh.getOnionAddress();
        
  //       console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  //       console.log('[PERIPHERAL] ✅ SECURE MESH NETWORK ACTIVE');
  //       console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  //       console.log('[PERIPHERAL] Connectivity:');
  //       console.log('[PERIPHERAL]   🔒 AES-256 Encryption: ENABLED');
  //       console.log('[PERIPHERAL]   🧅 Tor Network: ' + (isTorActive ? 'ENABLED ✓' : 'DISABLED'));
        
  //       if (isTorActive && onionAddress) {
  //         console.log('[PERIPHERAL] ');
  //         console.log('[PERIPHERAL] 🧅 Your Onion Address:');
  //         console.log('[PERIPHERAL]   ' + onionAddress);
  //         console.log('[PERIPHERAL] ');
  //         console.log('[PERIPHERAL]   📋 Share this address with peers for anonymous');
  //         console.log('[PERIPHERAL]      encrypted connections!');
  //       }
        
  //       console.log('[PERIPHERAL] ');
  //       console.log('[PERIPHERAL] Your device can now:');
  //       console.log('[PERIPHERAL]   ✅ Accept incoming connections via WiFi/Tor');
  //       console.log('[PERIPHERAL]   ✅ Send encrypted mesh messages');
  //       console.log('[PERIPHERAL]   ✅ Discover local WiFi peers');
  //       if (isTorActive) {
  //         console.log('[PERIPHERAL]   ✅ Connect to onion addresses anonymously');
  //       }
  //       console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  //     } else {
  //       console.log('[PERIPHERAL] ⚠️ WiFi mesh failed to start');
  //       if (!this.startFailed) {
  //         console.log('[PERIPHERAL] ✅ App will continue with BLE-only mode');
  //       } else {
  //         console.log('[PERIPHERAL] ✅ App will continue in Central-only mode');
  //       }
  //     }
      
  //   } catch (error: any) {
  //     console.log('[PERIPHERAL] ❌ WiFi mesh error:', error?.message || error);
  //     if (!this.startFailed) {
  //       console.log('[PERIPHERAL] ✅ App will continue with BLE-only mode');
  //     } else {
  //       console.log('[PERIPHERAL] ✅ App will continue in Central-only mode');
  //     }
  //   }
  // }
  
  // /**
  //  * Add a Tor peer by onion address
  //  */
  // async addTorPeer(onionAddress: string, peerId?: string): Promise<boolean> {
  //   if (!this.wifiMesh) {
  //     console.log('[PERIPHERAL] ⚠️ WiFi mesh not available');
  //     return false;
  //   }
    
  //   return await this.wifiMesh.addTorPeer(onionAddress, peerId);
  // }
  
  // /**
  //  * Test Tor connection
  //  */
  // async testTorConnection(): Promise<boolean> {
  //   if (!this.wifiMesh) {
  //     console.log('[PERIPHERAL] ⚠️ WiFi mesh not available');
  //     return false;
  //   }
    
  //   return await this.wifiMesh.testTorConnection();
  // }
  
  /**
   * Stop advertising and shut down the GATT server
   */
  async stop() {
    // Stop BLE peripheral
    if (this.isAvailable && this.isAdvertising) {
      try {
        if (Peripheral && typeof Peripheral.stopAdvertising === 'function') {
          await Peripheral.stopAdvertising();
          this.isAdvertising = false;
          console.log('[PERIPHERAL] Stopped BLE advertising');
        }
        
        // Clean up service
        this.service = undefined;
        this.characteristic = undefined;
      } catch (error: any) {
        console.log('[PERIPHERAL] Error stopping BLE:', error?.message || error);
      }
    }
    
    // WiFi disabled
    // Stop WiFi mesh (including Tor)
    // if (this.wifiMesh) {
    //   await this.wifiMesh.stop();
    //   this.useWiFiFallback = false;
    //   console.log('[PERIPHERAL] Stopped WiFi+Tor mesh');
    // }
  }
  
  /**
   * Send data to all connected centrals via notifications (BLE only)
   */
  async sendData(data: string) {
    let sent = false;
    
    // Try BLE peripheral first
    if (this.isAvailable && !this.startFailed && this.characteristic) {
      try {
        await this.characteristic.notify(data);
        console.log('[PERIPHERAL] ✅ BLE notified connected devices, length:', data.length);
        sent = true;
      } catch {
        // This may fail if no devices are connected, which is expected
        // Silently continue
      }
    }
    
    // WiFi disabled
    // Try WiFi+Tor mesh
    // if (this.wifiMesh && this.useWiFiFallback) {
    //   const wifiSent = await this.wifiMesh.sendData(data);
    //   if (wifiSent) {
    //     sent = true;
    //   }
    // }
    
    return sent;
  }
  
  /**
   * Set the callback for when data is received via writes
   */
  setDataHandler(handler: (data: string, from: string) => void) {
    this.onDataReceived = handler;
    
    // WiFi disabled
    // Also set for WiFi mesh if active
    // if (this.wifiMesh) {
    //   this.wifiMesh.setDataHandler((data: string, from: string) => {
    //     handler(data, `wifi-${from}`);
    //   });
    // }
    
    // WiFi disabled: if ((this.isAvailable && !this.startFailed) || this.useWiFiFallback) {
    if ((this.isAvailable && !this.startFailed)) {
      console.log('[PERIPHERAL] Data handler registered');
    }
  }
  
  /**
   * Get current advertising state
   */
  isRunning(): boolean {
    const bleRunning = this.isAvailable && this.isAdvertising && !this.startFailed;
    // WiFi disabled: const wifiRunning = this.wifiMesh?.isActive() || false;
    // WiFi disabled: return bleRunning || wifiRunning;
    return bleRunning;
  }
  
  /**
   * Check if peripheral module is available
   */
  isModuleAvailable(): boolean {
    // WiFi disabled: return (this.isAvailable && !this.startFailed) || this.useWiFiFallback;
    return (this.isAvailable && !this.startFailed);
  }
  
  /**
   * Get Tor status (WiFi disabled)
   */
  async getTorStatus(): Promise<any> {
    // WiFi disabled
    // if (!this.wifiMesh) {
      return { enabled: false, error: 'WiFi integration disabled' };
    // }
    
    // return await this.wifiMesh.getTorStatus();
  }
  
  /**
   * Get onion address if available (WiFi disabled)
   */
  getOnionAddress(): string | undefined {
    // WiFi disabled: return this.wifiMesh?.getOnionAddress();
    return undefined;
  }
  
  /**
   * Check if Tor is active (WiFi disabled)
   */
  isTorActive(): boolean {
    // WiFi disabled: return this.wifiMesh?.isTorActive() || false;
    return false;
  }
  
  /**
   * Get a human-readable status message
   */
  getStatusMessage(): string {
    const parts: string[] = [];
    
    // BLE status
    if (this.isAdvertising) {
      parts.push(`BLE: MESH-${this.deviceId.substring(0, 6)}`);
    } else if (this.startFailed) {
      parts.push('BLE: unavailable');
    }
    
    // WiFi disabled
    // WiFi+Tor status
    // if (this.useWiFiFallback && this.wifiMesh) {
    //   const isTorActive = this.wifiMesh.isTorActive();
    //   const peerCount = this.wifiMesh.getPeerCount();
    //   const torPeerCount = this.wifiMesh.getTorPeerCount();
    //   
    //   if (isTorActive) {
    //     parts.push(`Tor: ${torPeerCount} peer(s)`);
    //   }
    //   parts.push(`WiFi: ${peerCount - torPeerCount} peer(s)`);
    // }
    
    return parts.length > 0 ? parts.join(' • ') : 'Central-only mode';
  }
  
  /**
   * Get connection type(s)
   */
  getConnectionTypes(): string[] {
    const types: string[] = [];
    
    if (this.isAdvertising) {
      types.push('ble');
    }
    
    // WiFi disabled
    // if (this.useWiFiFallback && this.wifiMesh?.isActive()) {
    //   if (this.wifiMesh.isTorActive()) {
    //     types.push('tor');
    //   }
    //   types.push('wifi');
    // }
    
    return types;
  }
  
  /**
   * Get number of connected/discovered peers across all transports
   */
  getPeerCount(): number {
    let count = 0;
    
    // BLE doesn't easily expose connected central count
    // WiFi disabled
    // So we only count WiFi peers
    
    // if (this.wifiMesh && this.useWiFiFallback) {
    //   count += this.wifiMesh.getPeerCount();
    // }
    
    return count;
  }
  
  /**
   * Get detailed peer information
   */
  getPeerInfo(): any {
    const info: any = {
      ble: {
        advertising: this.isAdvertising,
        available: this.isAvailable && !this.startFailed,
      },
      // WiFi disabled
      // wifi: {
      //   active: this.useWiFiFallback,
      //   peers: [],
      // },
      // tor: {
      //   active: false,
      //   onionAddress: undefined,
      //   peers: 0,
      // },
    };
    
    // WiFi disabled
    // if (this.wifiMesh && this.useWiFiFallback) {
    //   info.wifi.peers = this.wifiMesh.getPeers();
    //   info.tor.active = this.wifiMesh.isTorActive();
    //   info.tor.onionAddress = this.wifiMesh.getOnionAddress();
    //   info.tor.peers = this.wifiMesh.getTorPeerCount();
    // }
    
    return info;
  }
}
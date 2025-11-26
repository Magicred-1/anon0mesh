import { useCallback, useState } from 'react';
import { useBLE } from '../contexts/BLEContext';
import { Packet, PacketType } from '../domain/entities/Packet';
import { PeerId } from '../domain/value-objects/PeerId';

export interface BLESendOptions {
  type?: PacketType;
  recipientId?: PeerId;
  ttl?: number;
  broadcast?: boolean;
}

export interface BLESendResult {
  success: boolean;
  deviceId?: string;
  bytesTransferred?: number;
  error?: string;
}

export interface UseBLESendReturn {
  sendPayload: (payload: Uint8Array, options?: BLESendOptions) => Promise<BLESendResult[]>;
  sendToDevice: (deviceId: string, payload: Uint8Array, options?: BLESendOptions) => Promise<BLESendResult>;
  isSending: boolean;
  lastError: string | null;
  lastSuccess: boolean | null;
}

/**
 * Custom hook for sending payloads over Bluetooth Low Energy
 * 
 * @example
 * ```tsx
 * const { sendPayload, sendToDevice, isSending } = useBLESend();
 * 
 * // Send to specific device (Central writes to Peripheral OR Peripheral notifies Central)
 * await sendToDevice('device-123', new Uint8Array([1, 2, 3]), { 
 *   type: PacketType.MESSAGE 
 * });
 * 
 * // Broadcast to all connected devices
 * await sendPayload(new Uint8Array([1, 2, 3]), { 
 *   broadcast: true,
 *   type: PacketType.ANNOUNCE 
 * });
 * ```
 */
export function useBLESend(): UseBLESendReturn {
  const { bleAdapter, connectedDeviceIds } = useBLE();
  const [isSending, setIsSending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<boolean | null>(null);

  /**
   * Send payload to a specific device
   * 
   * @param deviceId - Target device ID
   * @param payload - Binary data to send
   * @param options - Packet configuration options
   */
  const sendToDevice = useCallback(
    async (
      deviceId: string,
      payload: Uint8Array,
      options?: BLESendOptions
    ): Promise<BLESendResult> => {
      if (!bleAdapter) {
        const error = 'BLE adapter not initialized';
        setLastError(error);
        setLastSuccess(false);
        return { success: false, error };
      }

      if (payload.length === 0) {
        const error = 'Payload cannot be empty';
        setLastError(error);
        setLastSuccess(false);
        return { success: false, error };
      }

      setIsSending(true);
      setLastError(null);
      setLastSuccess(null);

      try {
        // Create packet entity
        const packet = new Packet({
          type: options?.type ?? PacketType.MESSAGE,
          senderId: options?.recipientId ?? PeerId.fromString('local'),
          recipientId: options?.recipientId,
          timestamp: BigInt(Date.now()),
          payload,
          ttl: options?.ttl ?? 5,
        });

        // Determine if we're sending from Central (write) or Peripheral (notify)
        const isConnectedAsCentral = await bleAdapter.isConnected(deviceId);
        const incomingConnections = await bleAdapter.getIncomingConnections();
        const isConnectedAsPeripheral = bleAdapter.isAdvertising() && 
                                       incomingConnections.some(conn => conn.deviceId === deviceId);

        let result;

        if (isConnectedAsCentral) {
          // We connected to this device (Central mode) - write to TX characteristic
          console.log(`[useBLESend] Sending as Central to ${deviceId}`);
          result = await bleAdapter.writePacket(deviceId, packet);
        } else if (isConnectedAsPeripheral) {
          // Device connected to us (Peripheral mode) - notify via RX characteristic
          console.log(`[useBLESend] Sending as Peripheral to ${deviceId}`);
          result = await bleAdapter.notifyPacket(deviceId, packet);
        } else {
          const error = `Device ${deviceId} not connected`;
          setLastError(error);
          setLastSuccess(false);
          return { success: false, error };
        }

        setLastSuccess(result.success);
        if (!result.success) {
          setLastError(result.error ?? 'Unknown error');
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[useBLESend] Error sending to device:', error);
        setLastError(errorMessage);
        setLastSuccess(false);
        return {
          success: false,
          deviceId,
          error: errorMessage,
        };
      } finally {
        setIsSending(false);
      }
    },
    [bleAdapter]
  );

  /**
   * Send payload to all connected devices or a specific device
   * 
   * @param payload - Binary data to send
   * @param options - Packet configuration options (use broadcast: true for all devices)
   */
  const sendPayload = useCallback(
    async (
      payload: Uint8Array,
      options?: BLESendOptions
    ): Promise<BLESendResult[]> => {
      if (!bleAdapter) {
        const error = 'BLE adapter not initialized';
        setLastError(error);
        setLastSuccess(false);
        return [{ success: false, error }];
      }

      if (payload.length === 0) {
        const error = 'Payload cannot be empty';
        setLastError(error);
        setLastSuccess(false);
        return [{ success: false, error }];
      }

      setIsSending(true);
      setLastError(null);
      setLastSuccess(null);

      try {
        // Create packet entity
        const packet = new Packet({
          type: options?.type ?? PacketType.MESSAGE,
          senderId: options?.recipientId ?? PeerId.fromString('local'),
          recipientId: options?.recipientId,
          timestamp: BigInt(Date.now()),
          payload,
          ttl: options?.ttl ?? 5,
        });

        let results: BLESendResult[];

        if (options?.broadcast) {
          // Broadcast to all connected devices
          console.log('[useBLESend] Broadcasting to all connections');
          results = await bleAdapter.broadcastPacket(packet);
        } else {
          // Send to all currently connected devices
          console.log(`[useBLESend] Sending to ${connectedDeviceIds.length} connected devices`);
          results = await Promise.all(
            connectedDeviceIds.map(deviceId => sendToDevice(deviceId, payload, options))
          );
        }

        const allSuccessful = results.every(r => r.success);
        setLastSuccess(allSuccessful);

        if (!allSuccessful) {
          const errors = results
            .filter(r => !r.success)
            .map(r => r.error)
            .join(', ');
          setLastError(errors);
        }

        return results;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[useBLESend] Error sending payload:', error);
        setLastError(errorMessage);
        setLastSuccess(false);
        return [
          {
            success: false,
            error: errorMessage,
          },
        ];
      } finally {
        setIsSending(false);
      }
    },
    [bleAdapter, connectedDeviceIds, sendToDevice]
  );

  return {
    sendPayload,
    sendToDevice,
    isSending,
    lastError,
    lastSuccess,
  };
}

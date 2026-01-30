/**
 * useNoiseChat Hook
 *
 * This hook is now a wrapper around NoiseContextEnhanced to provide backward compatibility
 * while ensuring sessions and messages persist across the entire app lifetime.
 * 
 * ENHANCED: Now uses NoiseContextEnhanced for automatic BLE session creation
 * and bidirectional connection establishment.
 */

import { useNoiseChat as useNoiseContext } from "../contexts/NoiseContextEnhanced";

// Re-export types that were previously in this file
export type { NoiseMessage } from "../contexts/NoiseContextEnhanced";

export function useNoiseChat() {
  return useNoiseContext();
}

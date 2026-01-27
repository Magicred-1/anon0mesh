/**
 * useNoiseChat Hook
 *
 * This hook is now a wrapper around NoiseContext to provide backward compatibility
 * while ensuring sessions and messages persist across the entire app lifetime.
 */

import { useNoiseChat as useNoiseContext } from "../contexts/NoiseContext";

// Re-export types that were previously in this file
export type { NoiseMessage } from "../contexts/NoiseContext";

export function useNoiseChat() {
  return useNoiseContext();
}

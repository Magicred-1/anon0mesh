/**
 * Transaction Auto-Submit Preferences
 * 
 * Manages user preferences for automatically submitting BLE-received transactions
 * Uses SecureStore for persistence
 */

import * as SecureStore from "expo-secure-store";

const AUTO_SUBMIT_KEY = "tx_auto_submit_enabled";

/**
 * Get the current auto-submit preference
 * @returns true if auto-submit is enabled, false otherwise
 */
export async function getAutoSubmitPreference(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(AUTO_SUBMIT_KEY);
    return value === "true";
  } catch (error) {
    console.error("[AutoSubmit] Failed to get preference:", error);
    return false; // Default to disabled for safety
  }
}

/**
 * Set the auto-submit preference
 * @param enabled - Whether to enable auto-submit
 */
export async function setAutoSubmitPreference(enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTO_SUBMIT_KEY, enabled ? "true" : "false");
    console.log(`[AutoSubmit] Preference updated: ${enabled ? "ENABLED" : "DISABLED"}`);
  } catch (error) {
    console.error("[AutoSubmit] Failed to set preference:", error);
    throw error;
  }
}

/**
 * Toggle the auto-submit preference
 * @returns The new state after toggling
 */
export async function toggleAutoSubmitPreference(): Promise<boolean> {
  const current = await getAutoSubmitPreference();
  const newValue = !current;
  await setAutoSubmitPreference(newValue);
  return newValue;
}

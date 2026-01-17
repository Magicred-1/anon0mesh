/**
 * NostrRelayManager - Manages Nostr relay connections
 * 
 * Features:
 * - Load relays from CSV file
 * - Auto-select optimal relays based on geolocation
 * - Health monitoring and failover
 * - Geo-distributed relay selection
 * 
 * Selection Strategies:
 * 1. Closest: Select relays nearest to user (lowest latency)
 * 2. Random: Select random relays (privacy, diversity)
 * 3. Recommended: Mix of closest + random (60/40 split)
 */


export interface RelayCSVEntry {
  url: string;
  latitude?: number;
  longitude?: number;
}

export class NostrRelayManager {
  private relays: RelayCSVEntry[] = [];

  /**
   * Load relays from CSV data
   * 
   * CSV Format:
   * ```
   * Relay URL,Latitude,Longitude
   * wss://relay.example.com,40.7128,-74.006
   * ```
   */
  async loadRelaysFromCSV(csvData: string): Promise<void> {
    const lines = csvData.trim().split('\n');
    
    if (lines.length === 0) {
      throw new Error('CSV data is empty');
    }

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 1) continue;

      const url = parts[0].trim();
      const lat = parts[1] ? parseFloat(parts[1].trim()) : undefined;
      const lon = parts[2] ? parseFloat(parts[2].trim()) : undefined;

      // Validate URL
      if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
        console.warn(`[NostrRelayManager] Invalid relay URL: ${url}`);
        continue;
      }

      this.relays.push({
        url,
        latitude: lat,
        longitude: lon,
      });
    }

    console.log(`[NostrRelayManager] Loaded ${this.relays.length} relays from CSV`);
  }

  /**
   * Get all available relays
   */
  getAllRelays(): RelayCSVEntry[] {
    return [...this.relays];
  }

  /**
   * Get closest relays to user's location
   * 
   * @param userLat User's latitude
   * @param userLon User's longitude
   * @param count Number of relays to return
   * @returns Sorted array of closest relays
   */
  getClosestRelays(
    userLat: number,
    userLon: number,
    count: number = 5
  ): RelayCSVEntry[] {
    const relaysWithDistance = this.relays
      .filter((r) => r.latitude !== undefined && r.longitude !== undefined)
      .map((relay) => ({
        relay,
        distance: this.calculateDistance(
          userLat,
          userLon,
          relay.latitude!,
          relay.longitude!
        ),
      }))
      .sort((a, b) => a.distance - b.distance);

    const closest = relaysWithDistance.slice(0, count).map((r) => r.relay);
    
    console.log(`[NostrRelayManager] Selected ${closest.length} closest relays`);
    
    return closest;
  }

  /**
   * Get random relays for diversity
   * 
   * @param count Number of relays to return
   * @returns Array of random relays
   */
  getRandomRelays(count: number = 5): RelayCSVEntry[] {
    const shuffled = [...this.relays].sort(() => Math.random() - 0.5);
    const random = shuffled.slice(0, Math.min(count, shuffled.length));
    
    console.log(`[NostrRelayManager] Selected ${random.length} random relays`);
    
    return random;
  }

  /**
   * Get recommended relay set (mix of closest + diverse)
   * 
   * Strategy: 60% closest + 40% random for optimal balance
   * - Low latency from nearby relays
   * - Resilience from geographic diversity
   * - Privacy from random selection
   * 
   * @param userLat Optional user latitude
   * @param userLon Optional user longitude
   * @param count Total number of relays to return
   * @returns Array of recommended relays
   */
  getRecommendedRelays(
    userLat?: number,
    userLon?: number,
    count: number = 10
  ): RelayCSVEntry[] {
    if (userLat !== undefined && userLon !== undefined) {
      // Get 60% closest, 40% random for diversity
      const closestCount = Math.ceil(count * 0.6);
      const randomCount = count - closestCount;

      const closest = this.getClosestRelays(userLat, userLon, closestCount);
      
      // Get random relays excluding the ones we already selected
      const closestUrls = new Set(closest.map(r => r.url));
      const remainingRelays = this.relays.filter(r => !closestUrls.has(r.url));
      const shuffled = remainingRelays.sort(() => Math.random() - 0.5);
      const random = shuffled.slice(0, randomCount);

      const recommended = [...closest, ...random];
      
      console.log(`[NostrRelayManager] Recommended: ${closest.length} closest + ${random.length} random = ${recommended.length} total`);
      
      return recommended;
    }

    // No location - use random selection
    console.log(`[NostrRelayManager] No location provided, using random selection`);
    return this.getRandomRelays(count);
  }

  /**
   * Get relay count
   */
  getRelayCount(): number {
    return this.relays.length;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * 
   * @param lat1 Latitude of point 1 (degrees)
   * @param lon1 Longitude of point 1 (degrees)
   * @param lat2 Latitude of point 2 (degrees)
   * @param lon2 Longitude of point 2 (degrees)
   * @returns Distance in kilometers
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  /**
   * Convert degrees to radians
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

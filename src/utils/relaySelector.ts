/**
 * Nostr Relay Selector - Geographic-based relay selection
 * 
 * Selects optimal Nostr relays based on zone range and user location
 */

export interface NostrRelay {
  url: string;
  latitude: number;
  longitude: number;
  distance?: number; // Distance from user in km
}

export type ZoneRange = {
  maxDistance: number; // in kilometers
  minRelays: number;   // minimum number of relays to select
  maxRelays: number;   // maximum number of relays to select
};

export const ZONE_RANGES: Record<string, ZoneRange> = {
  local: { maxDistance: 0.1, minRelays: 1, maxRelays: 2 }, // 100m
  neighborhood: { maxDistance: 10, minRelays: 2, maxRelays: 4 }, // 10km
  city: { maxDistance: 100, minRelays: 3, maxRelays: 6 }, // 100km
  regional: { maxDistance: 1000, minRelays: 4, maxRelays: 8 }, // 1000km
  national: { maxDistance: 5000, minRelays: 5, maxRelays: 10 }, // 5000km
  global: { maxDistance: Infinity, minRelays: 6, maxRelays: 12 }, // Global
};

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Parse CSV relay data
 */
export function parseRelayCSV(csvContent: string): NostrRelay[] {
  const lines = csvContent.trim().split('\n');
  const relays: NostrRelay[] = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const [url, lat, lon] = line.split(',');
    if (url && lat && lon) {
      relays.push({
        url: url.trim().startsWith('wss://') ? url.trim() : `wss://${url.trim()}`,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
      });
    }
  }
  
  return relays;
}

/**
 * Select relays based on zone and user location
 * @param allRelays All available relays
 * @param userLat User's latitude
 * @param userLon User's longitude
 * @param zoneType Zone type (local, neighborhood, city, etc.)
 * @returns Selected relay URLs
 */
export function selectRelaysForZone(
  allRelays: NostrRelay[],
  userLat: number,
  userLon: number,
  zoneType: string
): string[] {
  const range = ZONE_RANGES[zoneType] || ZONE_RANGES.global;
  
  // Calculate distances and sort by proximity
  const relaysWithDistance = allRelays.map(relay => ({
    ...relay,
    distance: calculateDistance(userLat, userLon, relay.latitude, relay.longitude),
  }));
  
  // Filter by distance
  const relaysInRange = relaysWithDistance
    .filter(relay => relay.distance! <= range.maxDistance)
    .sort((a, b) => a.distance! - b.distance!);
  
  // If not enough relays in range, use the closest ones
  let selectedRelays = relaysInRange.slice(0, range.maxRelays);
  
  if (selectedRelays.length < range.minRelays) {
    // Not enough relays in range, add closest ones
    const allSorted = relaysWithDistance.sort((a, b) => a.distance! - b.distance!);
    selectedRelays = allSorted.slice(0, range.minRelays);
  }
  
  // Return relay URLs
  return selectedRelays.map(relay => relay.url);
}

/**
 * Get default relays (fallback when location is unavailable)
 * Prioritizes most reliable open relays
 */
export function getDefaultRelays(limit: number = 6): string[] {
  return [
    'wss://relay.primal.net',        // Very reliable, popular
    'wss://relay.nostr.bg',          // Bulgarian relay, stable
    'wss://nostr.mom',               // Open relay, good uptime
    'wss://nostr-pub.wellorder.net', // Well-maintained
    'wss://relay.current.fyi',       // Current app relay
    'wss://nostr.fmt.wiz.biz',       // Japanese relay, stable
    'wss://relay.nostr.info',        // German relay, reliable
    'wss://nostr-relay.wlvs.space',  // UK relay
    'wss://nostr.zebedee.cloud',     // Zebedee wallet relay
    'wss://relay.orangepill.dev',    // Development-friendly
  ].slice(0, limit);
}

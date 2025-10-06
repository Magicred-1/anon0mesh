// Channel types and interfaces for the mesh chat system
export type ZoneRange = 'local' | 'neighborhood' | 'city' | 'regional' | 'national' | 'global';

export interface Channel {
  id: string;
  name: string;
  type: 'public' | 'private' | 'group' | 'zone';
  description?: string;
  memberCount?: number;
  isActive: boolean;
  lastActivity?: number;
  icon?: string;
  // Zone-specific properties for self-healing mesh network
  zoneRange?: ZoneRange;
  maxDistanceKm?: number;
  minDistanceKm?: number;
  ttl?: number; // Time-to-live for messages in this zone (hops)
  priority?: number; // Priority for self-healing routing (higher = more priority)
  colorCode?: string; // Visual identifier for zone
}

// Distance-based zone channels for BLE mesh network
// Self-healing network with automatic routing based on distance
export const DEFAULT_CHANNELS: Channel[] = [
  // Ultra-Local Zone - Direct BLE range (0-500m)
  {
    id: 'zone-local',
    name: 'Local (500m)',
    type: 'zone',
    description: 'Direct BLE connection - Ultra-local mesh zone',
    isActive: true,
    icon: '📱',
    zoneRange: 'local',
    maxDistanceKm: 0.5,
    minDistanceKm: 0,
    ttl: 2, // Direct connection, minimal hops
    priority: 10,
    colorCode: '#10b981', // Green
  },
  // Neighborhood Zone - Multi-hop local (0.5-10km)
  {
    id: 'zone-neighborhood',
    name: 'Neighborhood (10km)',
    type: 'zone',
    description: 'Multi-hop local mesh - Neighborhood coverage',
    isActive: true,
    icon: '🏘️',
    zoneRange: 'neighborhood',
    maxDistanceKm: 10,
    minDistanceKm: 0.5,
    ttl: 8, // More hops for neighborhood coverage
    priority: 8,
    colorCode: '#3b82f6', // Blue
  },
  // City Zone - Urban mesh (10-100km)
  {
    id: 'zone-city',
    name: 'City (100km)',
    type: 'zone',
    description: 'City-wide mesh network with self-healing',
    isActive: true,
    icon: '🏙️',
    zoneRange: 'city',
    maxDistanceKm: 100,
    minDistanceKm: 10,
    ttl: 15, // Extended hops for city coverage
    priority: 6,
    colorCode: '#8b5cf6', // Purple
  },
  // Regional Zone - Large area (100-1000km)
  {
    id: 'zone-regional',
    name: 'Regional (1000km)',
    type: 'zone',
    description: 'Regional mesh network with intelligent routing',
    isActive: true,
    icon: '🗺️',
    zoneRange: 'regional',
    maxDistanceKm: 1000,
    minDistanceKm: 100,
    ttl: 25, // High hop count for regional coverage
    priority: 4,
    colorCode: '#f59e0b', // Orange
  },
  // National Zone - Country-level (1000-5000km)
  {
    id: 'zone-national',
    name: 'National (5000km)',
    type: 'zone',
    description: 'National mesh network - Self-healing long-range',
    isActive: true,
    icon: '🌐',
    zoneRange: 'national',
    maxDistanceKm: 5000,
    minDistanceKm: 1000,
    ttl: 40, // Very high hop count for national coverage
    priority: 2,
    colorCode: '#ef4444', // Red
  },
  // Global Zone - Worldwide mesh (5000km+)
  {
    id: 'zone-global',
    name: 'Global (∞)',
    type: 'zone',
    description: 'Global mesh network - Worldwide self-healing network',
    isActive: true,
    icon: '🌎',
    zoneRange: 'global',
    maxDistanceKm: Infinity,
    minDistanceKm: 5000,
    ttl: 50, // Maximum hop count for global reach
    priority: 1,
    colorCode: '#6366f1', // Indigo
  },
];

export interface ChannelContextType {
  channels: Channel[];
  currentChannel: Channel | null;
  setCurrentChannel: (channel: Channel) => void;
  addChannel: (channel: Omit<Channel, 'id'>) => void;
  removeChannel: (channelId: string) => void;
  updateChannel: (channelId: string, updates: Partial<Channel>) => void;
}

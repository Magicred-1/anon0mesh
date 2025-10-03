// Channel types and interfaces for the mesh chat system
export interface Channel {
  id: string;
  name: string;
  type: 'public' | 'private' | 'group';
  description?: string;
  memberCount?: number;
  isActive: boolean;
  lastActivity?: number;
  icon?: string;
}

export const DEFAULT_CHANNELS: Channel[] = [
  {
    id: 'general',
    name: 'General',
    type: 'public',
    description: 'General discussion for all mesh users',
    isActive: true,
    icon: '💬',
  },
  {
    id: 'announcements',
    name: 'Announcements',
    type: 'public',
    description: 'Important updates and announcements',
    isActive: true,
    icon: '📢',
  },
  {
    id: 'tech-talk',
    name: 'Tech Talk',
    type: 'public',
    description: 'Technical discussions about mesh networking',
    isActive: true,
    icon: '⚡',
  },
  {
    id: 'random',
    name: 'Random',
    type: 'public',
    description: 'Off-topic conversations',
    isActive: true,
    icon: '🎲',
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
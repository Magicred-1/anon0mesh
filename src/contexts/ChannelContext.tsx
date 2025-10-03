import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Channel, DEFAULT_CHANNELS, ChannelContextType } from '../types/channels';

const ChannelContext = createContext<ChannelContextType | undefined>(undefined);

interface ChannelProviderProps {
  children: ReactNode;
}

export const ChannelProvider: React.FC<ChannelProviderProps> = ({ children }) => {
  const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(DEFAULT_CHANNELS[0]);

  const addChannel = (channelData: Omit<Channel, 'id'>) => {
    const newChannel: Channel = {
      ...channelData,
      id: `channel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    setChannels(prev => [...prev, newChannel]);
  };

  const removeChannel = (channelId: string) => {
    setChannels(prev => prev.filter(channel => channel.id !== channelId));
    // If current channel is removed, switch to General
    if (currentChannel?.id === channelId) {
      setCurrentChannel(channels.find(c => c.id === 'general') || null);
    }
  };

  const updateChannel = (channelId: string, updates: Partial<Channel>) => {
    setChannels(prev => 
      prev.map(channel => 
        channel.id === channelId 
          ? { ...channel, ...updates }
          : channel
      )
    );
    
    // Update current channel if it's the one being updated
    if (currentChannel?.id === channelId) {
      setCurrentChannel(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const value: ChannelContextType = {
    channels,
    currentChannel,
    setCurrentChannel,
    addChannel,
    removeChannel,
    updateChannel,
  };

  return (
    <ChannelContext.Provider value={value}>
      {children}
    </ChannelContext.Provider>
  );
};

export const useChannels = (): ChannelContextType => {
  const context = useContext(ChannelContext);
  if (context === undefined) {
    throw new Error('useChannels must be used within a ChannelProvider');
  }
  return context;
};
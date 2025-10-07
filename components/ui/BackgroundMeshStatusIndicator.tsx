import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

// Optional import - may not be available in Expo Go
let BackgroundFetch: any = null;
try {
    // eslint-disable-next-line
    BackgroundFetch = require('expo-background-fetch');
} catch {
    console.log('[BG-STATUS] BackgroundFetch not available (Expo Go)');
}

interface BackgroundMeshStatusProps {
    getBackgroundStatus?: () => Promise<any>;
    style?: any;
}

export interface BackgroundMeshStatus {
    isActive: boolean;
    relayEnabled: boolean;
    gossipEnabled: boolean;
    backgroundFetchStatus: any; // Can't use BackgroundFetch.BackgroundFetchStatus if module not loaded
}

const BackgroundMeshStatusIndicator: React.FC<BackgroundMeshStatusProps> = ({
    getBackgroundStatus,
    style,
}) => {
    const [status, setStatus] = useState<BackgroundMeshStatus | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    
    const updateStatus = React.useCallback(async () => {
        if (!getBackgroundStatus) return;
        
        try {
        const bgStatus = await getBackgroundStatus();
        setStatus(bgStatus);
        setLastUpdate(new Date());
        } catch (error) {
        console.error('[BG-STATUS] Failed to get background status:', error);
        }
    }, [getBackgroundStatus]);

    useEffect(() => {
        updateStatus();
        
        // Update status every 30 seconds
        const interval = setInterval(updateStatus, 30000);
        
        return () => clearInterval(interval);
    }, [updateStatus]);

    const getStatusColor = (status: BackgroundMeshStatus | null): string => {
        if (!status) return '#666';
        
        if (status.isActive && status.relayEnabled && status.gossipEnabled) {
        return '#10B981'; // Green - fully active
        } else if (status.isActive) {
        return '#F59E0B'; // Yellow - partially active
        } else {
        return '#EF4444'; // Red - inactive
        }
    };

    const getStatusText = (status: BackgroundMeshStatus | null): string => {
        if (!status) return 'Unknown';
        
        if (status.isActive && status.relayEnabled && status.gossipEnabled) {
            return 'Active';
        } else if (status.isActive) {
            return 'Partial';
        } else if (!BackgroundFetch || (BackgroundFetch && status.backgroundFetchStatus === BackgroundFetch.BackgroundFetchStatus?.Denied)) {
            return 'Expo Go';
        } else {
            return 'Inactive';
        }
    };

    const getBackgroundFetchStatusText = (bgStatus: any): string => {
        if (!BackgroundFetch) return 'Not Available';
        
        switch (bgStatus) {
            case BackgroundFetch.BackgroundFetchStatus?.Available:
                return 'Available';
            case BackgroundFetch.BackgroundFetchStatus?.Denied:
                return 'Denied';
            case BackgroundFetch.BackgroundFetchStatus?.Restricted:
                return 'Restricted';
            default:
                return 'Unknown';
        }
    };

    const statusColor = getStatusColor(status);
    const statusText = getStatusText(status);

    return (
        <View style={[{
        backgroundColor: '#2a2a2a',
        borderRadius: 8,
        padding: 12,
        marginVertical: 8,
        }, style]}>
        <TouchableOpacity
            onPress={() => setIsExpanded(!isExpanded)}
            style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: statusColor,
                marginRight: 8,
            }} />
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '500' }}>
                Background Mesh
            </Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: statusColor, fontSize: 12, marginRight: 8 }}>
                {statusText}
            </Text>
            <Text style={{ color: '#888', fontSize: 12 }}>
                {isExpanded ? '▼' : '▶'}
            </Text>
            </View>
        </TouchableOpacity>

        {isExpanded && status && (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#444' }}>
            {/* Show Expo Go warning if background fetch is not available */}
            {(!BackgroundFetch || (BackgroundFetch && status.backgroundFetchStatus !== BackgroundFetch.BackgroundFetchStatus?.Available)) && (
                <View style={{ 
                backgroundColor: '#FFA50022', 
                padding: 10, 
                borderRadius: 6, 
                marginBottom: 12,
                borderWidth: 1,
                borderColor: '#FFA500'
                }}>
                <Text style={{ color: '#FFA500', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>
                    ⚠️ Background Tasks Not Available
                </Text>
                <Text style={{ color: '#CCC', fontSize: 10, lineHeight: 14 }}>
                    Expo Go doesn&apos;t support background tasks. The app works normally, but background relay is disabled.
                </Text>
                <Text style={{ color: '#CCC', fontSize: 10, lineHeight: 14, marginTop: 4 }}>
                    To enable: Build a custom development build with:
                </Text>
                <Text style={{ color: '#AAA', fontSize: 9, fontFamily: 'monospace', marginTop: 4 }}>
                    expo run:android{'\n'}or{'\n'}expo run:ios
                </Text>
                </View>
            )}

            <View style={{ marginBottom: 8 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>
                Status Details
                </Text>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ color: '#AAA', fontSize: 11 }}>Active:</Text>
                <Text style={{ color: status.isActive ? '#10B981' : '#EF4444', fontSize: 11 }}>
                    {status.isActive ? 'Yes' : 'No'}
                </Text>
                </View>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ color: '#AAA', fontSize: 11 }}>Relay:</Text>
                <Text style={{ color: status.relayEnabled ? '#10B981' : '#EF4444', fontSize: 11 }}>
                    {status.relayEnabled ? 'Enabled' : 'Disabled'}
                </Text>
                </View>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ color: '#AAA', fontSize: 11 }}>Gossip:</Text>
                <Text style={{ color: status.gossipEnabled ? '#10B981' : '#EF4444', fontSize: 11 }}>
                    {status.gossipEnabled ? 'Enabled' : 'Disabled'}
                </Text>
                </View>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ color: '#AAA', fontSize: 11 }}>Background Fetch:</Text>
                <Text style={{ 
                    color: (!BackgroundFetch || (BackgroundFetch && status.backgroundFetchStatus !== BackgroundFetch.BackgroundFetchStatus?.Available))
                    ? '#EF4444' : '#10B981', 
                    fontSize: 11 
                }}>
                    {getBackgroundFetchStatusText(status.backgroundFetchStatus)}
                </Text>
                </View>
            </View>

            {lastUpdate && (
                <Text style={{ color: '#666', fontSize: 10, textAlign: 'center' }}>
                Last updated: {lastUpdate.toLocaleTimeString()}
                </Text>
            )}

            <TouchableOpacity
                onPress={updateStatus}
                style={{
                marginTop: 8,
                paddingVertical: 6,
                paddingHorizontal: 12,
                backgroundColor: '#3a3a3a',
                borderRadius: 4,
                alignSelf: 'center',
                }}
            >
                <Text style={{ color: '#FFFFFF', fontSize: 11 }}>Refresh</Text>
            </TouchableOpacity>
            </View>
        )}
        </View>
    );
};

export default BackgroundMeshStatusIndicator;
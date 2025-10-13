import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

// Direct import - available in dev builds
// Rely on BackgroundMeshManager for status; avoid importing deprecated expo-background-fetch here.

interface BackgroundMeshStatusProps {
    getBackgroundStatus?: () => Promise<any>;
    style?: any;
}

export interface BackgroundMeshStatus {
    isActive: boolean;
    relayEnabled: boolean;
    gossipEnabled: boolean;
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

    const getStatusText = (status: BackgroundMeshStatus | null) => {
        if (!status) return 'Unknown';
        
        // if (status.isActive && status.relayEnabled && status.gossipEnabled) {
        //     return 'Active';
        // } else if (status.isActive) {
        //     return 'Partial';
        // } else if (!BackgroundFetch || (BackgroundFetch && status.backgroundFetchStatus === BackgroundFetch.BackgroundFetchStatus?.Denied)) {
        //     return 'Expo Go';
        // } else {
        //     return 'Inactive';
        // }
    };

    // Local mapping for background fetch status codes. The BackgroundMeshManager
    // returns numeric codes; treat 1=Available, 2=Denied, 3=Restricted for UI.
    enum BGStatus {
        Unknown = 0,
        Available = 1,
        Denied = 2,
        Restricted = 3,
    }

    const getBackgroundFetchStatusText = (bgStatus: any): string => {
        switch (bgStatus) {
            case BGStatus.Available:
                return '✔️';
            case BGStatus.Denied:
                return '❌';
            case BGStatus.Restricted:
                return '⚠️';
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
                Mesh Status
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
            {/* Show warning if background fetch is not available */}

            <View style={{ marginBottom: 8 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>
                Status Details
                </Text>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ color: '#AAA', fontSize: 11 }}>Active:</Text>
                <Text style={{ color: status.isActive ? '#10B981' : '#EF4444', fontSize: 11 }}>
                    {status.isActive ? '✔️' : '❌'}
                </Text>
                </View>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ color: '#AAA', fontSize: 11 }}>Relay:</Text>
                <Text style={{ color: status.relayEnabled ? '#10B981' : '#EF4444', fontSize: 11 }}>
                    {status.relayEnabled ? '✔️' : '❌'}
                </Text>
                </View>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ color: '#AAA', fontSize: 11 }}>Gossip:</Text>
                <Text style={{ color: status.gossipEnabled ? '#10B981' : '#EF4444', fontSize: 11 }}>
                    {status.gossipEnabled ? '✔️' : '❌'}
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
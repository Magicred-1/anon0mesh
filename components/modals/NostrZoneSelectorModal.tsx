import React, { Component } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    PanResponder,
    PanResponderInstance,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';

type NostrZoneType = 'local' | 'neighborhood' | 'city' | 'internet';

interface NostrZone {
    id: NostrZoneType;
    label: string;
    range: string;
    icon: string;
    disabled?: boolean;
}

type Props = {
    visible: boolean;
    onClose: () => void;
    onSelectZone: (zone: NostrZoneType) => void;
    selectedZone?: NostrZoneType;
};

interface NostrZoneSelectorModalState {
    panY: Animated.Value;
}

const ZONES: NostrZone[] = [
    { id: 'local', label: 'Local', range: '100m', icon: '📍' },
    { id: 'neighborhood', label: 'Neighborhood', range: '10km', icon: '🏠' },
    { id: 'city', label: 'City', range: '100km', icon: '🏙️' },
    { id: 'internet', label: 'Internet', range: 'Global', icon: '🌐' },
];

export default class NostrZoneSelectorModal extends Component<Props, NostrZoneSelectorModalState> {
    private _panResponders: PanResponderInstance;
    private _resetPositionAnim: Animated.CompositeAnimation;
    private _closeAnim: Animated.CompositeAnimation;

    constructor(props: Props) {
        super(props);
        
        this.state = {
        panY: new Animated.Value(Dimensions.get('screen').height),
        };

        this._resetPositionAnim = Animated.timing(this.state.panY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
        });

        this._closeAnim = Animated.timing(this.state.panY, {
        toValue: Dimensions.get('screen').height,
        duration: 500,
        useNativeDriver: false,
        });

        this._panResponders = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => false,
        onPanResponderMove: Animated.event([null, { dy: this.state.panY }], {
            useNativeDriver: false,
        }),
        onPanResponderRelease: (e, gs) => {
            if (gs.dy > 0 && gs.vy > 2) {
            return this._closeAnim.start(() => this.props.onClose());
            }
            return this._resetPositionAnim.start();
        },
        });
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.visible !== this.props.visible && this.props.visible) {
        this._resetPositionAnim.start();
        }
    }

    _handleDismiss = () => {
        this._closeAnim.start(() => this.props.onClose());
    }

    _handleZoneSelect = (zone: NostrZone) => {
        if (zone.disabled) return;
        
        this.props.onSelectZone(zone.id);
        this._handleDismiss();
    }

    render() {
        const { visible, selectedZone } = this.props;

        const top = this.state.panY.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 0, 1],
        });

        return (
        <Modal
            animated
            animationType="fade"
            visible={visible}
            transparent
            onRequestClose={this._handleDismiss}
        >
            <View style={styles.modalOverlay} {...this._panResponders.panHandlers}>
            <TouchableWithoutFeedback onPress={this._handleDismiss}>
                <View style={styles.background} />
            </TouchableWithoutFeedback>
            <Animated.View style={[styles.modalContent, { top }]}>
                <View style={styles.handleContainer}>
                <View style={styles.handle} />
                </View>
                
                <Text style={styles.title}>Select_Mesh_Zone</Text>
                
                <View style={styles.divider} />
                
                <View style={styles.zonesContainer}>
                {ZONES.map((zone, index) => {
                    const isSelected = selectedZone === zone.id;
                    const isDisabled = zone.disabled;
                    
                    return (
                    <TouchableOpacity
                        key={zone.id}
                        style={[
                        styles.zoneButton,
                        isSelected && styles.zoneButtonSelected,
                        isDisabled && styles.zoneButtonDisabled,
                        ]}
                        onPress={() => this._handleZoneSelect(zone)}
                        activeOpacity={isDisabled ? 1 : 0.7}
                        disabled={isDisabled}
                    >
                        <View style={styles.zoneContent}>
                        <Text style={[
                            styles.zoneIcon,
                            isDisabled && styles.zoneIconDisabled,
                        ]}>
                            {zone.icon}
                        </Text>
                        <Text style={[
                            styles.zoneText,
                            isDisabled && styles.zoneTextDisabled,
                        ]}>
                            {zone.label} ({zone.range})
                        </Text>
                        </View>
                    </TouchableOpacity>
                    );
                })}
                </View>
            </Animated.View>
            </View>
        </Modal>
        );
    }
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'flex-end',
    },
    background: {
        flex: 1,
    },
    modalContent: {
        backgroundColor: '#0a1f1f',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 2,
        borderColor: '#00d9ff',
        borderBottomWidth: 0,
        paddingTop: 12,
        paddingBottom: 32,
        paddingHorizontal: 20,
        maxHeight: Dimensions.get('screen').height * 0.7,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 8,
        paddingBottom: 20,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#00d9ff',
        borderRadius: 2,
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 24,
    },
    divider: {
        height: 1,
        backgroundColor: '#00d9ff',
        marginBottom: 24,
    },
    zonesContainer: {
        gap: 16,
    },
    zoneButton: {
        backgroundColor: '#0d3333',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#004d4d',
        paddingVertical: 20,
        paddingHorizontal: 20,
    },
    zoneButtonSelected: {
        backgroundColor: '#0d4d4d',
        borderColor: '#00d9ff',
        shadowColor: '#00d9ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    zoneButtonDisabled: {
        backgroundColor: '#0a1a1a',
        borderColor: '#1a2626',
        opacity: 0.4,
    },
    zoneContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    zoneIcon: {
        fontSize: 28,
        marginRight: 16,
    },
    zoneIconDisabled: {
        opacity: 0.5,
    },
    zoneText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '500',
    },
    zoneTextDisabled: {
        color: '#4a5555',
    },
});

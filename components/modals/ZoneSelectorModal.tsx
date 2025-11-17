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
    { id: 'internet', label: 'Regional', range: '1 000km', icon: '👥' },
    { id: 'internet', label: 'National', range: '5 000km', icon: '📖' },
    { id: 'internet', label: 'Global', range: '', icon: '🌐' },
];

export default class ZoneSelectorModal extends Component<Props, NostrZoneSelectorModalState> {
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
                <Text style={styles.title}>Mesh Zone</Text>
                
                <Text style={styles.sectionTitle}>Select your Mesh Zone</Text>
                
                <View style={styles.zonesContainer}>
                {ZONES.map((zone, index) => {
                    const isSelected = selectedZone === zone.id && index === 0;
                    const isDisabled = zone.disabled;
                    
                    return (
                    <TouchableOpacity
                        key={`${zone.id}-${index}`}
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
                        <View style={styles.zoneTextContainer}>
                          <Text style={[
                            styles.zoneLabel,
                            isDisabled && styles.zoneTextDisabled,
                          ]}>
                            {zone.label}
                          </Text>
                        </View>
                        {zone.range && (
                          <Text style={styles.zoneRange}>{zone.range}</Text>
                        )}
                        </View>
                    </TouchableOpacity>
                    );
                })}
                </View>

                <Text style={styles.customSectionTitle}>Custom Mesh Zone</Text>

                <View style={styles.zonesContainer}>
                  <TouchableOpacity style={[styles.zoneButton, styles.customZoneButton]}>
                    <View style={styles.zoneContent}>
                      <Text style={styles.zoneIcon}>#</Text>
                      <View style={styles.zoneTextContainer}>
                        <Text style={styles.zoneLabel}>MyCustomZone #123456</Text>
                      </View>
                      <Text style={styles.zoneRange}>100m</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.zoneButton, styles.customZoneButtonDim]}>
                    <View style={styles.zoneContent}>
                      <Text style={[styles.zoneIcon, styles.dimIcon]}>#</Text>
                      <View style={styles.zoneTextContainer}>
                        <Text style={[styles.zoneLabel, styles.dimText]}>MyCustomZone #123456</Text>
                      </View>
                      <Text style={[styles.zoneRange, styles.dimText]}>100m</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.createButton}>
                    <Text style={styles.createButtonIcon}>+</Text>
                    <Text style={styles.createButtonText}>Create new mesh zone</Text>
                  </TouchableOpacity>
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
        backgroundColor: '#0a2828',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 2,
        borderLeftWidth: 2,
        borderRightWidth: 2,
        borderColor: '#22D3EE',
        paddingTop: 32,
        paddingBottom: 32,
        paddingHorizontal: 24,
        maxHeight: Dimensions.get('screen').height * 0.85,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 8,
        paddingBottom: 20,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#22D3EE',
        borderRadius: 2,
    },
    title: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 24,
    },
    sectionTitle: {
        color: '#8a9999',
        fontSize: 16,
        fontWeight: '400',
        marginBottom: 16,
    },
    customSectionTitle: {
        color: '#8a9999',
        fontSize: 16,
        fontWeight: '400',
        marginTop: 32,
        marginBottom: 16,
    },
    zonesContainer: {
        gap: 12,
    },
    zoneButton: {
        backgroundColor: '#0d3333',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#1a4444',
        paddingVertical: 18,
        paddingHorizontal: 20,
    },
    zoneButtonSelected: {
        backgroundColor: '#0d4d4d',
        borderColor: '#22D3EE',
        shadowColor: '#22D3EE',
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
    customZoneButton: {
        borderColor: '#22D3EE',
    },
    customZoneButtonDim: {
        backgroundColor: '#0a2020',
        borderColor: '#1a3333',
    },
    zoneContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    zoneIcon: {
        fontSize: 24,
        marginRight: 16,
        color: '#fff',
    },
    dimIcon: {
        color: '#4a5555',
    },
    zoneIconDisabled: {
        opacity: 0.5,
    },
    zoneTextContainer: {
        flex: 1,
    },
    zoneLabel: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '500',
    },
    zoneRange: {
        color: '#8a9999',
        fontSize: 16,
        fontWeight: '400',
        marginLeft: 12,
    },
    dimText: {
        color: '#4a5555',
    },
    zoneTextDisabled: {
        color: '#4a5555',
    },
    createButton: {
        backgroundColor: 'transparent',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#22D3EE',
        paddingVertical: 18,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    createButtonIcon: {
        fontSize: 20,
        color: '#22D3EE',
        marginRight: 8,
        fontWeight: '600',
    },
    createButtonText: {
        color: '#22D3EE',
        fontSize: 16,
        fontWeight: '500',
    },
});

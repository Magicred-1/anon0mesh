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
import DisconnectIcon from '../icons/DisconnectIcon';
import HistoryIcon from '../icons/HistoryIcon';
import MeshZoneIcon from '../icons/MeshZoneIcon';
import MessagesIcon from '../icons/MessagesIcon';
import ProfileIcon from '../icons/ProfileIcon';
import WalletIcon from '../icons/WalletIcon';

type MenuOption = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onNavigateToMessages: () => void;
  onNavigateToWallet: () => void;
  onNavigateToHistory: () => void;
  onNavigateToMeshZone: () => void;
  onNavigateToProfile: () => void;
  onDisconnect: () => void;
};

interface MainMenuModalState {
  panY: Animated.Value;
}

export default class MainMenuModal extends Component<Props, MainMenuModalState> {
  private _panResponders: PanResponderInstance;
  private _resetPositionAnim: Animated.CompositeAnimation;
  private _closeAnim: Animated.CompositeAnimation;
  private _currentPanY: number;
  private _closedPosition: number;

  constructor(props: Props) {
    super(props);
    
    const screenHeight = Dimensions.get('screen').height;
    const closedPosition = screenHeight - 80; // Show 80px peek at bottom
    
    this._closedPosition = closedPosition;
    this._currentPanY = closedPosition;
    
    this.state = {
      panY: new Animated.Value(closedPosition),
    };

    // Add listener to track current position
    this.state.panY.addListener(({ value }) => {
      this._currentPanY = value;
    });

    this._resetPositionAnim = Animated.timing(this.state.panY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    });

    this._closeAnim = Animated.timing(this.state.panY, {
      toValue: closedPosition,
      duration: 300,
      useNativeDriver: false,
    });

    this._panResponders = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderMove: (_, gs) => {
        // Constrain the pan gesture to only move between 0 (fully open) and closedPosition (closed)
        const newValue = Math.max(0, Math.min(closedPosition, gs.dy));
        this.state.panY.setValue(newValue);
      },
      onPanResponderRelease: (_, gs) => {
        const threshold = this._closedPosition / 2;
        
        if (this._currentPanY > threshold || gs.vy > 0.5) {
          // Swipe down or fast downward velocity - close
          return this._closeAnim.start(() => this.props.onClose());
        } else {
          // Swipe up or not enough to close - open
          return this._resetPositionAnim.start();
        }
      },
    });
  }
  
  componentWillUnmount() {
    this.state.panY.removeAllListeners();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.visible !== this.props.visible) {
      if (this.props.visible) {
        this._resetPositionAnim.start();
      } else {
        this._closeAnim.start();
      }
    }
  }

  _handleDismiss = () => {
    this._closeAnim.start(() => this.props.onClose());
  }

  _handleOptionPress = (onPress: () => void) => {
    onPress();
    this._handleDismiss();
  }

  render() {
    const { visible } = this.props;
    
    const menuOptions: MenuOption[] = [
      {
        id: 'messages',
        label: 'Messages',
        icon: <MessagesIcon size={36} color="#FFFFFF" />,
        onPress: this.props.onNavigateToMessages,
      },
      {
        id: 'wallet',
        label: 'Wallet',
        icon: <WalletIcon size={36} />,
        onPress: this.props.onNavigateToWallet,
      },
      {
        id: 'history',
        label: 'History',
        icon: <HistoryIcon size={36} color="#FFFFFF" />,
        onPress: this.props.onNavigateToHistory,
      },
      {
        id: 'mesh_zone',
        label: 'Mesh_Zone',
        icon: <MeshZoneIcon size={36} color="#FFFFFF" />,
        onPress: this.props.onNavigateToMeshZone,
      },
      {
        id: 'profile',
        label: 'Profile',
        icon: <ProfileIcon size={36} color="#FFFFFF" />,
        onPress: this.props.onNavigateToProfile,
      },
      {
        id: 'disconnect',
        label: 'Disconnect',
        icon: <DisconnectIcon size={36} color="#FFFFFF" />,
        onPress: this.props.onDisconnect,
      },
    ];

    const translateY = this.state.panY;
    
    const backdropOpacity = this.state.panY.interpolate({
      inputRange: [0, Dimensions.get('screen').height - 80],
      outputRange: [0.9, 0],
      extrapolate: 'clamp',
    });

    // Don't render anything if not visible
    if (!visible) {
      return null;
    }

    return (
      <Modal
        animated
        animationType="fade"
        visible={visible}
        transparent
        onRequestClose={this._handleDismiss}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={this._handleDismiss}>
            <Animated.View 
              style={[
                styles.background, 
                { opacity: backdropOpacity }
              ]}
            />
          </TouchableWithoutFeedback>
          
          <Animated.View 
            style={[
              styles.modalContent, 
              { transform: [{ translateY }] }
            ]}
          >
            <View 
              style={styles.handleContainer}
              {...this._panResponders.panHandlers}
            >
              <View style={styles.handle} />
              <View style={styles.handle} />
            </View>
            
            <View style={styles.menuGrid}>
              {menuOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.menuItem}
                  onPress={() => this._handleOptionPress(option.onPress)}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconContainer}>
                    {option.icon}
                  </View>
                  <Text style={styles.menuLabel}>{option.label}</Text>
                </TouchableOpacity>
              ))}
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
    justifyContent: 'flex-end',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#041A1D',
  },
  modalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#041A1D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 2,
    borderColor: '#22D3EE',
    borderBottomWidth: 0,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 20,
    height: 383,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingBottom: 20,
    cursor: 'grab' as any,
    gap: 6,
  },
  handle: {
    width: 80,
    height: 4,
    backgroundColor: '#00d9ff',
    borderRadius: 2,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 20,
  },
  menuItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#0d3333',
    borderWidth: 2,
    borderColor: '#22D3EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  menuLabel: {
    color: '#22D3EE',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});

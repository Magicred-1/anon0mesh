import React, { Component } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  PanResponderInstance,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

interface BottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}

interface BottomSheetState {
  panY: Animated.Value;
}

export default class BottomSheet extends Component<BottomSheetProps, BottomSheetState> {
  private _panResponders: PanResponderInstance;
  private _resetPositionAnim: Animated.CompositeAnimation;
  private _closeAnim: Animated.CompositeAnimation;

  constructor(props: BottomSheetProps) {
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
          return this._closeAnim.start(() => this.props.onDismiss());
        }
        return this._resetPositionAnim.start();
      },
    });
  }

  componentDidUpdate(prevProps: BottomSheetProps) {
    if (prevProps.visible !== this.props.visible && this.props.visible) {
      this._resetPositionAnim.start();
    }
  }

  _handleDismiss() {
    this._closeAnim.start(() => this.props.onDismiss());
  }

  render() {
    const { visible, children } = this.props;

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
        onRequestClose={() => this._handleDismiss()}
      >
        <View style={styles.overlay} {...this._panResponders.panHandlers}>
          <TouchableWithoutFeedback onPress={() => this._handleDismiss()}>
            <View style={styles.background} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.container, { top }]}>
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
              <View style={styles.handle} />
            </View>
            {children}
          </Animated.View>
        </View>
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  background: {
    flex: 1,
  },
  container: {
    backgroundColor: '#041A1D',
    paddingTop: 8,
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#22D3EE',
    minHeight: 200,
    maxHeight: Dimensions.get('screen').height * 0.9,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#22D3EE',
    borderRadius: 2,
  },
});

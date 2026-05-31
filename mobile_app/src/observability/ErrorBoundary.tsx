import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught render error:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={S.container}>
        <View style={S.card}>
          <Text style={S.title}>Something went wrong</Text>
          <Text style={S.subtitle}>
            Your messages and keys are safe on this device.
          </Text>
          <Pressable
            style={({ pressed }) => [S.button, pressed && S.buttonPressed]}
            onPress={this.handleReset}
          >
            <Text style={S.buttonText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

// Hard-coded dark colors — intentionally NOT using ThemeProvider,
// which may itself be the source of the throw.
const S = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00080c',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0d1f28',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e3a4a',
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: '#e8f4f8',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    color: '#7ba4b8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#1a9dc3',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

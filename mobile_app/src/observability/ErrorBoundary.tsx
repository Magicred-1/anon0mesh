/**
 * Root error boundary. Catches render/lifecycle exceptions anywhere in the tree
 * and reports a single scrubbed `error_boundary_triggered` event to Sentry (a
 * no-op when observability is disabled). The fallback uses hard-coded dark
 * colors — NOT the theme — so it still renders if ThemeProvider is the thing
 * that threw.
 *
 * Removal: delete this file and unwrap <ErrorBoundary> in app/_layout.tsx.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { Sentry } from './sentry';

interface Props {
  readonly children: React.ReactNode;
}

interface State {
  readonly hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // beforeSend (in sentry.ts) scrubs the component stack + message before send.
    Sentry.withScope((scope) => {
      scope.setTag('event', 'error_boundary_triggered');
      scope.setContext('react', { componentStack: info.componentStack });
      Sentry.captureException(error);
    });
  }

  private readonly handleReset = (): void => {
    this.setState({ hasError: false });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          The app hit an unexpected error. Your messages and keys are safe on this device.
        </Text>
        <Pressable style={styles.button} onPress={this.handleReset} hitSlop={12}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#00080C',
  },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  subtitle: { color: '#8A9BA8', fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 28 },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00E5FF55',
    backgroundColor: '#00E5FF14',
  },
  buttonText: { color: '#00E5FF', fontSize: 15, fontWeight: '600' },
});

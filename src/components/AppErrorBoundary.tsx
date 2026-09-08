import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/ui/theme';

interface Props {
  children: ReactNode;
  fallbackRoute?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.fallbackRoute?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="alert-circle-outline" size={54} color="#EF4444" />
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            We encountered an unexpected issue while loading this screen.
          </Text>

          {this.state.error?.message ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText} numberOfLines={2}>
                {this.state.error.message}
              </Text>
            </View>
          ) : null}

          <View style={styles.btnRow}>
            <Pressable style={styles.retryBtn} onPress={this.handleRetry}>
              <MaterialCommunityIcons name="refresh" size={18} color="#FF7A00" />
              <Text style={styles.retryBtnText}>Try Again</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={this.handleReset}>
              <Text style={styles.btnText}>Return to Home</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCF9F7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1C0B18',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8A7A84',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    maxWidth: 300,
  },
  errorBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  errorBoxText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FF7A00',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FF7A00',
    fontSize: 14,
    fontWeight: '800',
  },
  btn: {
    backgroundColor: COLORS.orange || '#FF7A00',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 3,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

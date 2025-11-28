/**
 * Toast
 *
 * Simple toast notification component.
 */

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing, typography, borderRadius } from '@/theme';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onDismiss?: () => void;
  duration?: number;
}

export function Toast({ message, type = 'info', onDismiss, duration = 2000 }: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onDismiss?.();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const backgroundColor = getBackgroundColor(type);

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor, opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

function getBackgroundColor(type: 'success' | 'error' | 'warning' | 'info'): string {
  switch (type) {
    case 'success':
      return colors.accent.success;
    case 'error':
      return colors.accent.danger;
    case 'warning':
      return colors.accent.warning;
    case 'info':
    default:
      return colors.accent.primary;
  }
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    right: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  message: {
    ...typography.body,
    color: colors.text.inverse,
    textAlign: 'center',
  },
});

import { Platform } from 'react-native';

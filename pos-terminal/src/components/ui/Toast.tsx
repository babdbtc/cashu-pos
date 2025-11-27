/**
 * Toast Component
 *
 * Displays temporary notifications for success, error, and info messages.
 */

import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Platform,
} from 'react-native';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  visible: boolean;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onDismiss: () => void;
}

const VARIANT_CONFIG: Record<
  ToastVariant,
  { backgroundColor: string; icon: string; textColor: string }
> = {
  success: {
    backgroundColor: '#2a3a2e',
    icon: '✓',
    textColor: '#4ade80',
  },
  error: {
    backgroundColor: '#3a2a2e',
    icon: '✕',
    textColor: '#ef4444',
  },
  warning: {
    backgroundColor: '#3a3a2e',
    icon: '⚠',
    textColor: '#f59e0b',
  },
  info: {
    backgroundColor: '#2a2a3e',
    icon: 'ℹ',
    textColor: '#3b82f6',
  },
};

export function Toast({
  visible,
  message,
  variant = 'info',
  duration = 3000,
  onDismiss,
}: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Animate in
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

      // Auto dismiss after duration
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  const config = VARIANT_CONFIG[variant];

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: config.backgroundColor },
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Pressable style={styles.content} onPress={handleDismiss}>
        <View style={[styles.iconContainer, { backgroundColor: config.textColor + '20' }]}>
          <Text style={[styles.icon, { color: config.textColor }]}>{config.icon}</Text>
        </View>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        <Text style={styles.dismissHint}>Tap to dismiss</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    right: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 16,
    fontWeight: '700',
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
    lineHeight: 20,
  },
  dismissHint: {
    fontSize: 10,
    color: '#666',
    marginLeft: 8,
  },
});

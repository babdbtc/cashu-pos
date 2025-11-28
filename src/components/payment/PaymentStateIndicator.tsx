/**
 * PaymentStateIndicator
 *
 * Visual indicator for different payment states with animations and clear feedback.
 * Provides state-specific colors, icons, and animations.
 */

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import type { PaymentState } from '@/types/payment';
import { colors, spacing, typography } from '@/theme';

interface PaymentStateIndicatorProps {
  state: PaymentState;
}

export function PaymentStateIndicator({ state }: PaymentStateIndicatorProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;

  // Pulsing animation for waiting state
  useEffect(() => {
    if (state === 'waiting_for_tap' || state === 'amount_entered') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      // Reset to default scale when not waiting
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [state, pulseAnim]);

  // Rotating border spinner for validating/processing states
  useEffect(() => {
    if (state === 'validating' || state === 'processing') {
      const duration = state === 'validating' ? 1000 : 1500;
      const rotate = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotate.start();
      return () => rotate.stop();
    } else {
      rotateAnim.setValue(0);
    }
  }, [state, rotateAnim]);

  // Success/Error spring animation
  useEffect(() => {
    if (state === 'completed' || state === 'failed') {
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.2,
          tension: 100,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 5,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [state, scaleAnim]);

  // Breathing glow animation (subtle opacity pulse)
  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 0.6,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    breathe.start();

    return () => breathe.stop();
  }, [breatheAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Get state-specific configuration
  const stateConfig = getStateConfig(state);

  return (
    <View style={styles.container}>
      {/* Rotating border for validating/processing */}
      {stateConfig.hasBorder && (
        <Animated.View
          style={[
            styles.spinnerBorder,
            {
              transform: [{ rotate: rotation }],
              borderColor: stateConfig.borderColor,
            },
          ]}
        />
      )}

      {/* Breathing glow effect */}
      <Animated.View
        style={[
          styles.glowCircle,
          {
            backgroundColor: stateConfig.backgroundColor,
            opacity: breatheAnim.interpolate({
              inputRange: [0.6, 1],
              outputRange: [0.3, 0.6],
            }),
            transform: [
              {
                scale: breatheAnim.interpolate({
                  inputRange: [0.6, 1],
                  outputRange: [1.15, 1.25],
                }),
              },
            ],
          },
        ]}
      />

      {/* Main circle */}
      <Animated.View
        style={[
          styles.circle,
          {
            backgroundColor: stateConfig.backgroundColor,
            shadowColor: stateConfig.backgroundColor,
            transform: [
              {
                scale:
                  state === 'completed' || state === 'failed'
                    ? scaleAnim
                    : pulseAnim,
              },
            ],
          },
        ]}
      >
        <Text
          style={[
            styles.icon,
            state === 'validating' && { transform: [{ scale: 0.9 }] },
          ]}
        >
          {stateConfig.icon}
        </Text>
      </Animated.View>

      {/* Text labels */}
      <View style={styles.textContainer}>
        <Text style={styles.primaryText}>{stateConfig.primaryText}</Text>
        <Text style={styles.secondaryText}>{stateConfig.secondaryText}</Text>
        {stateConfig.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{stateConfig.badge}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function getStateConfig(state: PaymentState) {
  switch (state) {
    case 'waiting_for_tap':
    case 'amount_entered':
      return {
        icon: 'NFC',
        backgroundColor: colors.accent.primary,
        borderColor: colors.accent.primary,
        hasBorder: false,
        primaryText: 'Tap to Pay',
        secondaryText: "Hold customer's device near the terminal",
        badge: null,
      };

    case 'validating':
      return {
        icon: 'NFC',
        backgroundColor: colors.accent.primary,
        borderColor: '#8B5CF6',
        hasBorder: true,
        primaryText: 'Reading Token...',
        secondaryText: 'Verifying payment details',
        badge: null,
      };

    case 'processing':
      return {
        icon: '⟳',
        backgroundColor: '#F59E0B',
        borderColor: '#FBBF24',
        hasBorder: true,
        primaryText: 'Processing Payment...',
        secondaryText: 'Exchanging tokens securely',
        badge: 'Step 2 of 2',
      };

    case 'completed':
      return {
        icon: '✓',
        backgroundColor: colors.accent.success,
        borderColor: colors.accent.success,
        hasBorder: false,
        primaryText: 'Payment Received!',
        secondaryText: '',
        badge: null,
      };

    case 'failed':
      return {
        icon: '✕',
        backgroundColor: '#EF4444',
        borderColor: '#EF4444',
        hasBorder: false,
        primaryText: 'Payment Failed',
        secondaryText: '',
        badge: null,
      };

    default:
      return {
        icon: 'NFC',
        backgroundColor: colors.accent.primary,
        borderColor: colors.accent.primary,
        hasBorder: false,
        primaryText: 'Ready',
        secondaryText: '',
        badge: null,
      };
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  glowCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -10,
    zIndex: -1,
  },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    marginBottom: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  icon: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  spinnerBorder: {
    position: 'absolute',
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 3,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    top: -8,
    zIndex: -1,
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: spacing.xl,
  },
  primaryText: {
    ...typography.h3,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  secondaryText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  badge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    marginTop: spacing.sm,
  },
  badgeText: {
    ...typography.caption,
    color: '#F59E0B',
    fontWeight: '600',
  },
});

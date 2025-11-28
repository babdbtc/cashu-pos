/**
 * RateLockBadge
 *
 * Displays locked exchange rate with countdown timer and visual urgency indicators.
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing, typography, borderRadius } from '@/theme';

export interface LockedRate {
  rate: number;
  currency: string;
  lockedAt: number;
  expiresAt: number;
  source: string;
}

interface RateLockBadgeProps {
  lockedRate: LockedRate;
  onExpired?: () => void;
}

export function RateLockBadge({ lockedRate, onExpired }: RateLockBadgeProps) {
  const [timeRemaining, setTimeRemaining] = useState(lockedRate.expiresAt - Date.now());
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = lockedRate.expiresAt - Date.now();

      if (remaining <= 0) {
        setTimeRemaining(0);
        clearInterval(interval);
        onExpired?.();
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockedRate.expiresAt, onExpired]);

  // Pulse animation for critical time
  useEffect(() => {
    if (timeRemaining > 0 && timeRemaining < 10000) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [timeRemaining, pulseAnim]);

  const seconds = Math.floor(timeRemaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  const timeString = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;

  // Determine urgency level
  const urgency = getUrgencyLevel(timeRemaining);
  const badgeStyle = getBadgeStyle(urgency);

  // Format rate display
  const rateDisplay = formatRate(lockedRate.rate, lockedRate.currency);

  return (
    <Animated.View
      style={[
        styles.badge,
        badgeStyle,
        urgency === 'critical' && { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <Text style={styles.lockIcon}>🔒</Text>
      <View style={styles.content}>
        <Text style={styles.rateText}>{rateDisplay}</Text>
        <Text style={styles.timerText}>{timeString} remaining</Text>
      </View>
    </Animated.View>
  );
}

type UrgencyLevel = 'normal' | 'warning' | 'critical' | 'expired';

function getUrgencyLevel(timeRemaining: number): UrgencyLevel {
  if (timeRemaining <= 0) return 'expired';
  if (timeRemaining < 10000) return 'critical'; // < 10 seconds
  if (timeRemaining < 60000) return 'warning'; // < 60 seconds
  return 'normal';
}

function getBadgeStyle(urgency: UrgencyLevel) {
  switch (urgency) {
    case 'expired':
      return {
        backgroundColor: '#EF4444',
        borderColor: '#DC2626',
      };
    case 'critical':
      return {
        backgroundColor: '#EF4444',
        borderColor: '#F87171',
      };
    case 'warning':
      return {
        backgroundColor: '#F59E0B',
        borderColor: '#FBBF24',
      };
    case 'normal':
    default:
      return {
        backgroundColor: colors.accent.success,
        borderColor: '#34D399',
      };
  }
}

function formatRate(rate: number, currency: string): string {
  if (currency === 'USD') {
    return `$${rate.toLocaleString()}/BTC`;
  }
  return `${rate.toLocaleString()} ${currency}/BTC`;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    alignSelf: 'center',
  },
  lockIcon: {
    fontSize: 12,
    marginRight: spacing.xs,
  },
  content: {
    alignItems: 'center',
  },
  rateText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
  },
  timerText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
  },
});

import { Platform } from 'react-native';

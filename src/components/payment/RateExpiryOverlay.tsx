/**
 * RateExpiryOverlay
 *
 * Overlay shown when the locked exchange rate has expired.
 */

import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Button } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/theme';

interface RateExpiryOverlayProps {
  visible: boolean;
  onGetNewRate: () => void;
}

export function RateExpiryOverlay({ visible, onGetNewRate }: RateExpiryOverlayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>⏱️</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Rate Expired</Text>

          {/* Message */}
          <Text style={styles.message}>
            The exchange rate lock has expired. Please get a new rate to continue with payment.
          </Text>

          {/* Action */}
          <Button
            title="Get New Rate"
            onPress={onGetNewRate}
            variant="primary"
            size="lg"
            fullWidth
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F59E0B' + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
});

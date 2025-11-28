/**
 * GlassView Component
 *
 * Cross-platform glass/blur effect component that uses:
 * - iOS 26+: Native Liquid Glass effect via @callstack/liquid-glass
 * - Older iOS: BlurView from expo-blur
 * - Android/Web: Styled semi-transparent View fallback
 */

import { ReactNode } from 'react';
import { View, StyleSheet, Platform, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, borderRadius } from '../../theme';

// Check for iOS 26+ support
const isIOS = Platform.OS === 'ios';
const iOSVersion = isIOS ? parseInt(Platform.Version as string, 10) : 0;
const supportsLiquidGlass = isIOS && iOSVersion >= 26;

// Try to import LiquidGlass if available
let LiquidGlassView: React.ComponentType<any> | null = null;
if (supportsLiquidGlass) {
    try {
        // Dynamic import for iOS 26+ only
        const liquidGlass = require('@callstack/liquid-glass');
        LiquidGlassView = liquidGlass.LiquidGlassView;
    } catch {
        // Library not available, will use fallback
    }
}

export type GlassIntensity = 'light' | 'default' | 'prominent';
export type GlassVariant = 'regular' | 'thin' | 'ultraThin' | 'thick' | 'chrome';

interface GlassViewProps {
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
    intensity?: GlassIntensity;
    variant?: GlassVariant;
    /** Background tint color (used in fallback modes) */
    tint?: 'light' | 'dark' | 'default';
    /** Border radius override */
    rounded?: boolean | number;
    /** Add subtle border */
    bordered?: boolean;
}

export function GlassView({
    children,
    style,
    intensity = 'default',
    variant = 'regular',
    tint = 'dark',
    rounded = true,
    bordered = true,
}: GlassViewProps) {
    const borderRadiusValue = typeof rounded === 'number'
        ? rounded
        : rounded
            ? borderRadius.lg
            : 0;

    // iOS 26+ with Liquid Glass
    if (supportsLiquidGlass && LiquidGlassView) {
        return (
            <LiquidGlassView
                style={[
                    styles.container,
                    { borderRadius: borderRadiusValue },
                    bordered && styles.bordered,
                    style,
                ]}
                variant={variant}
            >
                {children}
            </LiquidGlassView>
        );
    }

    // iOS < 26: Use expo-blur BlurView
    if (isIOS) {
        const blurIntensity = getBlurIntensity(intensity);
        return (
            <BlurView
                style={[
                    styles.container,
                    { borderRadius: borderRadiusValue, overflow: 'hidden' },
                    bordered && styles.bordered,
                    style,
                ]}
                intensity={blurIntensity}
                tint={tint}
            >
                {children}
            </BlurView>
        );
    }

    // Android/Web: Fallback to styled View
    const backgroundColor = getFallbackBackground(tint, intensity);
    return (
        <View
            style={[
                styles.container,
                styles.fallback,
                { borderRadius: borderRadiusValue, backgroundColor },
                bordered && styles.borderedFallback,
                style,
            ]}
        >
            {children}
        </View>
    );
}

/**
 * GlassCard - A pre-styled glass card component
 */
interface GlassCardProps extends GlassViewProps {
    padded?: boolean;
}

export function GlassCard({
    children,
    style,
    padded = true,
    ...props
}: GlassCardProps) {
    return (
        <GlassView style={[padded && styles.padded, style]} {...props}>
            {children}
        </GlassView>
    );
}

/**
 * GlassModal - A pre-styled glass modal background
 */
interface GlassModalProps extends GlassViewProps {
    /** Use more prominent glass effect for modals */
    prominent?: boolean;
}

export function GlassModal({
    children,
    style,
    prominent = true,
    ...props
}: GlassModalProps) {
    return (
        <GlassView
            style={[styles.modal, style]}
            intensity={prominent ? 'prominent' : 'default'}
            variant="thick"
            rounded={borderRadius.xl}
            {...props}
        >
            {children}
        </GlassView>
    );
}

// Helper functions
function getBlurIntensity(intensity: GlassIntensity): number {
    switch (intensity) {
        case 'light':
            return 20;
        case 'prominent':
            return 60;
        case 'default':
        default:
            return 40;
    }
}

function getFallbackBackground(
    tint: 'light' | 'dark' | 'default',
    intensity: GlassIntensity
): string {
    const baseOpacity = intensity === 'light' ? 0.6 : intensity === 'prominent' ? 0.85 : 0.75;

    if (tint === 'light') {
        return `rgba(255, 255, 255, ${baseOpacity * 0.15})`;
    }
    // Dark tint - matches our app theme
    return `rgba(26, 26, 46, ${baseOpacity})`;
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    bordered: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.overlay.light,
    },
    borderedFallback: {
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    fallback: {
        // Add subtle shadow for depth on non-blur platforms
        ...Platform.select({
            android: {
                elevation: 4,
            },
            web: {
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            },
        }),
    },
    padded: {
        padding: 16,
    },
    modal: {
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
    },
});

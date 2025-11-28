/**
 * Custom Alert Hook
 *
 * Provides themed alert dialogs that match the application's dark theme.
 * Replaces native OS Alert.alert() with custom styled modals.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    Animated,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/theme';
import { GlassModal } from '@/components/ui';

type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertButton {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
}

interface AlertConfig {
    title: string;
    message?: string;
    type?: AlertType;
    buttons?: AlertButton[];
}

interface AlertContextType {
    alert: (title: string, message?: string, buttons?: AlertButton[], type?: AlertType) => void;
    confirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => void;
    success: (title: string, message?: string, onDismiss?: () => void) => void;
    error: (title: string, message?: string, onDismiss?: () => void) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<AlertConfig | null>(null);
    const [fadeAnim] = useState(new Animated.Value(0));
    const [scaleAnim] = useState(new Animated.Value(0.9));

    const show = useCallback((newConfig: AlertConfig) => {
        setConfig(newConfig);
        setVisible(true);
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 100,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, scaleAnim]);

    const hide = useCallback((callback?: () => void) => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 0.9,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setVisible(false);
            setConfig(null);
            callback?.();
        });
    }, [fadeAnim, scaleAnim]);

    const alert = useCallback((
        title: string,
        message?: string,
        buttons?: AlertButton[],
        type: AlertType = 'info'
    ) => {
        show({
            title,
            message,
            type,
            buttons: buttons || [{ text: 'OK', style: 'default' }],
        });
    }, [show]);

    const confirm = useCallback((
        title: string,
        message: string,
        onConfirm: () => void,
        onCancel?: () => void
    ) => {
        show({
            title,
            message,
            type: 'warning',
            buttons: [
                { text: 'Cancel', style: 'cancel', onPress: onCancel },
                { text: 'Confirm', style: 'destructive', onPress: onConfirm },
            ],
        });
    }, [show]);

    const success = useCallback((title: string, message?: string, onDismiss?: () => void) => {
        show({
            title,
            message,
            type: 'success',
            buttons: [{ text: 'OK', style: 'default', onPress: onDismiss }],
        });
    }, [show]);

    const error = useCallback((title: string, message?: string, onDismiss?: () => void) => {
        show({
            title,
            message,
            type: 'error',
            buttons: [{ text: 'OK', style: 'default', onPress: onDismiss }],
        });
    }, [show]);

    const handleButtonPress = (button: AlertButton) => {
        hide(button.onPress);
    };

    const getTypeIcon = (type: AlertType) => {
        switch (type) {
            case 'success':
                return '✓';
            case 'error':
                return '✕';
            case 'warning':
                return '!';
            case 'info':
            default:
                return 'i';
        }
    };

    const getTypeColor = (type: AlertType) => {
        switch (type) {
            case 'success':
                return colors.status.success;
            case 'error':
                return colors.status.error;
            case 'warning':
                return colors.status.warning;
            case 'info':
            default:
                return colors.status.info;
        }
    };

    const getButtonStyle = (style?: AlertButton['style']) => {
        switch (style) {
            case 'destructive':
                return styles.buttonDestructive;
            case 'cancel':
                return styles.buttonCancel;
            default:
                return styles.buttonDefault;
        }
    };

    const getButtonTextStyle = (style?: AlertButton['style']) => {
        switch (style) {
            case 'destructive':
                return styles.buttonTextDestructive;
            case 'cancel':
                return styles.buttonTextCancel;
            default:
                return styles.buttonTextDefault;
        }
    };

    return (
        <AlertContext.Provider value={{ alert, confirm, success, error }}>
            {children}
            <Modal
                visible={visible}
                transparent
                animationType="none"
                onRequestClose={() => hide()}
            >
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                    <Pressable style={styles.overlayPressable} onPress={() => hide()} />
                    <Animated.View
                        style={[
                            styles.animatedWrapper,
                            { transform: [{ scale: scaleAnim }], opacity: fadeAnim },
                        ]}
                    >
                        <GlassModal style={styles.container}>
                            {config && (
                                <>
                                    {/* Icon */}
                                    <View
                                        style={[
                                            styles.iconContainer,
                                            { backgroundColor: `${getTypeColor(config.type || 'info')}20` },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.icon,
                                                { color: getTypeColor(config.type || 'info') },
                                            ]}
                                        >
                                            {getTypeIcon(config.type || 'info')}
                                        </Text>
                                    </View>

                                    {/* Title */}
                                    <Text style={styles.title}>{config.title}</Text>

                                    {/* Message */}
                                    {config.message && (
                                        <Text style={styles.message}>{config.message}</Text>
                                    )}

                                    {/* Buttons */}
                                    <View style={styles.buttonContainer}>
                                        {config.buttons?.map((button, index) => (
                                            <Pressable
                                                key={index}
                                                style={({ pressed }) => [
                                                    styles.button,
                                                    getButtonStyle(button.style),
                                                    config.buttons!.length === 1 && styles.buttonFull,
                                                    pressed && styles.buttonPressed,
                                                ]}
                                                onPress={() => handleButtonPress(button)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.buttonText,
                                                        getButtonTextStyle(button.style),
                                                    ]}
                                                >
                                                    {button.text}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </>
                            )}
                        </GlassModal>
                    </Animated.View>
                </Animated.View>
            </Modal>
        </AlertContext.Provider>
    );
}

export function useAlert(): AlertContextType {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    overlayPressable: {
        ...StyleSheet.absoluteFillObject,
    },
    animatedWrapper: {
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
    },
    container: {
        width: '100%',
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    icon: {
        fontSize: 28,
        fontWeight: '700',
    },
    title: {
        ...typography.h3,
        color: colors.text.primary,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    message: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 22,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        width: '100%',
    },
    button: {
        flex: 1,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonFull: {
        flex: 1,
    },
    buttonDefault: {
        backgroundColor: colors.accent.primary,
    },
    buttonCancel: {
        backgroundColor: colors.background.tertiary,
    },
    buttonDestructive: {
        backgroundColor: colors.accent.danger,
    },
    buttonPressed: {
        opacity: 0.8,
    },
    buttonText: {
        ...typography.button,
        fontWeight: '600',
    },
    buttonTextDefault: {
        color: colors.text.inverse,
    },
    buttonTextCancel: {
        color: colors.text.primary,
    },
    buttonTextDestructive: {
        color: colors.text.primary,
    },
});

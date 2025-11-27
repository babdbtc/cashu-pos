import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { useConfigStore } from '@/store/config.store';
import { colors } from '@/theme';

interface PriceDisplayProps {
    fiatAmount: number;
    satsAmount: number;
    currencySymbol?: string;
    large?: boolean;
    style?: StyleProp<ViewStyle>;
    fiatStyle?: StyleProp<TextStyle>;
    satsStyle?: StyleProp<TextStyle>;
    showSats?: boolean; // Override to force show/hide sats if needed
}

export function PriceDisplay({
    fiatAmount,
    satsAmount,
    currencySymbol = '$',
    large = false,
    style,
    fiatStyle,
    satsStyle,
    showSats,
}: PriceDisplayProps) {
    const { currency } = useConfigStore();
    const { priceDisplayMode, satsDisplayFormat } = currency;

    const formatSats = (sats: number) => {
        if (satsDisplayFormat === 'btc') {
            return `₿${sats.toLocaleString()}`;
        }
        return `${sats.toLocaleString()} sats`;
    };

    const formatFiat = (amount: number) => {
        return amount.toFixed(currency.fiatDecimals);
    };

    const renderFiat = (isMain: boolean) => (
        <View style={styles.row}>
            <Text style={[
                isMain ? (large ? styles.symbolLarge : styles.symbol) : styles.symbolSmall,
                fiatStyle
            ]}>
                {currencySymbol}
            </Text>
            <Text style={[
                isMain ? (large ? styles.amountLarge : styles.amount) : styles.amountSmall,
                fiatStyle
            ]}>
                {formatFiat(fiatAmount)}
            </Text>
        </View>
    );

    const renderSats = (isMain: boolean) => (
        <Text style={[
            isMain ? (large ? styles.satsLarge : styles.sats) : styles.satsSmall,
            satsStyle
        ]}>
            {formatSats(satsAmount)}
        </Text>
    );

    // Determine display order
    let mainContent;
    let subContent;

    // If showSats is explicitly false (e.g. rate not loaded), force fiat only
    if (showSats === false) {
        mainContent = renderFiat(true);
        subContent = null;
    } else {
        switch (priceDisplayMode) {
            case 'sats_only':
                mainContent = renderSats(true);
                subContent = null;
                break;
            case 'sats_fiat':
                mainContent = renderSats(true);
                subContent = renderFiat(false);
                break;
            case 'fiat_sats':
            default:
                mainContent = renderFiat(true);
                subContent = renderSats(false);
                break;
        }
    }

    return (
        <View style={[styles.container, style]}>
            {mainContent}
            {subContent && <View style={styles.subContainer}>{subContent}</View>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 2,
    },
    subContainer: {
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    // Large (Main)
    symbolLarge: {
        fontSize: 32,
        fontWeight: '600',
        color: colors.text.secondary,
        marginTop: 12,
        marginRight: 4,
    },
    amountLarge: {
        fontSize: 64,
        fontWeight: '700',
        color: colors.text.primary,
        letterSpacing: -2,
    },
    satsLarge: {
        fontSize: 56,
        fontWeight: '700',
        color: colors.accent.primary,
        letterSpacing: -1,
    },
    // Normal (Main)
    symbol: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.secondary,
        marginTop: 4,
        marginRight: 2,
    },
    amount: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text.primary,
    },
    sats: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.accent.primary,
    },
    // Small (Sub)
    symbolSmall: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text.muted,
        marginTop: 2,
        marginRight: 2,
    },
    amountSmall: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text.muted,
    },
    satsSmall: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.accent.primary,
    },
});

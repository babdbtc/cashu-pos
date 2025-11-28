/**
 * Theme Colors Hook
 *
 * Provides dynamic theme colors based on user's appearance settings.
 * Returns colors object with user's selected accent color applied.
 */

import { useMemo } from 'react';
import { colors as staticColors } from '@/theme/colors';
import { useConfigStore } from '@/store/config.store';

export function useThemeColors() {
  const accentColor = useConfigStore((state) => state.appearance.accentColor);

  return useMemo(() => ({
    // Flattened structure for easier use
    background: staticColors.background.primary,
    surface: staticColors.background.secondary,
    surfaceTertiary: staticColors.background.tertiary,

    text: staticColors.text.primary,
    textSecondary: staticColors.text.secondary,
    textMuted: staticColors.text.muted,
    textInverse: staticColors.text.inverse,

    accent: accentColor,
    accentSuccess: accentColor,
    accentWarning: staticColors.accent.warning,
    accentDanger: staticColors.accent.danger,
    accentInfo: staticColors.accent.info,

    border: staticColors.border.default,
    borderLight: staticColors.border.light,

    // Keep the full nested structure for advanced usage
    colors: {
      ...staticColors,
      accent: {
        ...staticColors.accent,
        primary: accentColor,
        success: accentColor,
      },
      status: {
        ...staticColors.status,
        success: accentColor,
      },
    },
  }), [accentColor]);
}

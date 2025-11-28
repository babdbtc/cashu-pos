/**
 * Typography scale for consistent text styles
 */

import { TextStyle } from 'react-native';
import { colors } from './colors';

export const typography = {
  // Headings
  h1: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.text.primary,
  } as TextStyle,

  h2: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.primary,
  } as TextStyle,

  h3: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  } as TextStyle,

  h4: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
  } as TextStyle,

  // Body text
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.text.primary,
  } as TextStyle,

  bodyLarge: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.text.primary,
  } as TextStyle,

  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text.secondary,
  } as TextStyle,

  // Labels
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  } as TextStyle,

  // Caption
  caption: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.muted,
  } as TextStyle,

  // Button text
  button: {
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,

  buttonLarge: {
    fontSize: 18,
    fontWeight: '600',
  } as TextStyle,

  buttonSmall: {
    fontSize: 14,
    fontWeight: '600',
  } as TextStyle,

  // Monospace for IDs, codes
  mono: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: colors.text.secondary,
  } as TextStyle,

  // Amount displays
  amountLarge: {
    fontSize: 72,
    fontWeight: '700',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  } as TextStyle,

  amountMedium: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text.primary,
  } as TextStyle,

  amountSmall: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.accent.primary,
  } as TextStyle,
} as const;

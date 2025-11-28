/**
 * Color palette for CashuPay POS Terminal
 *
 * Dark theme optimized for POS terminal use with high contrast
 * and clear visual hierarchy.
 */

export const colors = {
  // Backgrounds
  background: {
    primary: '#0f0f1a',
    secondary: '#1a1a2e',
    tertiary: '#2a2a3e',
  },

  // Text
  text: {
    primary: '#ffffff',
    secondary: '#888888',
    muted: '#555555',
    inverse: '#0f0f1a',
  },

  // Accent colors
  accent: {
    primary: '#4ade80', // Green - success, primary actions
    success: '#4ade80', // Alias for primary/green
    warning: '#f59e0b', // Amber - warnings, processing
    danger: '#ef4444', // Red - errors, destructive actions
    info: '#3b82f6', // Blue - information
  },

  // Semantic colors
  status: {
    success: '#4ade80',
    error: '#ef4444',
    warning: '#f59e0b',
    pending: '#f59e0b',
    info: '#3b82f6',
    offline: '#888888',
  },

  // Border
  border: {
    default: '#2a2a3e',
    light: '#3a3a4e',
  },

  // Overlay
  overlay: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.2)',
    dark: 'rgba(0, 0, 0, 0.5)',
  },
} as const;

export type ColorKey = keyof typeof colors;

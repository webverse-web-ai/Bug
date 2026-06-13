export const DARK_COLORS = {
  // Base Layout
  background: '#0f1418',
  surface: '#0f1418',
  surfaceContainerLow: '#171c20',
  surfaceContainerHighest: '#30353a',
  surfaceContainerHigh: '#252b2f',
  surfaceBright: '#353a3e',
  surfaceDim: '#0f1418',

  // Primary (Bug BOS Cyan)
  primary: '#89ceff',
  onPrimary: '#00344d',
  primaryContainer: '#0ea5e9',
  onPrimaryContainer: '#003751',
  primaryFixedDim: '#89ceff',

  // Secondary
  secondary: '#b7c8e1',
  onSecondary: '#213145',
  secondaryContainer: '#3a4a5f',
  onSecondaryContainer: '#a9bad3',
  secondaryFixed: '#d3e4fe',
  secondaryFixedDim: '#b7c8e1',
  onSecondaryFixed: '#0b1c30',
  onSecondaryFixedVariant: '#38485d',

  // Tertiary
  tertiary: '#ffb86e',
  onTertiary: '#492900',
  tertiaryContainer: '#de8712',
  onTertiaryContainer: '#4d2b00',
  tertiaryFixed: '#ffdcbd',
  tertiaryFixedDim: '#ffb86e',
  onTertiaryFixed: '#2c1600',
  onTertiaryFixedVariant: '#693c00',

  // Error
  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',

  // Background & Borders
  onBackground: '#dee3e9',
  surfaceVariant: '#30353a',
  outline: '#88929b',
  outlineVariant: '#3e4850',
  onSurface: '#dee3e9',
  onSurfaceVariant: '#bec8d2',
  scrim: 'rgba(0,0,0,0.4)',
};

export const LIGHT_COLORS = {
  // Base Layout
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceContainerLow: '#f1f5f9',
  surfaceContainerHighest: '#e2e8f0',
  surfaceContainerHigh: '#e2e8f0',
  surfaceBright: '#ffffff',
  surfaceDim: '#cbd5e1',

  // Primary (Bug BOS Cyan adapted for Light Mode)
  primary: '#0ea5e9', // Deepened cyan for better contrast
  onPrimary: '#ffffff',
  primaryContainer: '#e0f2fe',
  onPrimaryContainer: '#0369a1',
  primaryFixedDim: '#38bdf8',

  // Secondary
  secondary: '#64748b',
  onSecondary: '#ffffff',
  secondaryContainer: '#f1f5f9',
  onSecondaryContainer: '#334155',
  secondaryFixed: '#cbd5e1',
  secondaryFixedDim: '#94a3b8',
  onSecondaryFixed: '#0f172a',
  onSecondaryFixedVariant: '#475569',

  // Tertiary
  tertiary: '#f59e0b',
  onTertiary: '#ffffff',
  tertiaryContainer: '#fef3c7',
  onTertiaryContainer: '#b45309',
  tertiaryFixed: '#fde68a',
  tertiaryFixedDim: '#fbbf24',
  onTertiaryFixed: '#451a03',
  onTertiaryFixedVariant: '#78350f',

  // Error
  error: '#ef4444',
  onError: '#ffffff',
  errorContainer: '#fee2e2',
  onErrorContainer: '#991b1b',

  // Background & Borders
  onBackground: '#0f172a',
  surfaceVariant: '#e2e8f0',
  outline: '#94a3b8',
  outlineVariant: '#cbd5e1',
  onSurface: '#0f172a',
  onSurfaceVariant: '#475569',
  scrim: 'rgba(0,0,0,0.1)',
};

// Fallback export to prevent breaking existing code during refactor
export const COLORS = DARK_COLORS;

export const TYPOGRAPHY = {
  display: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -0.02 * 48,
  },
  headlineLg: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.01 * 32,
  },
  headlineLgMobile: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 24,
    lineHeight: 32,
  },
  headlineMd: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 24,
    lineHeight: 32,
  },
  bodyLg: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 18,
    lineHeight: 28,
  },
  bodyMd: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  bodySm: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  labelLg: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
  },
  labelMd: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.02 * 13,
  },
  labelSm: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.04 * 11,
  },
};

export const ROUNDED = {
  sm: 4,
  default: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const SPACING = {
  base: 4,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  gutter: 16,
  marginMobile: 16,
  marginDesktop: 32,
};

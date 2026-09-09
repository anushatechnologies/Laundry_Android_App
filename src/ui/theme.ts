import type { OrderStatus } from '@/types/domain';
import { MD3LightTheme, type MD3Theme } from 'react-native-paper';

export const COLORS = {
  // Brand Color System (Nordic Deep Teal & Fresh Mint Production Standards)
  primary: '#0F766E',         // Deep Luxury Teal
  primaryDark: '#115E59',     // Nordic Forest Pine
  primaryLight: '#14B8A6',    // Aqua Teal Highlight
  primarySoft: '#F0FDFA',     // Glacier Water Tint
  
  // Secondary / High-Conversion Action (Mint / Emerald CTA)
  orange: '#059669',          // Crisp Emerald Mint CTA
  orangeHover: '#047857',     // Deep Emerald
  orangeDark: '#065F46',      // Dark Forest Terminal
  orangeSoft: '#ECFDF5',      // Soft Mint Tint
  orangeGlow: 'rgba(5, 150, 105, 0.24)',

  // Semantic Feedback
  success: '#10B981',         // Crisp Mint
  successDark: '#059669',
  successSoft: '#ECFDF5',
  warning: '#D97706',         // Warm Amber Gold
  warningSoft: '#FFFBEB',
  danger: '#DC2626',          // Crisp Crimson
  dangerSoft: '#FEF2F2',
  
  // Surfaces & Backgrounds
  background: '#F8FAFC',      // Crisp porcelain app background
  surface: '#FFFFFF',         // Linen card surface
  section: '#F1F5F9',         // Section background
  border: '#E2E8F0',          // Subtle border
  borderDark: '#CBD5E1',

  // Typography System
  textHeading: '#0F172A',     // Pure dark slate heading
  textBody: '#334155',        // Readable neutral body
  textCaption: '#64748B',     // Muted captions & metadata
  textLight: '#FFFFFF',

  // Dark Mode Palette
  darkBackground: '#0B1514',
  darkSurface: '#132A27',
  darkBorder: '#1D3E3A',
  darkTextHeading: '#F0FDFA',
  darkTextBody: '#99F6E4',

  // Backward-compatible tokens (preserving legacy screen bindings)
  amber: '#059669',
  amberDark: '#047857',
  amberSoft: '#ECFDF5',
  plum: '#0F766E',
  plumDark: '#115E59',
  plumLight: '#14B8A6',
  cream: '#F8FAFC',
  creamDark: '#F1F5F9',
  blush: '#F0FDFA',
  ink: '#0F172A',
  inkLight: '#334155',
  muted: '#64748B',
  line: '#E2E8F0',
  lineDark: '#CBD5E1',
  white: '#FFFFFF',
  gold: '#D97706',
  goldLight: '#FEF3C7',
  blue: '#0F766E',
  blueSoft: '#F0FDFA',
  indigo: '#0D9488',
  indigoSoft: '#CCFBF1',
} as const;

export const GRADIENTS = {
  primaryCta: ['#10B981', '#059669'] as [string, string],
  primaryBlue: ['#0F766E', '#115E59'] as [string, string],
  cardGlass: ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)'] as [string, string],
  cardDark: ['#132A27', '#0B1514'] as [string, string],
  badgeExpress: ['#D97706', '#B45309'] as [string, string],
  badgeEco: ['#10B981', '#059669'] as [string, string],
} as const;

export const TYPOGRAPHY = {
  heading: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.6, color: COLORS.textHeading },
  screenTitle: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.4, color: COLORS.textHeading },
  sectionTitle: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.3, color: COLORS.textHeading },
  cardTitle: { fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.2, color: COLORS.textHeading },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22, color: COLORS.textBody },
  caption: { fontSize: 14, fontWeight: '400' as const, lineHeight: 18, color: COLORS.textCaption },
  button: { fontSize: 16, fontWeight: '600' as const, letterSpacing: 0.1, color: COLORS.white },
  badge: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.2 },
} as const;

export const SPACING = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const RADIUS = {
  card: 20,
  button: 16,
  input: 16,
  image: 20,
  bottomSheet: 30,
  control: 16,
  pill: 999,
} as const;

export const SHADOWS = {
  // Soft premium production shadow (0 8px 30px rgba(0,0,0,.08))
  premium: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 6,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  floatingNav: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 10,
  },
  ctaGlow: {
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 5,
  },
  subtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
} as const;

export const APP_THEME: MD3Theme = {
  ...MD3LightTheme,
  roundness: RADIUS.button,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.primary,
    onPrimary: COLORS.white,
    primaryContainer: COLORS.primarySoft,
    onPrimaryContainer: COLORS.primaryDark,
    secondary: COLORS.orange,
    onSecondary: COLORS.white,
    secondaryContainer: COLORS.orangeSoft,
    onSecondaryContainer: COLORS.orangeDark,
    tertiary: COLORS.success,
    onTertiary: COLORS.white,
    tertiaryContainer: COLORS.successSoft,
    onTertiaryContainer: COLORS.successDark,
    error: COLORS.danger,
    onError: COLORS.white,
    errorContainer: COLORS.dangerSoft,
    onErrorContainer: COLORS.danger,
    background: COLORS.background,
    onBackground: COLORS.textHeading,
    surface: COLORS.surface,
    onSurface: COLORS.textHeading,
    surfaceVariant: COLORS.section,
    onSurfaceVariant: COLORS.textCaption,
    outline: COLORS.border,
    outlineVariant: COLORS.borderDark,
    inverseSurface: COLORS.darkSurface,
    inverseOnSurface: COLORS.white,
    inversePrimary: COLORS.orange,
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level1: COLORS.surface,
      level2: COLORS.surface,
      level3: COLORS.section,
      level4: COLORS.section,
      level5: COLORS.section,
    },
  },
};

export function money(value: number | undefined) {
  const amount = Number(value || 0);
  if (amount % 1 === 0) {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function statusLabel(status: string | undefined) {
  return String(status || 'ORDER_PLACED')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function statusTone(status: OrderStatus | string | undefined) {
  if (status === 'DELIVERED' || status === 'COMPLETED') {
    return { backgroundColor: COLORS.successSoft, color: COLORS.success, borderColor: '#BBF7D0' };
  }
  if (status === 'CANCELLED') {
    return { backgroundColor: COLORS.dangerSoft, color: COLORS.danger, borderColor: '#FECACA' };
  }
  if (status === 'OUT_FOR_DELIVERY' || status === 'PICKUP_ASSIGNED' || status === 'DELIVERY_ASSIGNED') {
    return { backgroundColor: COLORS.primarySoft, color: COLORS.primary, borderColor: '#99F6E4' };
  }
  if (status === 'WASHING_AND_IRONING' || status === 'IN_PROGRESS' || status === 'AT_WORKSHOP') {
    return { backgroundColor: COLORS.indigoSoft, color: COLORS.indigo, borderColor: '#A7F3D0' };
  }
  return { backgroundColor: COLORS.warningSoft, color: COLORS.warning, borderColor: '#FDE68A' };
}

export function shortDate(value: string | undefined) {
  if (!value) return 'Flexible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', weekday: 'short' });
}

export function dateTime(value: string | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function localDateString(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

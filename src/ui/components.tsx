import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {
  Button,
  Chip as PaperChip,
  IconButton,
  Surface,
  TextInput,
  type TextInputProps,
} from 'react-native-paper';
import type { OrderStatus } from '@/types/domain';
import { COLORS, RADIUS, statusLabel, statusTone } from '@/ui/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

interface AppButtonProps {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}

type AppInputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle | TextStyle>;
};

/** Material Design 3 button with the existing app's small API. */
export function AppButton({ title, onPress, variant = 'primary', loading, disabled, compact, icon, style }: AppButtonProps) {
  const config = {
    primary: { mode: 'contained' as const, buttonColor: COLORS.plum, textColor: COLORS.white },
    secondary: { mode: 'contained-tonal' as const, buttonColor: COLORS.blush, textColor: COLORS.plumDark },
    outline: { mode: 'outlined' as const, buttonColor: undefined, textColor: COLORS.plum },
    danger: { mode: 'contained' as const, buttonColor: COLORS.danger, textColor: COLORS.white },
  }[variant];

  return (
    <Button
      mode={config.mode}
      icon={icon}
      disabled={disabled || loading}
      loading={loading}
      buttonColor={config.buttonColor}
      textColor={config.textColor}
      onPress={() => { void onPress(); }}
      style={[styles.button, compact && styles.compactButton, style]}
      contentStyle={[styles.buttonContent, compact && styles.compactContent]}
      labelStyle={[styles.buttonText, compact && styles.compactLabel]}
    >
      {title}
    </Button>
  );
}

/** Surface uses Paper elevation while preserving the familiar Card API used by every screen. */
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <Surface elevation={1} style={[styles.card, style]}>{children}</Surface>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between" style={styles.sectionTitle}>
      <Text style={styles.sectionHeading}>{title}</Text>
      {action}
    </View>
  );
}

export function AppInput({ label, containerStyle, style, ...props }: AppInputProps) {
  return (
    <View style={containerStyle}>
      <TextInput
        mode="outlined"
        label={label}
        placeholderTextColor={COLORS.muted}
        outlineColor={COLORS.line}
        activeOutlineColor={COLORS.plum}
        textColor={COLORS.ink}
        outlineStyle={styles.inputOutline}
        style={[styles.input, style as unknown as StyleProp<TextStyle>]}
        contentStyle={[styles.inputContent, style as unknown as StyleProp<TextStyle>]}
        {...props}
      />
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <PaperChip
      mode="outlined"
      selected={active}
      showSelectedCheck={false}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      textStyle={[styles.chipText, active && styles.chipTextActive]}
    >
      {label}
    </PaperChip>
  );
}

export function QuantityControl({ value, min = 1, onChange }: { value: number; min?: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.quantity}>
      <IconButton icon="minus" size={17} iconColor={COLORS.plum} onPress={() => onChange(Math.max(min, value - 1))} />
      <Text style={styles.quantityValue}>{value}</Text>
      <IconButton icon="plus" size={17} iconColor={COLORS.plum} onPress={() => onChange(value + 1)} />
    </View>
  );
}

export function EmptyState({ icon, title, detail, action }: { icon: IconName; title: string; detail: string; action?: ReactNode }) {
  return (
    <Card style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} color={COLORS.plum} size={28} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDetail}>{detail}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </Card>
  );
}

function statusIcon(status: OrderStatus | string | undefined): IconName {
  if (status === 'DELIVERED' || status === 'COMPLETED') return 'check-circle-outline';
  if (status === 'CANCELLED') return 'close-circle-outline';
  if (status === 'QUALITY_CHECK') return 'clipboard-check-outline';
  if (status === 'PACKED') return 'package-variant-closed';
  if (status === 'OUT_FOR_DELIVERY' || status === 'DELIVERY_ASSIGNED') return 'truck-fast-outline';
  if (status === 'PICKUP_ASSIGNED' || status === 'PICKED_UP') return 'truck-check-outline';
  return 'clock-outline';
}

/** A semantic status indicator: every tone is paired with a readable label and icon. */
export function StatusPill({ status }: { status: OrderStatus | string | undefined }) {
  const tone = statusTone(status);
  const label = statusLabel(status);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Order status: ${label}`}
      style={[styles.statusPill, { backgroundColor: tone.backgroundColor }]}
    >
      <MaterialCommunityIcons name={statusIcon(status)} color={tone.color} size={14} />
      <Text numberOfLines={1} style={[styles.statusText, { color: tone.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: RADIUS.control },
  compactButton: { borderRadius: RADIUS.control },
  buttonContent: { minHeight: 52, paddingHorizontal: 10 },
  compactContent: { minHeight: 44, paddingHorizontal: 2 },
  buttonText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.1 },
  compactLabel: { fontSize: 12 },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.card,
    padding: 16,
    shadowColor: COLORS.plumDark,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  sectionTitle: { marginBottom: 10 },
  sectionHeading: { color: COLORS.plumDark, fontSize: 17, fontWeight: '800' },
  input: { backgroundColor: COLORS.white },
  inputOutline: { borderRadius: RADIUS.control },
  inputContent: { minHeight: 52, fontSize: 15 },
  chip: { borderColor: COLORS.line, backgroundColor: COLORS.white },
  chipActive: { borderColor: COLORS.plum, backgroundColor: COLORS.blush },
  chipText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: COLORS.plum, fontWeight: '800' },
  quantity: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blush, borderRadius: RADIUS.control, overflow: 'hidden', minHeight: 44 },
  quantityValue: { minWidth: 27, color: COLORS.plumDark, textAlign: 'center', fontSize: 14, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 30 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.blush, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: COLORS.plumDark, fontSize: 16, fontWeight: '800' },
  emptyDetail: { color: COLORS.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 5 },
  emptyAction: { marginTop: 16, alignSelf: 'stretch' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 7, maxWidth: '100%' },
  statusText: { flexShrink: 1, fontSize: 10, fontWeight: '900' },
});

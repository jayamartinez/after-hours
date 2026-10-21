import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

interface AllowanceCardProps {
  icon: ReactNode;
  /** Null while loading. */
  title: string | null;
  detail: string;
  onPress: () => void;
  accessibilityHint: string;
  /** Trailing action text. */
  action?: string;
}

/** You tab row for an allowance (plan, photos, messages): icon, balance, detail, action. */
export function AllowanceCard({
  icon,
  title,
  detail,
  onPress,
  accessibilityHint,
  action = 'Get more',
}: AllowanceCardProps) {
  return (
    <View style={styles.card}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.well}>{icon}</View>
        <View style={styles.labels}>
          {title === null ? (
            <ActivityIndicator color={colors.textMuted} style={styles.loading} />
          ) : (
            <Text style={styles.title}>{title}</Text>
          )}
          <Text style={styles.subtitle}>{detail}</Text>
        </View>
        <Text style={styles.action}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: radius.bubble,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  pressed: { opacity: 0.6 },
  well: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  labels: { flex: 1, gap: 2, paddingVertical: 8 },
  loading: { alignSelf: 'flex-start' },
  title: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 22, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  action: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.accent },
});

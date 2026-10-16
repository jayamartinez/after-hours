import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { colors, fonts, spacing, type } from '@/theme/tokens';

/** Serif question title (42/44) with a muted subtitle (15/22), as on screens 03–07. */
export function QuestionTitle({
  title,
  subtitle,
  size = 42,
}: {
  title: string;
  subtitle?: string;
  size?: 42 | 44;
}) {
  return (
    <View style={styles.block}>
      <Text accessibilityRole="header" style={[styles.title, size === 44 && styles.title44]}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Uppercase 11px tracking label. */
export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  title: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 44,
    letterSpacing: -0.02 * 42,
    color: colors.text,
  },
  title44: { fontSize: 44, lineHeight: 46, letterSpacing: -0.02 * 44 },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted },
  label: { ...type.label, lineHeight: 14 },
});

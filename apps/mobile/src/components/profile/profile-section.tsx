import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type } from '@/theme/tokens';

interface ProfileSectionProps {
  title: string;
  /** Optional line under the title (e.g. the memories explainer). */
  subline?: string;
  /** Right-aligned element on the title row (e.g. "See gallery"). */
  accessory?: ReactNode;
  children: ReactNode;
}

/** Profile section: serif display-s title from `copy.profileSections`, then content. */
export function ProfileSection({ title, subline, accessory, children }: ProfileSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.titleBlock}>
        <View style={styles.titleRow}>
          <Text style={[type.displayS, styles.title]} accessibilityRole="header">
            {title}
          </Text>
          {accessory}
        </View>
        {subline ? <Text style={styles.subline}>{subline}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  titleBlock: { gap: 6 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { flexShrink: 1 },
  subline: { ...type.secondary, lineHeight: 22 },
});

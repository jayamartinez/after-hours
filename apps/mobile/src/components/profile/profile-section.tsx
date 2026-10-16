import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type } from '@/theme/tokens';

interface ProfileSectionProps {
  title: string;
  /** Optional line under the title (e.g. the memories explainer). */
  subline?: string;
  /** Right-aligned element on the title row (e.g. "See gallery"). */
  accessory?: ReactNode;
  /** Gap between title block and content: 12 for About, 16 elsewhere. */
  gap?: 12 | 16;
  children: ReactNode;
}

/** Profile section: serif display-s title from `copy.profileSections`, then content. */
export function ProfileSection({
  title,
  subline,
  accessory,
  gap = 16,
  children,
}: ProfileSectionProps) {
  return (
    <View style={{ gap }}>
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

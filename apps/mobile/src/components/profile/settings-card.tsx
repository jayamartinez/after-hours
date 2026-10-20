import type { PublicCharacter } from '@after-hours/contracts';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { clearConversationSubline, LABELS } from '@/components/discovery/companion-copy';
import { TrashIcon } from '@/components/discovery/icons';
import { colors, fonts, radius } from '@/theme/tokens';

interface SettingsCardProps {
  companion: PublicCharacter;
  /** Clear conversation (asks first; see the profile screen). */
  onClear: () => void;
  /** A clear is in flight. */
  clearing?: boolean;
}

/**
 * Per-companion settings: Clear conversation deletes the stored messages (memories stay).
 * Proactive messages and the iMessage bridge are not built, so they are not shown (D-043).
 */
export function SettingsCard({ companion, onClear, clearing }: SettingsCardProps) {
  return (
    <View style={styles.card}>
      <Pressable
        onPress={onClear}
        disabled={clearing}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!clearing, busy: !!clearing }}
        accessibilityLabel={`${LABELS.clearConversation}. ${clearConversationSubline(companion)}`}
        style={({ pressed }) => [(pressed || clearing) && styles.pressed]}
      >
        <Row icon={<TrashIcon />} danger>
          <View style={styles.labels}>
            <Text style={[styles.title, styles.danger]}>{LABELS.clearConversation}</Text>
            <Text style={styles.subtitle}>{clearConversationSubline(companion)}</Text>
          </View>
        </Row>
      </Pressable>
    </View>
  );
}

function Row({
  icon,
  divider,
  danger,
  children,
}: {
  icon: ReactNode;
  divider?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      <View style={[styles.well, danger && styles.wellDanger]}>{icon}</View>
      {children}
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
  divider: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  well: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  wellDanger: { backgroundColor: colors.live },
  labels: { flex: 1, gap: 2, paddingVertical: 8 },
  title: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 22, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  danger: { color: colors.danger },
  pressed: { opacity: 0.6 },
});

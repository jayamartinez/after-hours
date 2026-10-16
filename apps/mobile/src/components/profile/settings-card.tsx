import type { PublicCharacter } from '@after-hours/contracts';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { iMessageLabel, LABELS, proactiveSubline } from '@/components/discovery/companion-copy';
import {
  BellIcon,
  ChatBubbleIcon,
  ChevronRightIcon,
  TrashIcon,
} from '@/components/discovery/icons';
import { colors, fonts, radius } from '@/theme/tokens';

import { Toggle } from './toggle';
import { useProactivePreference } from './use-proactive-preference';

interface SettingsCardProps {
  companion: PublicCharacter;
  onUnavailable: (message: string) => void;
}

/**
 * Per-companion settings. Proactive messages is a session preference (config default);
 * the iMessage bridge and clearing history are not built, so they are labeled and disabled.
 */
export function SettingsCard({ companion, onUnavailable }: SettingsCardProps) {
  const [proactive, setProactive] = useProactivePreference(companion);
  return (
    <View style={styles.card}>
      <Row icon={<BellIcon />} divider>
        <View style={styles.labels}>
          <Text style={styles.title}>{LABELS.proactive}</Text>
          <Text style={styles.subtitle}>{proactiveSubline(companion)}</Text>
        </View>
        <Toggle value={proactive} onChange={setProactive} label={LABELS.proactive} />
      </Row>

      <Pressable
        onPress={() => onUnavailable(LABELS.iMessageSoon)}
        accessibilityRole="button"
        accessibilityLabel={`${iMessageLabel(companion)}, ${LABELS.iMessageValue}, ${LABELS.comingSoon}`}
      >
        <Row icon={<ChatBubbleIcon />} divider>
          <View style={styles.labels}>
            <Text style={styles.title}>{iMessageLabel(companion)}</Text>
            <Text style={styles.subtitle}>{LABELS.comingSoonTitle}</Text>
          </View>
          <View style={styles.value}>
            <Text style={styles.valueText}>{LABELS.iMessageValue}</Text>
            <ChevronRightIcon color={colors.textMuted} />
          </View>
        </Row>
      </Pressable>

      <View
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        accessibilityLabel={`${LABELS.clearConversation}. ${LABELS.clearUnavailable}`}
        style={styles.disabled}
      >
        <Row icon={<TrashIcon />} danger>
          <View style={styles.labels}>
            <Text style={[styles.title, styles.danger]}>{LABELS.clearConversation}</Text>
            <Text style={styles.subtitle}>{LABELS.clearUnavailable}</Text>
          </View>
        </Row>
      </View>
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
  value: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  valueText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: colors.textMuted },
  disabled: { opacity: 0.5 },
});

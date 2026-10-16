import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCompanions } from '@/api/companions';
import { BackButton } from '@/components/back-button';
import { CastRow } from '@/components/discovery/cast-row';
import { openChat } from '@/components/discovery/chat-link';
import { castEyebrow, LABELS } from '@/components/discovery/companion-copy';
import { colors, fonts, spacing, type } from '@/theme/tokens';

const MAX_WIDTH = 430;

/** Cast List: the secondary browse state reached from "See all" (Paper IN-0 / T6-0). */
export default function CastListScreen() {
  const { data, isPending } = useCompanions();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const companions = data?.companions ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.back}>
          <BackButton />
        </View>
        <View style={styles.header}>
          <Text style={[type.label, styles.eyebrow]}>{castEyebrow(new Date())}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {LABELS.castTitle}
          </Text>
          <Text style={styles.subline}>{LABELS.castSubline}</Text>
        </View>

        {isPending ? (
          <ActivityIndicator color={colors.textMuted} style={styles.loading} />
        ) : (
          <View style={styles.list}>
            {companions.map((companion, index) => (
              <CastRow
                key={companion.id}
                companion={companion}
                index={index}
                expanded={expandedId === companion.id}
                dimmed={expandedId !== null && expandedId !== companion.id}
                onToggle={() =>
                  setExpandedId((current) => (current === companion.id ? null : companion.id))
                }
                onStartChat={() => openChat(companion.id)}
                onOpenProfile={() =>
                  router.push({ pathname: '/companion/[id]', params: { id: companion.id } })
                }
              />
            ))}
            <View style={styles.footnote}>
              <Text style={type.caption}>{LABELS.castFootnote}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    marginHorizontal: 'auto',
    paddingBottom: spacing.huge,
  },
  back: { paddingHorizontal: spacing.sm },
  header: { gap: 10, paddingHorizontal: spacing.gutter, paddingTop: 4, paddingBottom: 24 },
  eyebrow: { lineHeight: 14 },
  title: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: -0.88,
    color: colors.text,
  },
  subline: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted },
  loading: { marginTop: spacing.huge },
  list: { paddingHorizontal: spacing.gutter },
  footnote: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
});

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCredits } from '@/api/credits';
import { PhotoIcon } from '@/components/discovery/icons';
import { colors, fonts, radius } from '@/theme/tokens';

import { CreditsSheet } from './credits-sheet';
import { creditsLabel } from './credits-copy';

const nextDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** You tab: photo credit balance, demo Plus status, and "Get more". */
export function PhotosCard({ onMessage }: { onMessage: (text: string) => void }) {
  const { data, isPending, isError, refetch } = useCredits();
  const [open, setOpen] = useState(false);

  const detail = isError
    ? 'Couldn’t load your balance. Tap to try again.'
    : data?.plus
      ? `Plus · more photos ${nextDate(data.plus.nextCreditsAt)}`
      : 'Each photo a companion sends uses one';

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => (isError ? void refetch() : setOpen(true))}
        accessibilityRole="button"
        accessibilityHint="Opens demo photo packs"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.well}>
          <PhotoIcon size={18} />
        </View>
        <View style={styles.labels}>
          {isPending ? (
            <ActivityIndicator color={colors.textMuted} style={styles.loading} />
          ) : (
            <Text style={styles.title}>{data ? creditsLabel(data.balance) : 'Photo credits'}</Text>
          )}
          <Text style={styles.subtitle}>{detail}</Text>
        </View>
        <Text style={styles.action}>Get more</Text>
      </Pressable>
      <CreditsSheet visible={open} onClose={() => setOpen(false)} onMessage={onMessage} />
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

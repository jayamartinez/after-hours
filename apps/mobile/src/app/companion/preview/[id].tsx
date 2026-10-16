import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCompanion } from '@/api/companions';
import { CompanionImage } from '@/components/companion-image';
import { openChat } from '@/components/discovery/chat-link';
import { goBackOr } from '@/components/discovery/dismiss';
import { GlassButton } from '@/components/discovery/glass-button';
import { ChevronDownIcon } from '@/components/discovery/icons';
import { Meters } from '@/components/discovery/meters';
import { NameRow } from '@/components/discovery/name-row';
import { Opener } from '@/components/discovery/opener';
import { Scrim, SCRIMS } from '@/components/discovery/scrim';
import { StatusLine } from '@/components/discovery/status-line';
import { VoiceSampleRow } from '@/components/discovery/voice';
import { PrimaryButton } from '@/components/primary-button';
import { colors, fonts, radius, spacing, tints, tones } from '@/theme/tokens';

const HERO_HEIGHT = 392;
/** The sheet overlaps the hero by 48pt (Paper 2CI-0: sheet top at 344). */
const SHEET_TOP = 344;
const MAX_WIDTH = 430;

/** Spotlight expanded sheet (Paper 2CI-0), opened by the Spotlight CTA. */
export default function CompanionPreviewSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { companion, isPending } = useCompanion(id);
  const insets = useSafeAreaInsets();

  if (!companion) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.close}>
          <GlassButton label="Close" size={40} onPress={() => goBackOr()}>
            <ChevronDownIcon />
          </GlassButton>
        </View>
        {isPending ? (
          <ActivityIndicator color={colors.textMuted} style={styles.centered} />
        ) : (
          <Text style={[styles.missing, styles.centered]}>That companion does not exist.</Text>
        )}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        <View style={[styles.hero, { backgroundColor: tints[companion.tint].ground }]}>
          <CompanionImage companion={companion} slot="hero" style={StyleSheet.absoluteFill} />
          <Scrim stops={SCRIMS.sheetTop} style={styles.topScrim} />
        </View>
        <View style={[styles.close, { paddingTop: insets.top + 4 }]}>
          <GlassButton label="Close" size={40} onPress={() => goBackOr()}>
            <ChevronDownIcon />
          </GlassButton>
        </View>

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.identity}>
              <StatusLine companion={companion} />
              <NameRow companion={companion} size={44} />
              <Text style={styles.blurb}>{companion.blurb}</Text>
              <View style={styles.meters}>
                <Meters meters={companion.meters} />
              </View>
            </View>
            <Opener companion={companion} />
            <VoiceSampleRow companion={companion} />
          </ScrollView>
          <PrimaryButton
            label={companion.copy.spotlightCta}
            accessibilityHint="Opens the chat"
            onPress={() => openChat(companion.id)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: MAX_WIDTH },
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  close: { paddingHorizontal: spacing.gutter, alignItems: 'flex-start' },
  sheet: {
    position: 'absolute',
    top: SHEET_TOP,
    left: 0,
    right: 0,
    bottom: 0,
    gap: 16,
    paddingTop: 10,
    paddingHorizontal: spacing.gutter,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: tones.sheetEdge,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.hairline,
  },
  content: { gap: 16, paddingBottom: spacing.lg },
  identity: { gap: 10 },
  blurb: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.text },
  meters: { paddingTop: 8 },
  missing: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted },
  centered: { marginTop: spacing.huge, alignSelf: 'center' },
});

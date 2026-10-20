import type { PublicCharacter } from '@after-hours/contracts';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompanionImage } from '@/components/companion-image';
import { GlassButton } from '@/components/discovery/glass-button';
import { ChevronLeftIcon, MoreIcon } from '@/components/discovery/icons';
import { Scrim, SCRIMS } from '@/components/discovery/scrim';
import { colors, fonts, tints } from '@/theme/tokens';

const HERO_HEIGHT = 520;
const NAV_MIN_TOP = 16;

interface ProfileHeroProps {
  companion: PublicCharacter;
  onBack: () => void;
  onMore: () => void;
}

/** Full-bleed hero with back/overflow chrome and identity (Paper 12C-0 / 212-0). */
export function ProfileHero({ companion, onBack, onMore }: ProfileHeroProps) {
  const insets = useSafeAreaInsets();
  const tint = tints[companion.tint];
  return (
    <View style={[styles.hero, { backgroundColor: tint.ground }]}>
      <CompanionImage companion={companion} slot="hero" style={StyleSheet.absoluteFill} />
      <Scrim stops={SCRIMS.heroBottom} style={styles.bottomScrim} />
      <Scrim stops={SCRIMS.heroTop} style={styles.topScrim} />

      {/* Web has no status-bar inset, so keep a minimum gap from the top edge. */}
      <View style={[styles.nav, { paddingTop: Math.max(insets.top, NAV_MIN_TOP) }]}>
        <GlassButton label="Back" onPress={onBack}>
          <ChevronLeftIcon />
        </GlassButton>
        <GlassButton label={`About ${companion.name}`} onPress={onMore}>
          <MoreIcon />
        </GlassButton>
      </View>

      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text
            style={styles.name}
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {companion.name}
          </Text>
          <Text style={styles.age}>{companion.age}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: HERO_HEIGHT, overflow: 'hidden' },
  bottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 300 },
  topScrim: { position: 'absolute', left: 0, right: 0, top: 0, height: 120 },
  nav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  identity: { position: 'absolute', left: 20, right: 20, bottom: 20, gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  name: {
    flexShrink: 1,
    fontFamily: fonts.display,
    fontSize: 64,
    lineHeight: 76,
    letterSpacing: -1.28,
    color: colors.text,
  },
  age: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.textMuted },
});

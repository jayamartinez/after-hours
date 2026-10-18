import type { PublicCharacter } from '@after-hours/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCompanion } from '@/api/companions';
import { BackButton } from '@/components/back-button';
import { openChat } from '@/components/discovery/chat-link';
import { LABELS, memoriesSubline } from '@/components/discovery/companion-copy';
import { goBackOr } from '@/components/discovery/dismiss';
import { PhotoViewer } from '@/components/gallery/photo-viewer';
import { AboutSheet } from '@/components/profile/about-sheet';
import { ActionRow } from '@/components/profile/action-row';
import { DisclosureFooter } from '@/components/profile/disclosure-footer';
import { MemoriesEmpty } from '@/components/profile/memories-empty';
import { PhotoPair } from '@/components/profile/photo-pair';
import { ProfileHero } from '@/components/profile/profile-hero';
import { ProfileSection } from '@/components/profile/profile-section';
import { SettingsCard } from '@/components/profile/settings-card';
import { useToast } from '@/components/profile/toast';
import { colors, fonts, spacing, type } from '@/theme/tokens';

const MAX_WIDTH = 430;

/** Companion profile (Paper 05 Core screens, 12C-0 / 212-0). Every word and image from config. */
export default function CompanionProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { companion, isPending } = useCompanion(id);

  if (!companion) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.missingBar}>
          <BackButton />
        </View>
        {isPending ? (
          <ActivityIndicator color={colors.textMuted} style={styles.centered} />
        ) : (
          <Text style={[type.secondary, styles.centered]}>That companion does not exist.</Text>
        )}
      </SafeAreaView>
    );
  }

  return <Profile companion={companion} />;
}

function Profile({ companion }: { companion: PublicCharacter }) {
  const toast = useToast();
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const sections = companion.publicProfile.copy.profileSections;
  const photos = [
    { companion, index: 0 as const },
    { companion, index: 1 as const },
  ];
  const openGallery = () =>
    router.navigate({ pathname: '/gallery', params: { companion: companion.id } });

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <ProfileHero
            companion={companion}
            onBack={() => goBackOr()}
            onMore={() => setAboutOpen(true)}
          />
          <ActionRow
            onMessage={() => openChat(companion.id)}
            onCall={() => toast.show(LABELS.callSoon)}
            onVoiceNote={() => toast.show(LABELS.voiceNoteSoon)}
            onPhotos={openGallery}
          />

          <View style={styles.body}>
            <View style={styles.firstSection}>
              <ProfileSection title={sections.remembers} subline={memoriesSubline(companion)}>
                <MemoriesEmpty />
              </ProfileSection>
            </View>

            <ProfileSection
              title={sections.photos}
              accessory={
                <Pressable onPress={openGallery} accessibilityRole="link" hitSlop={12}>
                  <Text style={styles.link}>{LABELS.seeGallery}</Text>
                </Pressable>
              }
            >
              <PhotoPair companion={companion} onOpen={setViewerAt} />
            </ProfileSection>

            <SettingsCard companion={companion} onUnavailable={toast.show} />

            <DisclosureFooter companion={companion} />
          </View>
        </View>
      </ScrollView>
      {toast.node}
      <PhotoViewer photos={photos} openAt={viewerAt} onChange={setViewerAt} />
      <AboutSheet
        companion={companion}
        visible={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.huge },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  body: { gap: 40, paddingHorizontal: spacing.gutter },
  firstSection: { borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 28 },
  link: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.textMuted },
  missingBar: { paddingHorizontal: spacing.sm },
  centered: { marginTop: spacing.huge, alignSelf: 'center' },
});

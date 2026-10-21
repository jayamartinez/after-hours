import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDeleteAccount } from '@/api/account';
import { DEV_EDITOR_ENABLED } from '@/api/config';
import { confirmDestructive } from '@/components/confirm';
import { MessagesCard } from '@/components/credits/messages-card';
import { PhotosCard } from '@/components/credits/photos-card';
import { PlusCard } from '@/components/credits/plus-card';
import { TrashIcon } from '@/components/discovery/icons';
import { DemoControlsRow } from '@/components/onboarding/demo-controls-row';
import { SoundsCard } from '@/components/profile/sounds-card';
import { useToast } from '@/components/profile/toast';
import { colors, fonts, layout, radius, spacing, type } from '@/theme/tokens';

const MAX_WIDTH = 430;

/** You tab: plan, sounds, messages, photo credits, data controls, demo controls, and (in development) the editor. */
export default function YouScreen() {
  const toast = useToast({ aboveTabBar: true });
  const deleteAccount = useDeleteAccount();

  const deleteEverything = async () => {
    const ok = await confirmDestructive({
      title: 'Delete all your data?',
      message:
        'Every conversation, message, memory, and photo credit is deleted from After Hours for good. You start over with a new, empty account.',
      confirmLabel: 'Delete everything',
    });
    if (!ok) return;
    deleteAccount.mutate(undefined, {
      onSuccess: () => toast.show('All your data was deleted'),
      onError: (error) => toast.show(error.message),
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.displayM} accessibilityRole="header">
          You
        </Text>

        <View style={styles.section}>
          <Text style={type.label}>Plan</Text>
          <PlusCard onMessage={toast.show} />
        </View>

        <View style={styles.section}>
          <Text style={type.label}>Sounds</Text>
          <SoundsCard />
        </View>

        <View style={styles.section}>
          <Text style={type.label}>Messages</Text>
          <MessagesCard onMessage={toast.show} />
        </View>

        <View style={styles.section}>
          <Text style={type.label}>Photos</Text>
          <PhotosCard onMessage={toast.show} />
        </View>

        <View style={styles.section}>
          <Text style={type.label}>Your data</Text>
          <View style={styles.card}>
            <Pressable
              onPress={() => void deleteEverything()}
              disabled={deleteAccount.isPending}
              accessibilityRole="button"
              accessibilityState={{ busy: deleteAccount.isPending }}
              style={({ pressed }) => [
                styles.row,
                (pressed || deleteAccount.isPending) && styles.pressed,
              ]}
            >
              <View style={styles.wellDanger}>
                <TrashIcon />
              </View>
              <View style={styles.labels}>
                <Text style={[styles.title, styles.danger]}>Delete all my data</Text>
                <Text style={styles.subtitle}>Chats, memories, and photo credits</Text>
              </View>
            </Pressable>
          </View>
          <Text style={styles.note}>
            To forget single memories or clear one conversation, open a companion’s profile.
          </Text>
        </View>

        <DemoControlsRow />
        {DEV_EDITOR_ENABLED ? (
          <Link href="/dev/companions" style={styles.devLink}>
            <Text style={styles.devText}>Dev: character editor</Text>
          </Link>
        ) : null}
      </ScrollView>
      {toast.node}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    marginHorizontal: 'auto',
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xxl,
    paddingBottom: layout.tabBarClearance + spacing.lg,
  },
  section: { marginTop: spacing.xxl, gap: spacing.sm },
  card: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: radius.bubble,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  pressed: { opacity: 0.6 },
  wellDanger: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.live,
  },
  labels: { flex: 1, gap: 2, paddingVertical: 8 },
  title: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 22, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  danger: { color: colors.danger },
  note: { ...type.caption, lineHeight: 18 },
  devLink: { marginTop: spacing.xxl },
  devText: { ...type.secondary, color: colors.accent },
});

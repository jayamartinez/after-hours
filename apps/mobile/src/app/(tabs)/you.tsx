import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { DEV_EDITOR_ENABLED } from '@/api/config';
import { ComingSoon } from '@/components/coming-soon';
import { DemoControlsRow } from '@/components/onboarding/demo-controls-row';
import { colors, spacing, type } from '@/theme/tokens';

export default function YouScreen() {
  return (
    <ComingSoon title="You" description="Settings and memories are not built yet.">
      <DemoControlsRow />
      {DEV_EDITOR_ENABLED ? (
        <Link href="/dev/companions" style={styles.devLink}>
          <Text style={styles.devText}>Dev: character editor</Text>
        </Link>
      ) : null}
    </ComingSoon>
  );
}

const styles = StyleSheet.create({
  devLink: { marginTop: spacing.xxl },
  devText: { ...type.secondary, color: colors.accent },
});

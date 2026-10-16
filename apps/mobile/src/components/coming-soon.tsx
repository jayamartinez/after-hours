import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, type } from '@/theme/tokens';

interface ComingSoonProps {
  title: string;
  description: string;
  children?: ReactNode;
}

/** Placeholder for tabs that are not built yet. Clearly labeled; never presented as working. */
export function ComingSoon({ title, description, children }: ComingSoonProps) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={type.displayM}>{title}</Text>
      <View style={styles.body}>
        <Text style={type.label}>Coming soon</Text>
        <Text style={type.secondary}>{description}</Text>
      </View>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xxl,
  },
  body: { marginTop: spacing.xxl, gap: spacing.sm },
});

import { Platform, StyleSheet, Switch, View } from 'react-native';

import { colors } from '@/theme/tokens';

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

/** Platform switch styled to the Paper settings row: linen track and dark knob when on. */
export function Toggle({ value, onChange, label }: ToggleProps) {
  // A fixed, centered box: iOS 26 draws the switch taller than React Native measures it,
  // which pushed it above the row's center.
  return (
    <View style={styles.box}>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.text, false: colors.hairline }}
        thumbColor={value ? colors.bg : colors.textMuted}
        ios_backgroundColor={colors.hairline}
        {...(Platform.OS === 'web' ? { activeThumbColor: colors.bg } : null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 32, minWidth: 52, alignItems: 'center', justifyContent: 'center' },
});

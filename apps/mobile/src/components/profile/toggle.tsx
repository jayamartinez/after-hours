import { Platform, Switch } from 'react-native';

import { colors } from '@/theme/tokens';

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

/** Platform switch styled to the Paper settings row: linen track and dark knob when on. */
export function Toggle({ value, onChange, label }: ToggleProps) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      accessibilityLabel={label}
      trackColor={{ true: colors.text, false: colors.hairline }}
      thumbColor={value ? colors.bg : colors.textMuted}
      ios_backgroundColor={colors.hairline}
      {...(Platform.OS === 'web' ? { activeThumbColor: colors.bg } : null)}
    />
  );
}

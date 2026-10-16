import { StyleSheet, View } from 'react-native';

import { chatColors } from './chat-tokens';

/**
 * The "lamplight": a soft brass glow over the header (Paper: 300×320 brass at 13%, blur 70,
 * centered at the top edge). A radial gradient renders the same falloff on iOS and web
 * without a blur filter.
 */
export function LampGlow() {
  return <View pointerEvents="none" style={styles.glow} />;
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: -250,
    alignSelf: 'center',
    width: 440,
    height: 460,
    backgroundImage: `radial-gradient(ellipse closest-side, ${chatColors.lampGlow} 0%, ${chatColors.lampGlow} 35%, ${chatColors.lampGlowEdge} 100%)`,
  },
});

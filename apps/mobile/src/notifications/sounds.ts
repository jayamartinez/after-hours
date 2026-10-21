import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import replySound from '../../assets/sounds/reply.wav';
import sendSound from '../../assets/sounds/send.wav';

import { notificationsStore } from './instance';

/** The two message sounds (D-046), made for After Hours by `scripts/make-sounds.mjs`. */
const SOURCES = { send: sendSound, reply: replySound } as const;

export type SoundName = keyof typeof SOURCES;

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let modeSet = false;

/** One reused player per sound, created on first use. */
function player(name: SoundName): AudioPlayer {
  const existing = players[name];
  if (existing) return existing;
  const created = createAudioPlayer(SOURCES[name]);
  created.volume = name === 'send' ? 0.5 : 0.7;
  players[name] = created;
  return created;
}

/** Plays a message sound unless sounds are off. Silent when the phone's ring switch is off. */
export function playSound(name: SoundName) {
  if (!notificationsStore.getState().soundsOn) return;
  try {
    if (!modeSet) {
      modeSet = true;
      // Sound effects: mix with music, and stay quiet on silent like a messaging app.
      void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(
        () => {},
      );
    }
    const sound = player(name);
    void sound.seekTo(0).then(
      () => sound.play(),
      () => sound.play(),
    );
  } catch (error) {
    // A missing audio device must never break chat.
    console.warn('[sounds] Could not play a message sound.', error);
  }
}

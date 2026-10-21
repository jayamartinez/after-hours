/**
 * App-level copy for discovery and profile screens. Companion-specific words (name,
 * pronouns) always come from character config; only the sentence frames live here.
 */

interface CopySubject {
  name: string;
  pronouns: { subject: string; object: string };
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export const mightOpenWith = (c: CopySubject) =>
  `${capitalize(c.pronouns.subject)} might open with`;

export const memoriesSubline = (c: CopySubject) =>
  `Only what you’ve told ${c.pronouns.object}. Edit or forget anything.`;

/** Empty memory list: nothing has been remembered yet. */
export const memoriesEmpty = (c: CopySubject) => ({
  title: 'Nothing remembered yet',
  detail: `Tell ${c.pronouns.object} about your day. What matters shows up here, and you can forget anything.`,
});

export const clearConversationSubline = (c: CopySubject) =>
  `Deletes your messages with ${c.name}. Memories stay.`;

export const startTalking = (c: CopySubject) => `Start talking to ${c.name}`;

/** "Tonight’s cast · Thursday" (uppercased by the label style). */
export const castEyebrow = (date: Date) =>
  `${LABELS.castEyebrow} · ${date.toLocaleDateString('en-US', { weekday: 'long' })}`;

/** Two-digit cast number: "No. 01". */
export const castNumber = (index: number) => `No. ${String(index + 1).padStart(2, '0')}`;

/** Static labels shared by discovery and profile. */
export const LABELS = {
  appName: 'After Hours',
  seeAll: 'See all',
  comingSoon: 'coming soon',
  comingSoonTitle: 'Coming soon',
  voiceSample: 'Voice sample',
  banter: 'Banter',
  depth: 'Depth',
  pace: 'Pace',
  castEyebrow: 'Tonight’s cast',
  castTitle: 'Who’s up tonight?',
  castSubline: 'Pick someone to talk to. Switch whenever.',
  castFootnote: 'AI-generated parody characters.',
  message: 'Message',
  call: 'Call',
  voiceNote: 'Voice note',
  photos: 'Photos',
  seeGallery: 'See gallery',
  clearConversation: 'Clear conversation',
  callSoon: 'Calls are coming soon.',
  voiceNoteSoon: 'Voice notes are coming soon.',
} as const;

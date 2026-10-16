/**
 * App-level copy for discovery and profile screens. Companion-specific words (name, pronouns,
 * status, place) always come from character config; only the sentence frames live here.
 */

interface CopySubject {
  name: string;
  statusLine: string;
  locationShort: string;
  pronouns: { subject: string; object: string };
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** "Shipping until sunrise · South Calder" (rendered uppercase by the label style). */
export const statusWithPlace = (c: CopySubject) => `${c.statusLine} · ${c.locationShort}`;

export const mightOpenWith = (c: CopySubject) =>
  `${capitalize(c.pronouns.subject)} might open with`;

export const lineTheyMightSend = (c: CopySubject) => `A line ${c.pronouns.subject} might send`;

export const memoriesSubline = (c: CopySubject) =>
  `Only what you’ve told ${c.pronouns.object}. Edit or forget anything.`;

export const proactiveSubline = (c: CopySubject) =>
  `${capitalize(c.pronouns.subject)} can text you first, sometimes`;

export const iMessageLabel = (c: CopySubject) => `Text ${c.pronouns.object} on iMessage`;

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
  memoriesEmpty: 'Memories appear after you chat',
  memoriesEmptyDetail: 'Nothing is saved yet. Once chats are saved, what you share shows up here.',
  proactive: 'Proactive messages',
  iMessageValue: 'Off',
  clearConversation: 'Clear conversation',
  clearUnavailable: 'Available once chats are saved',
  callSoon: 'Calls are coming soon.',
  voiceNoteSoon: 'Voice notes are coming soon.',
  voiceSoon: 'Voice samples are coming soon.',
  moreSoon: 'More options are coming soon.',
  iMessageSoon: 'The iMessage bridge is coming soon.',
} as const;

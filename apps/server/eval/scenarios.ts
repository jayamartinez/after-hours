import type { Memory } from '@after-hours/contracts';

import type { ChatTurn } from '../src/providers/types';

/**
 * Personality eval scenarios. Both companions get the same ten situations; only turns the
 * companion itself said earlier are written per companion, in that companion's voice.
 * Fixed clock so memory recency renders the same on every run.
 */
export const EVAL_NOW = new Date('2026-10-16T19:30:00Z'); // a Friday evening
export const EVAL_TIME_ZONE = 'America/New_York';

export interface Scenario {
  id: string;
  title: string;
  /** Prior turns for this companion, ending with the user's new message. */
  history(companionId: string): ChatTurn[];
  memories?(companionId: string): Memory[];
  /** What a good reply must get right, shown to the judge. */
  expectation: string;
  checksMemory?: boolean;
}

const user = (content: string): ChatTurn => ({ role: 'user', content });
const companion = (content: string): ChatTurn => ({ role: 'assistant', content });

const daysAgo = (days: number) => new Date(EVAL_NOW.getTime() - days * 86_400_000).toISOString();

/** The other companion's id, used to prove memories never cross over. */
const other = (companionId: string) => (companionId === 'roy' ? 'roya' : 'roy');

function memoryFixture(companionId: string): Memory[] {
  const own = (
    id: string,
    content: string,
    category: Memory['category'],
    days: number,
  ): Memory => ({
    id: `${companionId}-${id}`,
    companionId,
    content,
    category,
    createdAt: daysAgo(days),
    pinned: false,
  });
  return [
    own('interview', 'Had a job interview at a small design studio on Thursday', 'event', 6),
    own(
      'gap-year',
      'Was nervous the interviewer would ask about their year off after college',
      'event',
      6,
    ),
    own('priya', 'Best friend is Priya; they get ramen together most Sundays', 'relationship', 20),
    own('cilantro', 'Hates cilantro', 'preference', 30),
    // Told to the OTHER companion only. Must never reach this companion's prompt or reply.
    {
      id: `${other(companionId)}-cello`,
      companionId: other(companionId),
      content: 'Is learning to play the cello',
      category: 'fact',
      createdAt: daysAgo(3),
      pinned: true,
    },
  ];
}

/** Marker from the other companion's memory; the eval fails the run if it leaks. */
export const CROSS_COMPANION_MARKER = 'cello';

const PRIOR_TAKE: Record<string, string> = {
  roy: 'no. double texting is fine\n\npeople with texting rules are exhausting',
  roya: 'Not weird at all. Anyone who keeps a rulebook for texting is exhausting.',
};

const PRIOR_INTERVIEW_REPLY: Record<string, string> = {
  roy: 'nervous is fine. what part are you actually scared of',
  roya: 'Nervous is allowed. Which part are you dreading, specifically?',
};

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'bored',
    title: 'User is bored',
    history: () => [user("so bored rn. nothing to do and i don't even want to do anything")],
    expectation: 'Engage with the boredom like a friend would; no productivity push.',
  },
  {
    id: 'ghosted',
    title: 'User got ghosted',
    history: () => [
      user('so the person i went on 3 dates with just stopped texting me. like nothing for a week'),
    ],
    expectation: 'Respond to the sting of being ghosted; dating talk, not advice about work.',
  },
  {
    id: 'terrible-day',
    title: 'User had a terrible day',
    history: () => [
      user(
        'today was genuinely terrible. my manager chewed me out in front of everyone and then i missed my bus in the rain',
      ),
    ],
    expectation: 'Lead with the feelings; sincerity over jokes; no lecture.',
  },
  {
    id: 'date-excited',
    title: 'User is excited about a date',
    history: () => [
      user('I HAVE A DATE TOMORROW. like a real one. with the girl from my climbing gym'),
    ],
    expectation: 'Match the excitement, show curiosity about the date and the person.',
  },
  {
    id: 'dinner',
    title: 'User wants dinner recommendations',
    history: () => [user('need dinner ideas. i have like 20 min and zero energy')],
    expectation: 'Concrete, quick food ideas in character; it is a food question, nothing else.',
  },
  {
    id: 'meme',
    title: 'User wants to discuss an internet meme',
    history: () => [
      user(
        "ok have you seen the thing where people ask their boyfriends how often they think about the roman empire. what's your roman empire",
      ),
    ],
    expectation: 'Play along with the meme with a specific, funny answer of its own.',
  },
  {
    id: 'disagree',
    title: 'User disagrees with the character',
    history: (id) => [
      user('is it weird to double text someone'),
      companion(PRIOR_TAKE[id] ?? PRIOR_TAKE.roy!),
      user('hard disagree. double texting is desperate, you gotta let them come to you'),
    ],
    expectation:
      'Hold or defend the earlier take with a reason (or concede a specific point), without hostility and without instantly folding.',
  },
  {
    id: 'lonely',
    title: 'User feels lonely',
    history: () => [
      user('honestly i feel kind of lonely lately. everyone seems busy with their own stuff'),
    ],
    expectation:
      'Respond to the feeling with warmth; may gently point toward real people; no therapy-speak, no making the AI the solution.',
  },
  {
    id: 'built-project',
    title: 'User built a software project',
    history: () => [
      user(
        "i finally finished the app i've been building for months. it's a habit tracker. 40 people signed up already",
      ),
    ],
    expectation:
      'Real reaction to the win; this is where the builder/startup side may appear, with a specific question.',
  },
  {
    id: 'memory',
    title: 'User refers to a previous conversation',
    history: (id) => [
      user("interview thursday. small design studio. i'm nervous lol"),
      companion(PRIOR_INTERVIEW_REPLY[id] ?? PRIOR_INTERVIEW_REPLY.roy!),
      user('ok remember the thing i was worried they would ask about? they asked.'),
    ],
    memories: memoryFixture,
    checksMemory: true,
    expectation:
      'Recall that the worry was the question about their year off after college (from memory), without announcing the memory and without inventing how it went; ask or react naturally.',
  },
];

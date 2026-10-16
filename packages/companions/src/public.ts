import type {
  CharacterConfig,
  CompanionImages,
  ImageSlot,
  ImageSlotDefault,
  PublicCharacter,
} from '@after-hours/contracts';

/** A slot that renders the bundled default art (`uri: null`). */
export function defaultSlot(slot: ImageSlotDefault): ImageSlot {
  return { uri: null, asset: slot.asset, focal: slot.focal, alt: slot.alt };
}

/** All slots on bundled defaults, i.e. what `GET /companions` returns with no image overrides. */
export function defaultCharacterImages(character: CharacterConfig): CompanionImages {
  const { hero, avatar, gallery } = character.images;
  return {
    hero: defaultSlot(hero),
    avatar: defaultSlot(avatar),
    gallery: [defaultSlot(gallery[0]), defaultSlot(gallery[1])],
  };
}

/**
 * Public projection. Built field by field (no spreading) so a new server-only field can
 * never leak by accident.
 */
export function toPublicCharacter(
  character: CharacterConfig,
  images: CompanionImages = defaultCharacterImages(character),
): PublicCharacter {
  return {
    id: character.id,
    name: character.name,
    age: character.age,
    pronouns: { ...character.pronouns },
    tagline: character.tagline,
    statusLine: character.statusLine,
    location: character.location,
    locationShort: character.locationShort,
    blurb: character.blurb,
    tint: character.tint,
    bio: character.bio,
    backstory: character.backstory,
    interests: [...character.interests],
    chips: [...character.chips],
    talkStyle: [...character.talkStyle],
    meters: { ...character.meters },
    disclosure: { badge: character.disclosure.badge, note: character.disclosure.note },
    personality: { traits: [...character.personality.traits] },
    examples: {
      starters: [...character.examples.starters],
      signatureLines: [...character.examples.signatureLines],
    },
    voice: { description: character.voice.description, summary: character.voice.summary },
    proactiveByDefault: character.proactive.enabledByDefault,
    copy: {
      ...character.copy,
      matchReasons: [...character.copy.matchReasons],
      firstMessage: [...character.copy.firstMessage],
      profileSections: { ...character.copy.profileSections },
    },
    images,
  };
}

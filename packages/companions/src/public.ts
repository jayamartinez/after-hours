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
 * Public projection: identity, `publicProfile`, the proactive default, and images. Built
 * field by field (no spreading) so a new server-only field can never leak by accident.
 */
export function toPublicCharacter(
  character: CharacterConfig,
  images: CompanionImages = defaultCharacterImages(character),
): PublicCharacter {
  const { pronouns, disclosure, publicProfile: profile } = character;
  const { copy } = profile;
  return {
    id: character.id,
    name: character.name,
    age: character.age,
    pronouns: {
      subject: pronouns.subject,
      object: pronouns.object,
      possessive: pronouns.possessive,
    },
    tint: character.tint,
    disclosure: { badge: disclosure.badge, note: disclosure.note },
    publicProfile: {
      chips: [...profile.chips],
      meters: {
        banter: profile.meters.banter,
        depth: profile.meters.depth,
        pace: profile.meters.pace,
      },
      voiceSummary: profile.voiceSummary,
      matchTags: [...profile.matchTags],
      starters: [...profile.starters],
      about: profile.about,
      copy: {
        spotlightCta: copy.spotlightCta,
        revealHeadline: copy.revealHeadline,
        revealSubline: copy.revealSubline,
        revealCta: copy.revealCta,
        matchReasons: [...copy.matchReasons],
        firstMessage: [...copy.firstMessage],
        sampleOpener: copy.sampleOpener,
        voiceLabel: copy.voiceLabel,
        profileSections: {
          remembers: copy.profileSections.remembers,
          photos: copy.profileSections.photos,
        },
      },
    },
    proactiveByDefault: character.proactive.enabledByDefault,
    images,
  };
}

# After Hours — design brief

Status as of 2026-10-16. **Approved baseline (revision v3, 2026-10-16, pending Gate A2):** chat Lamplight (primary; Chat B archived); discovery Spotlight card (primary, Companions tab, swipe Roy ↔ Roya). The Cast List is a secondary browse state. See `docs/decisions.md`, D-014. Revised Roy & Roya character designs await Gate A2 (D-016).

## Purpose

After Hours is a premium AI companion app. Users text, call, and share images with a distinct, fictional AI character over time. The design must feel intimate and editorial, never like a generic AI tool. Every companion is disclosed as an AI parody and as a fictional adult (23, PG-13). Target: iPhone first, with a browser demo from the same app.

## Mood

"Hotel bar after last call."

- Lacquered dark wood, brass lamp light, oxblood leather booth, linen napkin, a dark window at night.
- Warm, restrained, editorial. One intense color moment (brass) per screen.
- Not neon, not SaaS, not an Apple Messages clone.

## Palette

| Token | Hex | Role |
|---|---|---|
| `--color-bg` | #0F0D0C | Default screen ground |
| `--color-surface` | #1A1614 | Companion bubble, cards |
| `--color-surface-raised` | #252019 | Raised cards, sheets |
| `--color-hairline` | #3A322C | 1px borders, dividers |
| `--color-text` | #F2EBE1 | Primary text (linen) |
| `--color-text-muted` | #A99E92 | Secondary text (smoke) |
| `--color-accent` | #E2A55B | Brass: primary CTA, user bubble, one moment per screen |
| `--color-on-accent` | #1A1208 | Text on brass |
| `--color-live` | #7A2431 | Oxblood: recording, live, destructive |
| `--color-window` | #6F86A6 | Roy's tint (window blue to ink); info |
| `--color-danger` | #E0614F | Errors |
| `--color-paper` | #F6F1EA | Light chat direction only |
| `--color-paper-ink` | #1B1715 | Text on paper, light direction only |

## Typography

- Display: Instrument Serif, 400 regular and italic only. Letter-spacing -0.02em. Line-height about 1.0 to 1.08.
- UI: Inter, 400, 500, 600. Avoid 700 and above except tiny numerals.
- Use px for sizes and line-height, em for letter-spacing.

| Style | Size | Font and weight | Notes |
|---|---|---|---|
| label | 11 | Inter 500/600 | ALL CAPS, tracking 0.12em, smoke |
| caption | 13 | Inter 400 | Timestamps, receipts |
| secondary | 15 | Inter 400 | Sublines |
| body | 17 / 24 line-height | Inter 400 | Chat text |
| title | 24 | Inter 600 or serif | Section titles |
| display-s | 32 | Instrument Serif | Headings |
| display-m | 44 | Instrument Serif | Screen headlines |
| display-l | 64 | Instrument Serif | Welcome and reveal |

## Spacing, radius, gutters

- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 48, 64.
- Radius: sm 6, md 12, bubble 20 (6px on the tail corner), lg 28, pill.
- Screen gutter: 20px.

## Device and layout

- Artboards: 393 × 852 (iPhone 15/16).
- Status bar recolored for the dark ground. Content starts below about 59px.
- Bottom CTA sits above the about 34px home indicator.
- Tap targets at least 44px.
- Dark ground by default. The light paper direction is chat-only and must be approved separately.

## Components

- **Primary CTA:** full-width pill, 56px high, brass fill, on-accent Inter 600 17.
- **Secondary:** transparent, 1px hairline border, linen text.
- **Tertiary:** text link in smoke.
- **Companion bubble:** surface fill, linen 17/24, radius 20 with 6px tail corner, max width about 75%.
- **User bubble:** brass fill, on-accent text.
- **Read receipt:** "Read 11:42 PM", 13px smoke, under the last user bubble.
- **Typing indicator:** three 6px dots in a surface bubble.
- **Chips:** pill, 36 to 40px high, hairline border. Selected: brass border with brass text, or brass fill.
- **AI disclosure pill:** 11px caps "AI PARODY", hairline border, beside every companion name in headers and profiles.
- **Labels:** 11px caps, Inter 600, tracking 0.12em, smoke.
- **Icons:** 1.5px-stroke inline SVG, linen or smoke. No emoji as icons.
- **Floating pill tab bar, slim progress bar, back chevron, large titles, dark settings list with round icon wells.**

## Companions

Only two companion presets exist. Both are fictional AI parody characters: the personas never claim to be, speak as, or quote the real person they parody, and the only place that person is named is the non-affiliation note below. No real companies, schools, products, or quotes. Content is PG-13.

Neither companion has an invented biography, tagline, status line, or fictional place (D-024). Screens show temperament, not lore.

**Roy, 23.** Parody informed by a founder's public persona.
- Personality: blunt, quick, competitive, opinionated. Underneath: genuinely in your corner. Into tech and building, but only talks about it when you do.
- Texting: quick lowercase reactions, strong opinions.
- Voice: "Fast, bright tenor — always mid-pitch".
- Look: messy black hair, oversized charcoal hoodie, laptop glow.
- Tint: `--color-window` (window blue to ink); brass only as a thin CTA accent.

**Roya, 23.** Original character with her own temperament.
- Personality: dry humor, teasing, perceptive; flirts back (playful, never explicit).
- Texting: polished sentences with a raised eyebrow.
- Voice: "Smoky, amused mezzo — always half-laughing".
- Look: sharp black bob, oversized cream blazer, gold hoop earrings, warm lamp light.
- Tint: brass to oxblood (lamplight).

**Profile screen (D-024).** Hero: portrait with the existing scrims, back and options glass buttons, name, AI PARODY badge, and age (no status line or tagline). Then the action row (Message, Call, Voice note, Photos). Then only functional sections: "What he remembers", Photos (two images and "See gallery"), the settings card, and the disclosure footer. No About, talk-style, or voice sections on the page; the options (⋯) button opens an About sheet with `publicProfile.about` (two or three plain sentences on temperament) and the disclosure note. The Spotlight card, Cast List, preview sheet, and chat header likewise drop status lines, taglines, blurbs, and places; the chat header shows avatar, name, and badge.

**Disclosure copy (exact):**
- Badge: "AI PARODY" beside the name in chat headers and profiles.
- Profile footer (one short note, both companions): "AI-generated parody. Not affiliated with or endorsed by Roy Lee."
- Onboarding welcome caption: "AI-generated parody characters. 18+."
- No disclaimer in the chat first message.

Companion text and images on every screen come from character config. Designs show the Roy and Roya presets.

**Art:** original stylized editorial illustration, gouache and grain texture, warm cinematic lamplight, muted palette, painterly, not photorealistic, fictional character, no text in images. Generated in Paper under authorization (D-013 lifted 2026-10-15; see D-016 for design approval). Must not depict or resemble a real person.

### Image slots

Companion art is supplied per slot. Each slot has a fixed ratio; only the source image and focal point are configurable.

| Slot | Ratio | Focal (x, y) | Used in |
|---|---|---|---|
| `roy.hero` | 3:4 | 0.50, 0.30 | Spotlight card, profile hero, onboarding welcome and reveal |
| `roy.avatar` | 1:1 | 0.50, 0.26 | Chat header, thumbnails |
| `roy.gallery.0` | 4:5 | 0.55, 0.45 | Chat image bubbles, profile photo 1 (desk) |
| `roy.gallery.1` | 4:5 | 0.50, 0.35 | Profile photo 2 (rooftop) |
| `roya.hero` | 3:4 | 0.55, 0.32 | Spotlight card, profile hero, onboarding welcome and reveal |
| `roya.avatar` | 1:1 | 0.55, 0.28 | Chat header, thumbnails |
| `roya.gallery.0` | 4:5 | 0.50, 0.40 | Chat image bubbles, profile photo 1 (bar counter) |
| `roya.gallery.1` | 4:5 | 0.55, 0.35 | Profile photo 2 (night walk) |

- **Crop rule:** cover fit with `object-position` at the focal point. The same source is used for a slot everywhere it appears.
- **Annotation rule:** slot labels and crop specs live only in the Paper annotations outside the screens. Screens show finished default art with no labels or spec text.
- **Galleries rule:** exactly two gallery images per companion (`gallery.0`, `gallery.1`).
- **Source rule:** defaults are original painted art. Overrides come from the git-ignored manifest `config/companion-assets.local.json` or `PRIVATE_ASSETS_DIR`; see `docs/architecture.md`, "Companion image slots".

## Copy principles

- Concise, warm, a little wry.
- Never invent statistics, studies, user counts, or ratings.
- Never shame or guilt users. Never imply the AI should replace human relationships. Position it as a companion.
- AI identity always clear: onboarding, discovery, profile, and chat header.
- No real brands, logos, or third-party copy.

## Reference analysis

Reference screens were studied for patterns only. They are third-party screenshots, used as inspiration. Nothing is copied.

- **Borrow:** one idea per screen; big headline, muted subline, bottom pill CTA; slim progress bar and back chevron; typographic interstitials; full-bleed color moments (we use brass on ink); honest proof objects (our own UI previews, the user's answers, memory cards); collage hero on welcome; floating pill tab bar; large titles; dark settings list with round icon wells.
- **Avoid:** fake citations or stats; negative-identity pressure; ten or more near-identical stat screens; low-contrast grey-on-grey text; bloated tool grids.
- The reference set has no paywall screens and only one generic support-chat screen. The paywall and chat designs are original exploration.

## Paper file map

File: "after hours" (fileId `01M51A6HFBBNMJYXYPHQBK9S99`).

| Page | Purpose |
|---|---|
| References (`p-1-0`) | Read-only. Never edit, move, or delete. |
| 01 Foundations (`p-3-0`) | Tokens, core components, and the "Image slots — spec" board |
| 02 Chat directions (`p-7-0`) | Chat A "Lamplight" (primary); Chat B "Late Edition" (archived alt, captions suffixed "· archived alt") |
| 03 Discovery directions (`p-6-0`) | Discovery A "Spotlight" (primary, Companions tab; "Spotlight · Roy expanded" board); Discovery B "The Cast List" (secondary browse state) |
| 04 Onboarding (`p-5-0`) | Onboarding flow |
| 05 Core screens (`p-4-0`) | Core app screens |

## Onboarding narrative

1. Welcome (collage hero, logo, primary CTA)
2. Interstitial (typographic)
3. Looking for
4. When you talk
5. Texting style, with live preview
6. What matters
7. Dynamic pad
8. Voice or text
9. Memory explained
10. Matching moment (brass full-bleed)
11. Reveal (companion introduction, AI disclosure)
12. First message (the real Lamplight chat; 2 free messages, then the paywall; D-021)
13. Paywall (demo state, labeled as demo)
14. Confirmed
Plus: replay entry in settings, and a debug sheet for design review.

## Approval

- Approved baseline (revision v3, 2026-10-16, pending Gate A2): chat Lamplight (dark, primary; Chat B archived); discovery Spotlight card (primary, Companions tab, swipe Roy ↔ Roya). The Cast List is a secondary browse state. The Spotlight card style also governs the onboarding reveal and profile hero.
- Revised Roy & Roya designs (v3): pending Gate A2 (D-016). Implementation waits for that approval.
- This brief is frozen. Later visual changes need a new decision entry in `docs/decisions.md`. Since freezing: D-021 (onboarding polish), D-024 (profile simplification, no character lore on any screen).

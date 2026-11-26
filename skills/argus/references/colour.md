# Colour, shape, depth and texture

Contents: **Choosing colour** (C1-C7) · **Tokens** (C8-C11) · **Shape** (C12-C14) · **Depth, light, texture** (C15-C19) · **Tests** (C20-C22).

Ratios are in `craft.md`, the photo grade in `pictures.md`. Checker prompts (`radius-sprawl`, `many-hues`, `colour-flood`, `pure-black-white`, `raw-colours`) ask you to confirm a choice; none is a failure by itself.

## Choosing colour

**C1. Take each hue from a named thing in the subject's world and write it beside the value:** a tool handle's green, a repair tag's orange, the sauce's red. Why: swatch habits are what every model reaches for.

**C2. A ground, an ink and one accent from the product or its main picture,** for the primary action, the current selection and one or two emphases. A second accent needs a written reason. Why: a page with four competing hues has no emphasis; colours sampled from the picture make picture and page one thing.

To sample: `node "<skill>/scripts/photos.js" palette <main-picture>` prints its 5-8 dominant colours in hex and OKLCH, and suggests a ground (the picture's largest light or dark area, lightened or darkened, chroma kept under about .02), an ink (near-black or near-white tinted with the picture's shadows or highlights) and an accent (its most colourful real area, moved in lightness until it reads on the ground), each with its contrast ratio. Check the three beside the picture and adjust by eye; a picture with no colourful area gives no accent, so take it from the World line. With no picture at all, the World line (`ideas.md`) names the material the three come from.

**C3. Colour belongs to objects and states, not interface paint:** the accent marks the action and what is selected; tinted "-soft" panels behind every badge are paint. Why: colour with a meaning is remembered.

**C4. The ground suits the direction.** White or a neutral near-white lets photographs and one accent carry the colour; a tint from the subject (chroma about 0.008-0.02 in the source's hue, or sampled from the main photograph's white) matches the picture; a committed colour or a dark ground suits a brand or a subject that owns one. Cream and off-white are one option, not the calm default: cream with a serif headline and small caps labels is today's commonest generated look (`faults.md`). Why: the ground is a choice for this page, not a house default.

**C5. Light or dark comes from where and when the thing is used, or from the photographs,** never for drama alone. Strategy per direction: neutral with one accent (the default); paper and ink; dark (the thing is used at night or in the dark, or the photographs are dark; reason written); two-colour (a pairing with meaning); categorical (kinds to tell apart); committed ground (deep or muted enough for 4.5:1 body text, with a neutral and an accent that is not its tint; never a bright pastel over the whole page). Why: decide how much colour carries before any value.

**C6. Across a set:** the deal gives directions different ground families (light, dark, colour) unless the owner's taste is light or dark; at most one pairs a light ground with a serif display. One colour mode on the web unless the system has two or the user asks; a second mode is its own values, not an inversion. Status never by colour alone. Why: the set differs inside the owner's taste.

**C7. A feeling word is not a hue.** "Warm" may be cream, a deep green, ink blue on paper, or warm photographs; choose from the subject, not the word. Why: otherwise every warm brief is one page.

## Tokens

Build against names, not raw values, so the page inherits one system and the next person can extend it. Fill in only the roles the design uses, once, as CSS custom properties or the project's token form; `DESIGN.md` records the values under these names:

| Group | Roles |
|---|---|
| Surface | `bg`, `surface` (cards, menus, drawers), `surface-alt` if the page has a contrasting band |
| Text and line | `fg`, `muted`, `on-accent`; `border` (ink at 12-18%), `border-strong` |
| Accent and status | `accent`, `accent-press`, `accent-on-ink`; `success`, `warning`, `danger`, each with a readable text pairing |
| Type | `font-display`, `font-body`, `font-data` only if figures align; sizes `fs-hero` to `fs-label` (`type.md`, T12) |
| Space and shape | the space scale (`layout.md`, L6); `radius-control`, `radius-surface`, `radius-frame` if the subject gives one |
| Depth and motion | `shadow-mid`, `shadow-high` where depth helps; the names in `assets/snippets/motion-tokens.css` |

**C8. Tokens in OKLCH, fallbacks first, derived roles after:**

```css
:root { --c-ground: #efede7; --c-ink: #1c1a17; --c-accent: #b3311e;
  --border: rgb(28 26 23 / .15); --accent-press: #962817; --accent-on-ink: #e8664f; }
@supports (color: oklch(from red l c h)) { :root {
  --c-ground: oklch(94.5% .012 85);   /* the white of the plate */
  --c-ink: oklch(21% .012 60);
  --c-accent: oklch(52% .17 32);      /* the label's red */
  --border: color-mix(in oklab, var(--c-ink) 15%, transparent);
  --accent-press: oklch(from var(--c-accent) calc(l * .85) c h);
  --accent-on-ink: oklch(from var(--c-accent) calc(l + .15) calc(c * .9) h); } }
:root { --bg: var(--c-ground); --fg: var(--c-ink); --accent: var(--c-accent); }
```

Why: OKLCH steps are even, so derived states keep their hue; relative colour is in every engine since 2024.

**C9. Lines are the ink at 12-18% alpha** (`color-mix(in oklab, var(--fg) 15%, transparent)`). Why: they work on every ground, the dark one included.

**C10. A dark section swaps roles** (the same role names, redefined on that section):

```css
.is-ink { --bg: var(--c-ink); --fg: var(--c-ground); --accent: var(--accent-on-ink);
  --border: color-mix(in oklab, var(--c-ground) 16%, transparent);
  color-scheme: dark; background: var(--bg); color: var(--fg); }
```

A dark band or finale is one option for pacing a long page, not a requirement. A site that needs two modes uses `light-dark()`. Why: inversion breaks the accent.

**C11. A display-p3 accent is optional,** inside `@supports (color: color(display-p3 1 0 0))`, on the accent only. Why: richer where screens allow.

## Shape

**C12. One shape system, held everywhere:** square throughout; softened 2-4px; rounded 8-16px surfaces with matching or pill controls; square surfaces with pill controls; or a frame from the subject (an arch, a ticket notch) with the rest square or softened. Each is fine; mixing them is not. Why: one hand.

**C13. At most three radii, all tokens** (`radius-control`, `radius-surface`, `radius-frame`; `radius-sprawl`); inner radius is outer minus padding. Why: nine raw radii read as parts from different kits.

**C14. One edge treatment per page:** hairlines, borderless filled surfaces, soft cards, or heavy borders. Why: mixed edges look accidental.

## Depth, light, texture

**C15. Shadows where they help:** a card that is a thing (a plan, a booking, a product) may sit on a soft shadow; menus, drawers and dragged items lift higher. Keep one light source and few levels. Why: depth tells the visitor what is a separate object; the same heavy shadow under everything is noise.

**C16. A layered shadow reads as light,** one light source, offsets 1:2, in the ground's hue:

```css
:root { --sh: rgb(60 40 20 / .33); --sh-hi: rgb(60 40 20 / .2); }
@supports (color: oklch(from red l c h)) { :root {
  --sh: oklch(from var(--c-ground) calc(l * .4) calc(c * .7 + .02) h / .33);
  --sh-hi: oklch(from var(--c-ground) calc(l * .4) calc(c * .7 + .02) h / .2); } }
:root { --shadow-mid: 1px 2px 2px var(--sh), 2px 4px 4px var(--sh), 3px 6px 6px var(--sh);
  --shadow-high: 1px 2px 2px var(--sh-hi), 2px 4px 4px var(--sh-hi), 4px 8px 8px var(--sh-hi),
    8px 16px 16px var(--sh-hi), 16px 32px 32px var(--sh-hi); }
```

Why: tinted layers read as light, black blur as a sticker.

**C17. Gradients do a job:** a scrim behind text on a photograph, daylight, distance, a soft edge, or a light following the pointer. Plain sRGB first, then `linear-gradient(to right in oklch, A, B)`; animate via `@property`. Never a material imitation. Why: sRGB greys out midway; material gradients look fake.

**C18. Grain is optional and static:** an SVG `feTurbulence` data URI or a 2-4KB 128px tile, opacity .04-.08, on a fixed pseudo-element with `pointer-events: none`; never a live filter on a scrolling element. Why: live filters make Safari scroll slowly.

**C19. One treatment for every photograph** (`pictures.md`, "One set"). Why: the page and the product carry the colour together.

## Tests

**C20. Greyscale:** `html { filter: grayscale(1) }` on a capture; the hierarchy survives. Why: else the order depends on hue alone.

**C21. Squint:** the accent reads as a few spots per screen, the action first among them. Why: an accent everywhere is none.

**C22. WCAG 2.2 is the gate** (`craft.md`, a floor rule); APCA only as a second opinion. Check text on the accent, on any dark band and on photographs (against the pixels). Why: WCAG 3 contrast is still undecided in 2026.

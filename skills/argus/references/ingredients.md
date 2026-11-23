# Ingredients

Raw material for a new direction: the set of tokens every design fills in, and the options for each choice. Read it at `create.md` step 2, when choosing which directions to build, and use it again at step 5, when writing the direction.

This is a list of ingredients, not a menu of finished looks. A fixed set of ready-made styles makes every page one of a handful. Here each choice is made separately, to suit the subject, and the combination is recorded so it is not repeated.

## The token contract

Every direction fills in the same named roles. Building against names instead of raw values is what makes a design consistent, and what lets the next person extend it.

| Group | Roles |
|---|---|
| Surface | `bg` (page), `surface` (raised: cards, panels), `surface-alt` (a contrasting band) |
| Text | `fg` (main text), `muted` (secondary text), `on-accent` (text on the accent) |
| Line | `border`, `border-strong` (control edges) |
| Accent | `accent` (the primary action and current selection), `accent-alt` only if the direction truly has two |
| Status | `success`, `warning`, `danger`, each with a readable text pairing |
| Type | `font-display`, `font-body`, and `font-data` only if there are figures to align |
| Size | a type scale by role (display, heading, subheading, body, small), not by number |
| Space | one base unit and its steps |
| Shape | `radius-control`, `radius-surface` |
| Motion | `duration-feedback`, `duration-transition`, `duration-reveal`, `stagger`, `ease-out` and `ease-in-out` (`craft.md`) |

Define them once (CSS variables, or the project's own token form) and use only the names below that point. A raw colour outside the token block is a defect.

- Fill in only the roles the design uses. A page with no status messages needs no status colours.
- A page whose ground changes from section to section (day to night, one colour band to the next) defines the same role names once per section, so each section is still built against names.

## Colour: choose a strategy, then find the hues

Decide how much colour the page carries before choosing any colour.

**The default shape: two neutrals and one accent.** A ground and an ink, both tinted (never pure white or pure black unless chosen for a reason), and one accent used sparingly: the primary action and one or two emphases. By area, most of it is the ground, a smaller share the ink and the neutral surfaces built from it, and the accent a small share kept for the things that matter. A second accent only with a stated reason. Most strong first screens are this shape with a big move on top; a whole page flooded with one warm hue is not.

| Strategy | What it is | Suits |
|---|---|---|
| **Neutral with one accent** | Tinted near-white or near-black surfaces; one colour for actions and a few emphases | Product UI; subjects where content brings the colour; the default |
| **Paper and ink** | A tinted off-white, a tinted near-black, and one spot colour used sparingly | Editorial, documents, craft, anything trusted |
| **Dark stage** | Deep ground, light text, one bright accent; colour comes from imagery or data | Things used at night or in the dark (a night callout, a stargazing night out); photo-led and media subjects |
| **Two-colour** | Two colours of similar weight, with neutrals, each given its own territory | A pairing with meaning: before and after, two audiences |
| **Categorical** | Several colours of equal weight, each standing for a category | Many kinds of thing that must be told apart |
| **Committed ground** | One strong colour covers the main surfaces | A confident brand that already owns a colour; a loud brief |

**Committed ground is not a default.** At most two directions in a set use it, and then in clearly different hues. Its ground must be deep or muted enough to carry long text at passing contrast, and it still needs a neutral and an accent that is not a tint of the ground. A pale bright ground (lemon, cream, sand) behind the whole page is the version to avoid.

**Dark stage is not a default either.** Dark is chosen from where and when the thing is used, never because it looks more dramatic. At most one direction in a set is dark, and it states its reason from how or when the thing is used. Where the kit has a ground of its own (a chalk slate, pattern paper, the white of a boarding card), start from that (`tells.md`).

**A feeling word is not a hue.** "Warm", "friendly", "playful", "approachable" do not mean yellow, cream, beige, kraft brown or amber; those are what every model reaches for, and they make every warm brief look the same (`tells.md`). Warmth can come from a deep green, a brick red, an ink blue on a warm paper, from rounded type, generous shapes and the wording. Decide what the feeling needs, then find the hue somewhere else.

**Take hues from specific things, and name them.** A colour picked up from a real object in the subject's world sits more naturally than one from a swatch list or the category's habits: the green of a particular tool handle, the orange of a repair tag, the blue of the local bus livery, the red of a vet's consent form. Write the thing next to the value in the direction. "Earthy" or "a warm orange" is not a source.

**Different across the set.** Directions shown together must not share a main hue family or a colour strategy; the one overlap allowed is two coloured grounds in clearly different hues. Their grounds differ visibly. At most one uses a pale neutral ground (off-white, cream, pale grey or grey-green, white included), however its accent differs: three pale grounds read as one page (`tells.md`, the paper artefact on off-white). At most one is dark. These limits make the set differ; they are not slots to fill. Never build a direction you would not pick yourself only to cover a ground or a strategy: replace it with the next candidate (`create.md` step 2). On a project with a `DESIGN.md`, also compare with what is recorded there (the current palette and "Tried") before settling; on a new project, compare the directions with each other.

Build the neutrals by tinting toward the accent's hue, or toward the ground's thing. Check every text pairing for contrast before settling (`craft.md`), including text on the accent and on any committed ground.

## Type: choose a character, then a face

Pick the character the subject calls for, then find a typeface with that character. The examples are starting points to widen the search, not a shortlist to pick from; prefer a face you have not used on this project.

| Character | Looks like | Suits |
|---|---|---|
| **Sturdy neutral sans** | Even, plain, legible small | Tools read all day; dense data |
| **Humanist sans** | Open shapes, visible stroke variation, warm | Health, education, services, anything that should feel human |
| **Geometric sans** | Circles and straight lines, modern, slightly cool | Technology, architecture, clean consumer brands |
| **Condensed or compressed** | Tall, tight, loud at display sizes | Posters, sport, news, a brief that says loud |
| **Wide or extended** | Broad letters, confident, slower to read | Luxury, automotive, short display lines |
| **Old-style or transitional serif** | Bookish, calm, authoritative | Long reading, publishing, law, heritage |
| **High-contrast serif** | Thick and thin strokes, elegant, fragile small | Fashion, culture, display only |
| **Slab serif** | Heavy square serifs, sturdy, friendly | Craft, food, practical trades |
| **Monospace** | Fixed width, technical | Code and aligned figures; as a voice only when the subject is technical |
| **Script or hand** | Written, personal | A signature or a note, in very small amounts; never a headline face unless the user supplied it |

**One display face per direction, used with conviction.** Each direction has one display face with real character, set at a size that commits (`craft.md` has the numbers), with its weight and tightness chosen on purpose, over a quiet body face. The first screen's headline is usually the largest thing on it, or second only to the picture. Directions in one set use display faces of different character: not three geometric sans, not three slab serifs, and at most one condensed all-capitals face. Where the subject has lettering of its own (a painted sign over a counter, a terminal's stencilled signs, a record label's type), look for the face there first; handwritten lettering is carried into a printed face, not set in a script or handwriting font. Legibility minimums (`craft.md`) still hold for everything else.

Pairings that work:

- **One family, two or three weights.** The safest and often the best; the plain register always uses it. Never more than two families or three weights on a page (`craft.md`).
- **Display with character over a neutral body.** The display face carries the voice; the body stays out of the way.
- **Serif with sans**, each given a clear job (headings and body, or body and interface).
- Avoid two faces of the same character. They look like a mistake.

Check the face has the weights, figures and languages the content needs, and that it is licensed for the project.

## The plain register

The plain direction (`create.md` step 2) fills the same roles with fewer, quieter choices, and its strength comes from the pictures:

- **Colour**: neutral with one accent. The ground is white or very near it, or the photograph itself edge to edge; white is a chosen ground here, not a default to avoid. The ink is a deep neutral. The one accent is taken from something in the photographs or the product and used on the primary button style and almost nothing else.
- **Type**: one family for everything, in two or three weights, with tight headline tracking (about -0.02em). It still differs in character from the other directions' display faces.
- **Shape**: one button style, fully round or about 4px corners, the same everywhere. Filled surfaces with no borders; flat or one soft shadow level.
- **Space**: airy. Sections about a screen tall, separated by space, not by rules or boxes.

Record it like any other: `Combination: plain, photograph-led; white + slate-blue accent + one humanist sans in 400/500/600 + round buttons, no borders, flat, airy`.

## Shape and space

| Choice | Options | Reads as |
|---|---|---|
| Corners | Square; slightly softened (2-4px); rounded (8-12px); fully round | Precise and serious, through to soft and friendly |
| Edges | Hairline borders; filled surfaces with no borders; heavy borders | Quiet and technical; calm and modern; bold and graphic |
| Depth | Flat; one soft shadow level; layered, with light from one source | Plain and direct, through to tactile and lit. Depth and light taken from the subject are craft, not decoration (`tells.md`) |
| Space | Tight; regular; airy | Dense and efficient, through to slow and premium |

Choose one option per row and hold it everywhere. A page with square buttons and round cards has no shape language. In every register: one button style and size for the primary action across the page, and boxes only around things that are distinct objects (`craft.md`, Space).

## Record the combination

Write the choices into the direction as one line, and log it under "Tried" in `DESIGN.md` when the direction is rejected or replaced:

```
Combination: paper and ink, repair-tag orange + slab serif over humanist sans + softened corners, hairlines, flat, regular
```

On a brand-new project, compare the directions in the set with each other instead. Otherwise, before settling, compare it with earlier combinations in the same project. Matching one on three or more of the five choices (colour strategy, display character, body character, shape, space) means the new page will read as a repeat. Change at least two. Within a set, the colour strategy, the main hue and the display character must all differ; two coloured grounds in clearly different hues are the one allowed overlap of strategy.

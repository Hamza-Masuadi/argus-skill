# Ingredients

Raw material for a new direction: the set of tokens every design fills in, and the options for each choice. Use it in `create.md` step 5, when writing the direction.

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
| Motion | `duration-feedback`, `duration-transition`, one easing |

Define them once (CSS variables, or the project's own token form) and use only the names below that point. A raw colour outside the token block is a defect.

- Fill in only the roles the design uses. A page with no status messages needs no status colours.
- A page whose ground changes from section to section (day to night, one colour band to the next) defines the same role names once per section, so each section is still built against names.

## Colour: choose a strategy, then find the hues

Decide how much colour the page carries before choosing any colour.

| Strategy | What it is | Suits |
|---|---|---|
| **Neutral with one accent** | Near-white or near-black surfaces; one colour for actions only | Product UI; subjects where content brings the colour |
| **Committed ground** | One strong colour covers the main surfaces; text and actions are light or dark on it | A confident brand; a loud brief |
| **Paper and ink** | A tinted off-white, a tinted near-black, and one spot colour used sparingly | Editorial, documents, craft, anything trusted |
| **Two-colour** | Two colours of similar weight, with neutrals, each given its own territory | A pairing with meaning: before and after, two audiences |
| **Dark stage** | Deep ground, light text, one bright accent; colour comes from imagery or data | Things used at night; photo-led and media subjects |
| **Categorical** | Several colours of equal weight, each standing for a category | Many kinds of thing that must be told apart |

Then take the hues from the subject, not from the category's habits: its materials, its objects, its place. A colour picked up from a photograph or a real object in the subject's world sits more naturally than one chosen from a swatch list.

Build the neutrals by tinting toward the accent's hue. Check every text pairing for contrast before settling (`craft.md`).

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
| **Script or hand** | Written, personal | A signature or a note, in very small amounts |

Pairings that work:

- **One family, several weights.** The safest and often the best.
- **Display with character over a neutral body.** The display face carries the voice; the body stays out of the way.
- **Serif with sans**, each given a clear job (headings and body, or body and interface).
- Avoid two faces of the same character. They look like a mistake.

Check the face has the weights, figures and languages the content needs, and that it is licensed for the project.

## Shape and space

| Choice | Options | Reads as |
|---|---|---|
| Corners | Square; slightly softened (2-4px); rounded (8-12px); fully round | Precise and serious, through to soft and friendly |
| Edges | Hairline borders; filled surfaces with no borders; heavy borders | Quiet and technical; calm and modern; bold and graphic |
| Depth | Flat; one soft shadow level; layered | Plain and direct, through to tactile |
| Space | Tight; regular; airy | Dense and efficient, through to slow and premium |

Choose one option per row and hold it everywhere. A page with square buttons and round cards has no shape language.

## Record the combination

Write the choices into the direction as one line, and log it under "Tried" in `DESIGN.md` when the direction is rejected or replaced:

```
Combination: paper and ink + slab serif over humanist sans + softened corners, hairlines, flat, regular
```

On a brand-new project there is nothing to compare with; skip this. Otherwise, before settling, compare it with earlier combinations in the same project. Matching one on three or more of the five choices (colour strategy, display character, body character, shape, space) means the new page will read as a repeat. Change at least two.

# DESIGN.md

`DESIGN.md` at the project root is the design's memory: tokens in YAML front matter, reasons in prose below. It lets the next session extend the work instead of re-deriving it, and other tools that read `DESIGN.md` can use it.

**How it differs from the run files.** `.argus/run.md` is one job's working state: the stage reached, the brief, the dealt ids, the open findings, rewritten at every stage and read first after a compaction (`SKILL.md`, section 7); once the job is done it has nothing left to say. `.argus/history.json` is the dealer's list of faces, pairings, grounds, heroes and sections already built, so the next build is dealt differently. `DESIGN.md` is what lasts: the product, the decisions and their reasons, the tokens as built. Copy into it what should outlive the job; never point it at `run.md`.

## When to write it

- **New work** (a new page, screen or product with nothing to match): create it if there is none. It is one file, built up in three moments, not separate documents:
  1. **Straight after the question message** (`ask.md`): "Product" and "This page", a few lines each, as in the shape below.
  2. **When the direction is chosen** (`directions.md`): "Direction" (the chosen one, with its dealt ids), "Images" (the picture decision), and "Tried" (every direction shown and not chosen).
  3. **Once, at the end, after the loop** (`build.md`, "The record"): complete it with what was built. The token front matter with final values, type families and sizes, spacing and radii, the components that exist and where they live, the motion plan as built, where each image came from, and any decision that changed during the build, with its reason. The next session should be able to extend the design from this file alone.

  In a single short session the direction and "Tried" may be held in your notes and written at the end, as long as the file still records the directions shown and the ones rejected. The answers are always written straight after the question message.
- **It exists**: keep its structure and update it in the same change that alters a token, adds a shared component, or settles a decision.
- **Small tweaks** write nothing.

The code is the source of truth for token values. `DESIGN.md` mirrors and explains them; when the two disagree, fix the document.

## Shape

```markdown
---
name: Berthboard Console
surface: operate
colors:
  surface: "#F6F7F5"
  surface-raised: "#FFFFFF"
  text: "#16201C"
  text-muted: "#5B6862"
  border: "#D9DED9"
  accent: "#0B6B4F"
  danger: "#B3261E"
typography:
  body: { family: "Source Sans 3", size: 14, line: 1.4 }
  heading: { family: "Source Sans 3", weight: 650 }
  figures: { family: "Source Sans 3", features: "tnum" }
spacing: [4, 8, 12, 16, 24, 32, 48]
shape: softened            # one of square, square-pill, softened, rounded, subject-frame (colour.md, C12)
radius: { control: 3, surface: 3 }   # at most three: control, surface, frame
motion: { t-fast: 180ms, t-base: 320ms, ease-out: "cubic-bezier(.22, 1, .36, 1)", ease-in-out: "cubic-bezier(.65, 0, .35, 1)" }   # names from motion-tokens.css
---

## Product
Questions 1-4 of `ask.md`, briefly. Asked once per project; later sessions read it and do not ask again.
- Who: dock supervisors starting a shift, checking what arrived overnight.
- Why us over the alternative: one screen instead of three spreadsheets.
- Main action: flag a container for inspection.
- Supplied: logo, brand green #0B6B4F; generated pictures: no tool.
- Proof: none given.

## This page
Per page: what a visitor should be sure of after one screen (the belief), what would be wrong for them, the objections, how many directions were shown; and, where the competitors were looked at (`brief.md`), the three lines: what they all say, what they all look like, what this page does differently.

## Direction
The chosen direction as its record (`directions.md`, "The direction"): kind, idea and headline, kit, voice, source, moments, only here, the dealt ids and any swap, the fingerprint, palette, type, pictures, motion, header, what it refuses; then the section plan with each section's layout.

## Images
The one-line picture decision (`pictures.md`, "The kind of picture"), then where each picture came from: supplied, the product itself, stock found by Argus (file, source page, author, licence and licence address, and where the page credits it; copy from `credits.json`), generated with the owner's yes (the tool, the brief, and "stand-in to replace"; noted once in the footer line), drawn or built in code and why, or type and space; each with its rung of the ladder. Then the palette and the picture it was sampled from (`photos.js palette`).

## Rules
The few decisions that are not obvious from the tokens.
- One filled button per view; everything else is outline or text.

## Components
Where shared components live and conventions for using them.

## Decisions
Things settled with the user, with dates and reasons.
- 2026-11-19: Light mode; the console is used in a sunlit dock office.

## Tried
Directions shown and not chosen, each with its kind, fingerprint, colour strategy and main hue, so they are not proposed again.
- Stencil Board: expressive; leads with the yard map; dark stage, signal orange; stencil container-marking type. Too loud for an all-day tool.

## Declined
Suggestions and findings the user turned down, so they are not raised again.
- 2026-11-19: Keep the dense table on mobile; users asked for it.
```

For an app, which has two colour modes (`app.md`), give each colour its light and dark values side by side:

```yaml
colors:
  ground:      { light: "#F2F2F7", dark: "#000000" }
  cell:        { light: "#FFFFFF", dark: "#1C1C1E" }
  label:       { light: "#000000", dark: "#FFFFFF" }
  accent:      { light: "#0B6B4F", dark: "#3FBF8F" }
```

## Using it

Read it first, every session. "Product" answers most of `ask.md`, so do not ask it again. Read "Decisions", "Tried" and "Declined" before asking a question, proposing a direction or reporting a finding. Raising something already settled is one of the most irritating things a design tool does.

Keep each part of it short, and record reasons, not only values: a rule with its reason can be applied to a case nobody anticipated.

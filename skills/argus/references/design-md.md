# DESIGN.md

`DESIGN.md` at the project root is the design's memory: tokens in YAML front matter, reasons in prose below. It lets the next session extend the work instead of re-deriving it, and other tools that read `DESIGN.md` can use it.

## When to write it

- **New work** (a new page, screen or product with nothing to match): create it if there is none. It is one file, built up in three moments, not separate documents:
  1. **Straight after the question rounds**: "Product" (round 1) and "This page" (round 2), from the few-line template in `ask.md`, "After each round". This file is not read for that.
  2. **When the direction is chosen** (`create.md` step 5): "Direction" (the chosen one), "Images" (the picture decision), and "Tried" (every direction shown and not chosen).
  3. **Once, at the end, after the loop** (`create.md` step 9): complete it with what was built. The token front matter with final values, type families and sizes, spacing and radii, the components that exist and where they live, motion, where each image came from, and any decision that changed during the build, with its reason. The next session should be able to extend the design from this file alone.

  In a single short session the direction and "Tried" may be held in your notes and written at the end, as long as the file still records the directions shown and the ones rejected. The answers are always written straight after the rounds.
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
radius: { control: 6, surface: 10 }
motion: { feedback: 120, transition: 220, ease-out: "cubic-bezier(0.22, 1, 0.36, 1)", ease-in-out: "cubic-bezier(0.65, 0, 0.35, 1)" }
---

## Product
Round 1 of `ask.md`, briefly. Asked once per project; later sessions read it and skip round 1.
- Who: dock supervisors starting a shift, checking what arrived overnight.
- Why us over the alternative: one screen instead of three spreadsheets.
- Main action: flag a container for inspection.
- Supplied: logo, brand green #0B6B4F.

## This page
Round 2, per page: what a visitor should be sure of after one screen, what must be on it, what would be wrong for them, how many directions were shown; and, where the competitors were looked at (`create.md` step 1), the three lines: what they all say, what they all look like, what this page does differently.

## Direction
The chosen direction (`create.md` step 5): its register (concept-led, or plain and photograph-led, product-led or type-led), the idea in one sentence, the headline, the structure fingerprint, the colour strategy and main hue with the thing it is taken from, the display and body faces, the motion layers, the header, the section plan, what it refuses.

## Images
The one-line picture decision (`imagery.md`, "The kind of picture"), then where each picture came from: supplied, the product itself, stock found by Argus (file, source page, author, licence and licence address, and where the page credits it; copy from `credits.json`), generated at the user's request (with the brief used), or drawn in code and why.

## Rules
The few decisions that are not obvious from the tokens.
- One filled button per view; everything else is outline or text.

## Components
Where shared components live and conventions for using them.

## Decisions
Things settled with the user, with dates and reasons.
- 2026-11-19: Light mode; the console is used in a sunlit dock office.

## Tried
Directions shown and not chosen, each with its register, fingerprint, colour strategy and main hue, so they are not proposed again.
- Stencil Board: concept-led; leads with the yard map; dark stage, signal orange; stencil container-marking type. Too loud for an all-day tool.

## Declined
Suggestions and findings the user turned down, so they are not raised again.
- 2026-11-19: Keep the dense table on mobile; users asked for it.
```

## Using it

Read it first, every session. "Product" answers round 1 of `ask.md`, so do not ask it again. Read "Decisions", "Tried" and "Declined" before asking a question, proposing a direction or reporting a finding. Raising something already settled is one of the most irritating things a design tool does.

Keep each part of it short, and record reasons, not only values: a rule with its reason can be applied to a case nobody anticipated.

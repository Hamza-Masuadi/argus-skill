# DESIGN.md

`DESIGN.md` at the project root is the design's memory: tokens in YAML front matter, reasons in prose below. It lets the next session extend the work instead of re-deriving it, and other tools that read `DESIGN.md` can use it.

## When to write it

- **It exists**: keep its structure and update it in the same change that alters a token, adds a shared component, or settles a decision.
- **It does not exist**: do not create it unasked and do not stop to ask. Put the direction in a comment at the top of the main file, and say in the report that it could become a `DESIGN.md`. Create the file when the user asks for one or asks for a design system.

The code is the source of truth for token values. `DESIGN.md` mirrors and explains them; when the two disagree, fix the document.

## Shape

```markdown
---
name: Harbor Freight Console
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
motion: { feedback: 120, transition: 220, easing: "ease-out" }
---

## Direction
The idea in one sentence, who it is for, where the look is drawn from, what it refuses.

## Rules
The few decisions that are not obvious from the tokens.
- One filled button per view; everything else is outline or text.

## Components
Where shared components live and conventions for using them.

## Decisions
Things settled with the user, with dates and reasons.
- 2026-11-19: Light mode; the console is used in a sunlit dock office.

## Tried
Directions considered and rejected, so they are not proposed again.
- Stencil container-marking type: too loud for an all-day tool.

## Declined
Suggestions and findings the user turned down, so they are not raised again.
- 2026-11-19: Keep the dense table on mobile; users asked for it.
```

## Using it

Read "Decisions", "Tried" and "Declined" before asking a question, proposing a direction or reporting a finding. Raising something already settled is one of the most irritating things a design tool does.

Keep it short and record reasons, not only values: a rule with its reason can be applied to a case nobody anticipated.

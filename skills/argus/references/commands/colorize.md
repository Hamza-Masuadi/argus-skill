# colorize

Fix or introduce colour on a screen. Most colour problems are problems of role, not of hue: too many colours doing unclear jobs.

Read `craft.md` for the numbers. In an existing system, use its palette; this command then only fixes how it is applied.

## Diagnose first

List every colour value in use and what each is used for. Flag values used once, near-duplicates (three greys within a few percent), and one colour doing two jobs (the accent also meaning "error").

## Fix in this order

1. **Roles.** Every colour gets exactly one job: surface, raised surface, text, muted text, border, accent, and the status colours. Merge duplicates into the role.
2. **Neutrals.** Most of any interface is neutral. Get these right before touching the accent: enough steps to separate surfaces, text that is clearly readable, borders that are visible but quiet. Tint the neutrals slightly toward the accent hue so they belong together.
3. **Accent.** One accent, used for the primary action and the current selection. Count its appearances on the screen; if it is everywhere, it signals nothing.
4. **Status.** Success, warning, danger and info are separate from the accent, used only for status, and always paired with an icon or word.
5. **Contrast.** Measure text against its actual background: body, muted text, text on the accent, text on status colours, placeholder text, disabled text. Fix failures by changing the token, not the instance.
6. **Dark mode**, if supported. Set its role values deliberately: lighter raised surfaces, lower saturation, re-measured contrast.

## Choosing a palette (new work only)

- Decide how much colour the surface should carry before picking hues: nearly neutral with one accent (most product UI), a committed brand colour across large areas, or a full multi-colour scheme. Choose one on purpose.
- Take hues from the subject's world (see `create.md`), not from the category's habit.
- Build in a perceptually even colour space such as OKLCH so steps look evenly spaced and contrast is predictable.
- Test the palette on a real screen with real content before settling. Swatches lie.

## Adding colour to a grey interface

Add it where it carries meaning: the primary action, selection, status, data. Then, if the brand needs presence, give it one large committed area instead of sprinkling tints everywhere.

## Report

Before and after: the count of distinct colours, the role table with values, and measured contrast for each text pair.

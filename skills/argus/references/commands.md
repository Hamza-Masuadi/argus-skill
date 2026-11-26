# Commands

Seven named commands. Each is a short route; the rules it applies live in the file it names. In an existing system, every command works toward that system, not toward this skill's taste.

## polish

The final pass on a screen that already works. Polish changes how finished it feels, never what it is. First say which job it is (`review.md`, "Which job"): rework means polish cannot fix it, so say so and propose the larger job; leave means say so and change nothing without a yes. Then work in this order, because earlier fixes move later ones:

1. **Alignment.** Merge edges that are nearly aligned; near-misses of 1-4px are what make a screen feel off.
2. **Spacing.** Snap every gap to the scale; space inside groups smaller than between them.
3. **Type.** Remove sizes and weights that differ without meaning; fix awkward breaks in headings.
4. **Colour.** Replace raw values with tokens; check muted text and text on colour for contrast.
5. **States.** Tab through every control; add the missing hover, focus, pressed, disabled and loading states.
6. **Edges.** Radii consistent and nested correctly; borders one weight; icons one set.
7. **Copy.** Buttons name outcomes; one capitalisation rule; cut filler words.
8. **Extremes.** Narrowest width, long content, empty content, dark mode if supported.
9. **Finish.** The rest of `finish.md` (left-over text, page basics, real characters, line endings, one motion vocabulary, the footer answering the hero).

Change nothing a user would call a redesign. Every change must be explainable in one clause. Report the changes grouped by pass, then anything noticed but left alone.

## audit

A measured check of a screen or a whole product, ending in a score and a ranked list; it changes nothing unless asked. Capture and run the checker at phone and desktop widths (`verify.md`); walk the screen by keyboard, at 200% text and with reduced motion; complete the main task. Score five areas 0-4, each with a one-line reason: **accessibility**, **responsiveness**, **consistency**, **states**, **clarity** (0 broken for some users, 2 works with visible problems, 4 nothing to add). Findings use `review.md`'s format, measured ones kept apart from judgement ones. End with the score table, the count of findings by severity and the five fixes with the best return.

## typeset

Fix the typography (`type.md`). List every distinct combination of family, size, weight, colour and line height in use; messy screens have twelve or more, good ones five to seven. Map every piece of text to a role (display, heading, body, small, data), give each role one size, at most three weights, measure 45-75 characters, tabular figures where numbers line up. A new face comes from `deal.js list fonts --tag <class>`. Report the before and after count and the role table.

## colorize

Fix or introduce colour (`colour.md`). List every colour in use and its job; merge duplicates into roles (surface, text, muted, border, accent, status). One accent, for the action and the current selection. Status colours separate from the accent and never alone. Measure every text pair. Adding colour to a grey interface: where it carries meaning first, then, if the brand needs presence, one large committed area instead of tints everywhere. Report the role table with values and measured contrast.

## animate

Add the motion a page is missing, or remove motion with no purpose (`motion.md`; safety in `craft.md`). Size it to the direction and the motion level (`showpiece.md`: moment unless the site is a showpiece); Operate surfaces get feedback and state changes only. Choose effects from the snippet gallery or the showpiece starters and copy only their marked blocks; a scene, arrival or transition gets the motion capture (`verify.md`). When asked to calm a page, cut in this order: motion with no subject, looping decoration, scroll-linked effects, then long durations. Report each animation added or removed with its purpose, and that the no-script and reduced-motion versions were looked at.

## simplify

Remove what is not earning its place. State in one sentence what the user is here to do, then sort every element: **essential** (keep, make it more prominent), **supporting** (quieten, or move one step away) or **decorative** (remove, unless it is the one deliberate piece of character). Then reduce choices, words, containers, styles and steps. Never remove what users need to feel safe (prices, consequences, a way back); removing a feature is a product decision, so propose it.

## variants

Show several distinct directions on one choosing page at any time: the brief, ideas and directions stages (`brief.md`, `ideas.md`, `directions.md`) with the user choosing. Three by default, five at most, built into `.argus/roughs/` with `index.html` copied from `assets/compare.html` (`directions.md`). For a dashboard, tool or app the variants are working-screen roughs (`product.md`, `app.md`). Record the chosen one in `DESIGN.md` and the others under "Tried"; delete the roughs unless the user wants them kept.

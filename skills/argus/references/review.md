# Review

Contents: **Which job** · **Evidence** · **The four criteria** · **As the loop's reviewer** · **A review on request** · **Wording**.

A review is useful when the reader can act on it in order of importance. Lead with what matters most and stop when the findings stop mattering.

## Which job

Before listing anything, say which of three jobs this is, from what you see:

- **Rework**: the offer is unclear, the layout broken, or the floor rules fail in several places. The full route for new work applies, keeping content and behaviour.
- **Repair**: it works and has a look of its own. Fix only what is measurably or visibly wrong, inside that look.
- **Leave**: nothing measurable or visible is wrong. Say so plainly; offer at most three small changes with exact values ("body line height 1.5 to 1.6") and make none without a yes.

A difference of taste is not a finding, and a review is not obliged to find something.

## Evidence

Review the rendered interface where possible (`verify.md` for how to capture it). If only code was read, say so at the top: spacing, contrast and overflow problems are easy to miss in code. Every finding names its screen region (the section, which part of it, the width) and what is seen in the capture there.

## The four criteria

Each judged **strong**, **fine** or **weak**, with one line of evidence from the screen. They weigh the same, and none rewards a style: a page with a modest headline, room and one sharp photograph can be strong on all four, and so can a dense, dark or loud one. **Restraint is never a finding by itself, and neither is boldness.**

1. **Clear and convincing.** In five seconds a stranger sees what it is, who it is for, and the action. Down the page the visitor's objections are answered, proof sits beside its claim, and the action is the same words wherever it appears. On a Persuade page, the content pass in `convert.md`.
2. **Looks good.** One thing leads, edges align, space groups. Nothing collides, overlaps text, or covers a form or a price. Pictures are sharp, well lit and well chosen. Type is comfortable to read. Each section has one thing worth looking at; the palette belongs to the picture; the frame does not compete; the ending returns (`composure.md`). Room with nothing strong in it is weak.
3. **Fits this business.** Would its owner and its customers recognise it as theirs? Is the tone right for the person arriving? The swap test: put another business's name on the page; if it would still fit, the idea is not carried, and the fix is a stronger moment or detail from this business, never more props. A whole default look nobody chose is weak here (`faults.md`).
4. **Finish.** Spacing consistent, states built (hover, focus, pressed, error, empty), it holds at every width, motion helps and never gets in the way.

## As the loop's reviewer

Each round a fresh reviewer (a subagent where possible) gets the round's captures (1440 and 390, first screen and full page; for an app, 390 in light and dark), the previous round's captures if any, the brief lines (who arrives, the difference, the action, the proof the owner gave) and this file. Never the builder's direction or intent: a reviewer told the intent tends to see it.

1. Look at the captures before reading anything else; write two or three plain sentences about what you see.
2. Judge the four criteria.
3. If there is a previous round, say plainly **better, worse or the same**, and why, by looking. Busier, bolder or louder is not better; neither is barer.
4. **At most three findings**, most important first. For each: its severity, the screen region, the evidence (what is seen in the capture), and one fix. Try to prove each wrong before writing it; drop any you cannot point to.

```
Clear and convincing: strong | fine | weak - one line
Looks good:           strong | fine | weak - one line
Fits this business:   strong | fine | weak - one line
Finish:               strong | fine | weak - one line
Against last round:   better | worse | same - why, by looking (or "first round")
1. P1  first screen, right half, 1440   seen: the marquee crosses the booking form   fix: give it its own band below
2. P2  section 3 (prices), 390          seen: ...                                     fix: ...
```

Its verdict, checked by your own look, decides which round's version is kept; its findings join the round's one list. With no separate reviewer, the builder does this as a distinct pass from the screenshots alone, findings written before any fix, and says so in the report.

## A review on request

Order of inspection: purpose (clear in five seconds?); hierarchy (squint: does the most important thing win?); consistency with the project's own tokens and components; states; accessibility (contrast, target size, focus, labels, reduced motion, large text); copy (labels that name the outcome, errors that say what to do); fit; responsiveness at the narrowest and widest widths. An app is judged at 390 and 320, light and dark.

```
P1  src/app/billing/page.tsx:42
    Two primary buttons compete in the header.
    Users cannot tell which action is the expected one.
    Fix: demote "Export" to the secondary variant.
```

**P0** blocks a task or excludes users; **P1** causes real confusion or error; **P2** is visible roughness; **P3** is polish. Keep "broken" and "taste" apart: a contrast failure is a fact; "the accent could be warmer" is an opinion and is labelled as one. End with the three changes that would improve the screen most, in order; do not pad the list, and do not rewrite the interface unless asked.

Cite a principle only for what it says. Never cite these as rules: the three-click rule, "users don't scroll", seven plus or minus two menu items, designing to an F or Z pattern, thumb-zone maps, the 60-30-10 colour rule or golden ratio, "every extra field costs conversions", "skeletons are faster than spinners".

## Wording

Name what you see and what would fix it, from this page's content: "the headline sits over the patient's face at 390; move it to the panel below the photograph". Avoid prestige words ("premium", "elevated", "world-class", "award-winning", "bold", "polished"): they push every page toward one look and tell the builder nothing to change.

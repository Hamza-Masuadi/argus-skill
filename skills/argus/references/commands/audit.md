# audit

A measured check of a screen or a whole product, ending in a score and a ranked list. An audit reports; it changes nothing unless the user then asks for fixes.

Read `review.md` and `verify.md` as well as this file.

## Gather evidence

Read `laws.md` first; the timings below and the scores should rest on its principles and numbers, not on impression.

1. Render the screens and capture them (see `verify.md`).
2. Run the checker (`scripts/check.js`, see `verify.md`) at phone and desktop widths. Its findings are measurements; treat them as facts.
3. Walk the screen by keyboard only, then at 200% text size, then with reduced motion on.
4. Complete the main task from start to finish, and time the response to each press against the limits in `laws.md` (instant under 0.1s, indicator past 1s).

If something could not be rendered or run, say which parts of the audit are from reading code only.

## Score five areas, 0-4 each

| Area | 4 means |
|---|---|
| **Accessibility** | Contrast, names, labels, focus, target size, reduced motion and large text all hold |
| **Responsiveness** | Works deliberately from 320px to wide; nothing clipped or overflowing |
| **Consistency** | Tokens everywhere; one set of components, radii, spacing and voice |
| **States** | Every control and data view has every state it can be in, including empty and error where data can be missing or fail |
| **Clarity** | Purpose obvious in five seconds; one primary action; plain, specific copy |

0 = broken for some users, 1 = serious gaps, 2 = works with visible problems, 3 = solid with minor issues, 4 = nothing to add. Give the reason for each score in one line. Total out of 20.

## Findings

Use the format and severity levels in `review.md` (P0-P3, location, what, why, fix). Group by area, most severe first. Keep measured findings and judgement findings visibly separate.

## Close

End with the score table, the count of findings by severity, and the five fixes with the best return, in order. Offer to apply them.

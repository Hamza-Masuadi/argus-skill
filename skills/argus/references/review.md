# Review: critique

A review is useful when the reader can act on it in order of importance. Lead with what matters most and stop when the findings stop mattering.

## Evidence

Review the rendered interface where possible (see `verify.md` for how to capture it). If only code was read, say so at the top: spacing, contrast and overflow problems are easy to miss in code.

## Reviewing your own build

The loop hands screenshots to a fresh reviewer (`verify.md`). If there is no separate reviewer or subagent, do it yourself as a distinct pass: only the screenshots and the order below, as if you had not built the page. Write the findings down before fixing anything, and say in the report that the review was your own.

## Order of inspection

1. **Purpose**: within five seconds, is it clear what this screen is for and what to do next?
2. **Hierarchy**: squint. Does the most important thing win? Is there one clear primary action (on a working screen, at most one)?
3. **Consistency**: does it follow the project's own tokens, components and patterns? Raw values and one-off components are findings.
4. **States**: every state that can actually happen here: focus, disabled, and where data loads or can be missing, loading, empty and error; long content and tiny content.
5. **Accessibility**: contrast, target size, focus order and visibility, labels, reduced motion, large text.
6. **Copy**: do labels name the outcome? Do errors say what happened and what to do?
7. **Tells**: compare against `tells.md`.
8. **Responsiveness**: narrowest supported width, widest, and in between.

## Findings format

```
P1  src/app/billing/page.tsx:42
    Two primary buttons compete in the header.
    Users cannot tell which action is the expected one.
    Fix: demote "Export" to the secondary variant.
```

Severity:

- **P0** blocks a task or excludes users (unreadable contrast, unreachable control, broken layout).
- **P1** causes real confusion or error.
- **P2** is visible roughness.
- **P3** is polish.

Where a finding rests on an established principle, name it from `laws.md` so the reason is checkable ("two primary buttons: Von Restorff, emphasis on several items cancels out"). Do not cite a law for more than it says, and never cite the myths listed there.

Keep "broken" and "taste" apart. A contrast failure is a fact. "The accent could be warmer" is an opinion and should be labelled as one.

## Close

End with the three changes that would improve the screen most, in order. Do not pad the list to look thorough, and do not rewrite the interface unless asked: the request was a review.

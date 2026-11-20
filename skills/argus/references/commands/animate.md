# animate

Add motion that helps, or remove motion that does not. The first question is always whether the thing should move at all.

## Decide, in this order

1. **Should it move?** Motion earns its place when it gives feedback (the press registered), shows continuity (this panel came from that button), draws attention to a change the user would otherwise miss, or is the one authored moment of a marketing page. If none applies, the answer is no.
2. **How often is it seen?** Something triggered a hundred times a day gets almost no animation: quick, small, or none. Something seen once can afford more.
3. **What moves, from where?** Things enter from where they came from and leave toward where they go. A menu grows from its button; a sheet rises from the edge it belongs to.
4. **How long and what curve?** Use the durations in `craft.md`. Ease out for entering, ease in for leaving, and faster out than in. Springs suit things the user drags or throws.
5. **What else moves with it?** Stagger related items by 20-40ms at most; long cascades make people wait.

## Product UI

- Feedback within 100ms of every press.
- State changes (expand, select, reorder, add, remove) animate so the eye can follow what happened.
- Loading: skeletons that hold the layout; progress that reflects real progress.
- No motion on page load beyond content appearing.

## Marketing pages

- One authored moment, usually in the first screen, tied to the product's idea.
- Scroll does not hijack. Content is readable without waiting for it to arrive.
- Remove per-section fade-ups; they add delay and are a known tell.

## Always

- Animate transform and opacity so it stays smooth.
- Motion can be interrupted: a second press mid-animation responds immediately.
- Provide the reduced-motion version: no movement, opacity only or instant.
- Nothing loops forever unless it shows something live.

## Removing

When asked to calm an interface, cut in this order: looping decoration, scroll-triggered entrances, hover effects that move layout, then long durations. Keep feedback and continuity.

## Report

List each animation added or removed with its purpose in a few words, and confirm the reduced-motion path.

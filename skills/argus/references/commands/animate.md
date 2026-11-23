# animate

Add the motion layer a page is missing, or remove motion that has no purpose. The layers, numbers, mechanisms and safety rules are in `craft.md` (Motion); this command applies them.

## Decide, in this order

1. **Which surface is it?** Persuade and Read pages get the full layer: feedback, state changes, a live element in the hero, an arrival, scroll reveals, one or two scroll-linked sections where the idea calls for it, and at most one ambient loop. Operate surfaces get feedback and state changes only (`product.md`).
2. **What is the subject's gesture?** The live element and any scroll-linked section come from what the customer handles or does (`create.md` step 2): something travels, fills, opens, counts, follows the pointer or the scroll. Motion that could be moved to any other site unchanged is a tell (`tells.md`).
3. **How often is it seen?** Something triggered a hundred times a day gets almost no animation: quick and small. Something seen once can afford more.
4. **What moves, from where?** Things enter from where they came from and leave toward where they go. A menu grows from its button; a sheet rises from the edge it belongs to.
5. **How long, what curve, what stagger?** The durations, distances, stagger and the two easing curves are in `craft.md`. Use the project's motion tokens, or add them.

## Product UI

- Feedback within 100ms of every press; hover and press that feel physical.
- State changes (expand, select, reorder, add, remove, a value updating) animate so the eye can follow what happened.
- Loading: skeletons that hold the layout; progress that reflects real progress.
- No arrival, no scroll reveals, no ambient loops, no decorative motion.

## Persuade and Read pages

- **The live element** in the hero, working from the first second and still meaningful with reduced motion.
- **The arrival**: the first screen assembles in three to five staggered steps, under about a second, with the action present from the first frame.
- **Scroll reveals**: sections and their children arrive as they enter view, with a small rise and fade, staggered. Vary them by what each section is (a drawing completes, a list deals in, a figure counts to its real value) rather than one fade-up on everything.
- **Scroll-linked**: one or two sections at most, where the idea calls for it, with a finished static state where unsupported.
- **Feedback**: every control lifts, sinks and shows focus.
- **Ambient**: at most one quiet loop outside the hero, with a pause control if it runs longer than five seconds.
- Scroll is never hijacked.

## Always

- Content is visible without script; hiding styles apply only once the script has marked the document ready (`craft.md`).
- Every animation has a reduced-motion version that removes movement and keeps the end state.
- Transform and opacity only, never layout properties.
- Motion can be interrupted: a second press mid-animation responds immediately.
- Nothing flashes, and nothing delays the primary action.

## Removing

When asked to calm an interface, cut in this order: motion with no subject (generic fade-ups, floating shapes, parallax for its own sake), looping decoration, scroll-linked effects, then long durations. Keep feedback, state changes and continuity.

## Report

List each animation added or removed with its layer and purpose in a few words, and confirm the no-script and reduced-motion versions were looked at.

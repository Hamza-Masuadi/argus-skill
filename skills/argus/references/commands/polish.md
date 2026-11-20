# polish

The final pass on a screen that already works. Polish changes how finished it feels, never what it is. If the layout or the idea is wrong, say so and stop; polish cannot fix that.

Read `craft.md` first. Look at the rendered screen, not only the code.

## Pass order

Work in this order, because earlier fixes move later ones.

1. **Alignment.** Find every left edge and baseline. Merge edges that are nearly aligned; near-misses of 1-4px are what make a screen feel off.
2. **Spacing.** Snap every gap to the scale. Check that space inside groups is smaller than space between them, and that equal relationships get equal space.
3. **Type.** Remove sizes and weights that differ without meaning. Fix orphans and awkward breaks in headings. Check line length.
4. **Colour.** Replace raw values with tokens. Check muted text and text on colour for contrast. Make sure the accent appears only where it should.
5. **States.** Tab through every control. Add the missing hover, focus, pressed and disabled states, and loading states where something really loads.
6. **Edges.** Radii consistent and nested correctly. Borders one weight. Shadows one direction. Icons one set, one stroke weight, optically centred.
7. **Copy.** Buttons name outcomes. One capitalisation rule. Cut filler words.
8. **Extremes.** Narrowest width, long content, empty content, dark mode if supported.

## Rules

- Change nothing a user would call a redesign.
- In an existing system, polish toward the system, not toward this skill's taste.
- Every change must be explainable in one clause ("aligned the card titles to the page edge"). If it cannot be, leave it.

## Report

List the changes grouped by the pass they came from, then anything noticed but left alone because it was out of scope.

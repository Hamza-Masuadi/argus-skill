# Made for this site

Contents: **The principle** · **Drawing for the subject** · **Animating SVG** · **Scroll effects from the subject** · **Canvas** · **Keeping it honest**.

Read with `motion.md` and `craft.md`; their limits and safety rules hold here. Nothing here mandates a look: a calm, minimal page is a finished page.

## The principle

**Made here means the one or two moments, not every section.** A page carries one idea; the moments (`ideas.md`) are where it gets rich, and those are drawn or built for this subject rather than taken whole from the kit. Everything else stays plain and well set, with the kit's supporting effects: hovers, reveals, timing, the reduced-motion and touch handling. A page where every section has its own drawn prop or trade costume has not been made bespoke; it has lost its product.

The `svg` snippets (`assets/snippets/svg-*.html`) are techniques to redraw for a moment, not decorations to paste or slots to fill: use as many as the moments need, often one, sometimes none. Keep the mechanism; draw the subject's own thing. Why: the same few kit moments on every site make sites look generated, and so does a prop on every section.

## Drawing for the subject

**Draw what a photograph cannot show:** a process, a route, a mechanism, how something works, an idea. **Photograph what must be believed:** the real food, the real room, the real face. A drawn loaf sells nothing; a drawn section through the oven explains the bake.

**Simple and confident beats detailed.** Few paths, each with a job.

- One stroke width, one `stroke-linecap` and `stroke-linejoin` (round or square, not both) across every drawing on the page.
- A small palette from the page's tokens (`currentColor` and one or two roles); no new colours.
- Size the `viewBox` to the drawing and set stroke widths in its units.
- **Never put `vector-effect: non-scaling-stroke` on a path drawn with `pathLength` dashes**: the dash lengths stop matching and the line will not draw (a test enforces this in the snippets). Use one or the other on a path.
- Write paths by hand or tidy them: whole numbers, no editor cruft, `fill: none` set once.

## Animating SVG

**Path drawing.** Give the path `pathLength="1"`, then `stroke-dasharray: 1` and animate `stroke-dashoffset` from 1 to 0. No measuring in script. Supported in current browsers.

**Morphing** works only between compatible paths: the same commands in the same order, the same number of points. Draw the states from one master path and move points, never add them. Three ways:

- CSS `d: path()` with a transition: Chrome and Firefox; Safari parses it but ignores it, so `CSS.supports` will not tell you. Check support; fall back to SMIL.
- SMIL `<animate attributeName="d" begin="indefinite">` started with `beginElement()`: works in every current browser and is the safe default for a morph.
- WAAPI on `d` follows CSS support, so it has the same gap.

If the shapes cannot be made compatible, cross-fade two drawings instead.

**Masks and clip-paths** reveal through a shape from the subject: an arch from the building, a bottle, a leaf. Animate a `transform` on the shape inside `<clipPath>` or `<mask>` (with `transform-box: fill-box`), not its path data.

**Choosing a tool.** CSS for state changes and scroll; WAAPI (`el.animate()`) when script decides when and in what order; SMIL for path data and for self-contained files. One drawing uses one of them.

**Scroll-linked drawing** uses `animation-timeline: view()` or `scroll()` after the `animation` shorthand, inside `@supports (animation-timeline: view())`, with the drawing finished outside it. Now in Chrome, Edge, Safari and Firefox, but older versions are still about: the fallback is the finished drawing, never a blank one.

**Filters sparingly.** `feTurbulence` and `feDisplacementMap` repaint every pixel they cover. Keep them to a small area (a stamp, a heading), never full-screen or behind scrolling text, and do not animate them continuously.

## Scroll effects from the subject

**The thing the page is about changes state as you scroll:** the dough rises, the tide table fills, the route is travelled, the frame is brazed joint by joint. That is the bespoke scroll moment; a stack of cards is a kit mechanic, right only where the content is a stack.

- Animate `transform`, `opacity` and `stroke-dashoffset`; never width, height, top or margin.
- Prefer a CSS scroll timeline. When script is needed: passive listeners, one `requestAnimationFrame` loop that stops when settled or off screen, rects cached on resize, `contain: layout paint` on the scene.
- Reduced motion shows the finished state: the risen loaf, the full table. Content is never removed.

## Canvas

Use canvas only when SVG cannot keep up: hundreds of particles, pixel work, thousands of points. Give it `role="img"` and an `aria-label`, or text beside it that says the same; stop the loop off screen and when the tab is hidden; draw one still frame under reduced motion. Otherwise SVG: it is text, it scales, and it can be focused.

## Keeping it honest

- **It explains or sells something.** If it would move unchanged to another site, it is decoration: cut it or redraw it.
- **It is one of the moments.** A third drawn scene, or a drawing in a section the plan marks as plain, is cut.
- **It never covers** content, the action, prices or forms, and never delays them.
- **Touch and keyboard:** anything driven by the pointer has a button, a focus or a tap equivalent, or is decoration only and `aria-hidden="true"`. Pointer following needs `(hover: hover) and (pointer: fine)`.
- **A finished static state** that reads well with motion off and before script loads. Hiding styles go under a class the script adds.
- **Text stays text.** Labels in SVG are real `<text>` or sit in HTML beside it; a meaningful drawing has `role="img"` and an `aria-label`; a chart has a real table.
- Verify it as any effect (`motion.md`, M39): a frame series at 1440 and 1920, reduced motion, and a phone width with nothing fixed over the content.

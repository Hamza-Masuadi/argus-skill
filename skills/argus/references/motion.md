# Motion and interaction

Contents: **How much** · **Choosing** · **Snippets** · **Timing** · **Mechanisms** · **Limits** · **Verify**.

For pages; apps use `app.md` ("Building screens", Feel). Layers and safety rules are in `craft.md`; nothing here overrides them. Motion is not dealt: you choose it, for the page's one or two moments, from this file and the tested snippets in `assets/snippets/` (the gallery is `index.html`). The motion level (moment or showpiece) and the choreography of scenes, preloader, transitions, WebGL and the toy, with their libraries, are in `showpiece.md`; this file owns timing, hovers, reveals and limits at both levels.

Motion should help: show that something responded, where something came from, what changed. Good motion is usually small, but a page where nothing moves looks unfinished: unless the owner chose still, every page has the baseline below.

## How much

**M0. Three levels, chosen by the owner** (`ask.md`, question 4; `showpiece.md`). **Still**: the owner asked for no motion; controls still answer (hover, focus, press), nothing else moves, and `<html data-argus-motion="still">` records it. **Moment**, the default for business pages: the baseline, which is an arrival for the first screen, reveals as sections enter (varied by content: a picture opens, a list steps in, a drawing completes; never one fade-up on everything), hover, focus and press on everything interactive that show or change something, and one choreographed moment tied to the page's idea. **Showpiece**: the baseline plus scenes, transitions and smooth scroll. "Quiet" or "minimal" decides how much moves at once and how loudly, never whether anything moves. Reduced motion always gets finished static states. Why: a page that never moves reads as a template.

**M1. Size motion to the direction.** Minimal: quiet reveals, a short quiet arrival, two good hover states (a clear underline or fill on links and buttons, one useful change on pictures or rows), nothing following the pointer. Picture-led: the pictures may answer (a second picture on hover, a slow push-in, a muted loop in the opening with a pause control, `pictures.md`), type stays still. Expressive: an interaction from the subject and one scroll moment. Why: motion that fits the page is felt; motion beyond it is noticed.

**M2. An interaction from the subject**, where the direction has one, comes from what the trade does (pour, stitch, stamp, weigh), sits on the picture or the product, never over text, a form or the action, and works by touch and keyboard. Custom cursors and marks left on the page are easy to overdo: keep the system cursor, and never use them on a page meant to calm. Why: an effect that means something is remembered; one that fits any site is decoration.

## Choosing

**M4. Every hover gives feedback; the best also show something wanted:** a second picture, the price, the sizes, the next step. A simple underline, a fill or a small lift is fine on links and buttons. Why: feedback is the job; extra effects are optional.

**M5. Different content may hover differently** (links, pictures, list rows, the action), but two or three kinds on a page are plenty. Why: one hand, not a sampler.

**M6. Supporting effects echo each other:** easing, shape language, direction. Why: the page feels made by one hand.

**M7. At most one arrival:** three to five steps under about 1s; an intro mark at most 600ms, once per session; no curtain, no sound by default. A showpiece's preloader is the one exception, under its own limits (`showpiece.md`, 4). Why: the action works from the first frame.

**M8. Reveals are gentle and never hide content:** a short fade and rise, a line mask, a picture opening; one style per kind of content, softer on a calm page. Content shows without script. Why: reveals are for rhythm, not attention.

**M9. Navigation and buttons stay quiet:** a fill or colour change and a press state. Why: the more used, the less animated.

**M10. A scroll moment (the subject changing state, a drawing that completes, a picture that grows, a ground that shifts, a sticky sequence) is an option** for picture-led and expressive pages; one per page is plenty (a showpiece may pin up to three, `showpiece.md`), and only where it explains something. Why: one moment is remembered; several are a theme park.

## Snippets

**M11. Judge effects by looking** in `assets/snippets/index.html`; each snippet's header says what it does, its cost, and its touch and keyboard handling. Why: a description is not the effect.

**M12. Copy only between the `argus:copy-start` and `argus:copy-end` markers** (CSS, HTML and script blocks), paste `motion-tokens.css` once into `:root`, map colours to the page's roles, and keep the reduced-motion, touch-gating and keyboard parts. Why: those are the tested part.

**M13. Adapt the content, not the mechanism;** note any structural change in `.argus/run.md` and re-capture (M39). Why: limits were measured as written.

**M13a. The kit supports; the moments are made here.** The page's one or two moments (`ideas.md`) are made for this subject (`bespoke.md`); the snippets supply mechanics. The `svg` group are techniques to redraw in the subject's own shapes, never pasted as they are. Why: a kit effect taken whole looks like every other page built from the kit.

## Timing

**M14. Curves by purpose:** enter and respond `--ease-out` (`cubic-bezier(.22,1,.36,1)`); move across the screen `--ease-in-out`; leave `--ease-in` or a faster ease-out; scroll-scrubbed linear; nothing time-based linear. Why: one family relates every effect.

**M15. Durations by size and distance:** feedback under 300ms (`--t-fast` 180ms); press visible within 100ms, scale 0.97; focus instant; small states 200-300ms; menus and sheets 300-500ms from their edge; page-scale reveals 600-900ms; counting 600-1000ms; ambient cycles 6s or more; exits two thirds of the entrance. Why: 180ms feels faster than 400ms.

**M16. Hover in 150-250ms, out 300-400ms or instant;** menus and previews open after about 100ms of rest and close after a grace delay; a second tooltip shows at once. Why: brushing past must not strobe.

**M17. Hover uses transitions,** which retarget mid-flight; gestures keep their release momentum. Why: uninterruptible motion feels stuck.

**M18. Origin:** popovers scale from their trigger, fills from the entry point, nothing from 0 (start at 0.9-0.97). Why: things come from somewhere.

**M19. High-frequency and keyboard-driven actions get no animation.** Why: the tenth time it is a delay.

**M20. Springs through `linear()`** inside `@supports` with a bezier fallback (`--spring` over `--t-slow`, `--spring-soft` over `--t-base` or `--t-slow`, as `motion-tokens.css` sets them); JS springs for things often interrupted. Why: CSS springs reverse abruptly.

**M21. Overshoot on movement only,** never opacity or colour. Why: a bouncing colour reads as a glitch.

**M22. Stagger:** characters 15-30ms, words 30-50ms, lines and items 50-80ms; total near 400-500ms, or the first six then the rest together. Why: long staggers delay content.

**M23. Pointer smoothing:** lerp 0.1-0.2; magnet 0.2-0.4; tilt at most 6-8deg, one card a page; parallax 5-30px by depth. Why: beyond these the pointer feels lost.

## Mechanisms

**M24. Scroll-linked motion is CSS** (`animation-timeline: view()` after the `animation` shorthand, in `@supports`, finished state elsewhere); once-only reveals use `craft.md`'s observer; GSAP only for multi-step timelines or pinning, reported. Why: no main-thread cost.

**M25. No smooth scroll on business pages.** A showpiece site may use Lenis on GSAP's ticker, touch left native (`showpiece.md`, 1). Why: smoothing fights anchors, assistive tech and a visitor with a task.

**M26. A sticky scene, where used, is as tall as its steps,** 50-70vh apart, stage leaving with the last step, stacked on phones, scroll speed untouched (`flow.md`). Why: the empty tail was the worst real fault.

**M27. Horizontal rows are for galleries,** never ordered text; on phones a native snap row, next item showing, best first, focusable with an `aria-label`. Why: few see what is off screen.

**M28. A marquee carries real content and never passes over or behind anything else:** its own band, clear of forms, prices and text; 20-40s a cycle, a pause button, paused off screen, on hover and on focus, scrollable under reduced motion, its duplicate `aria-hidden` and `inert`. Why: a band moving across a form or a photograph is a collision (`covered-content`).

**M29. List to detail uses a shared view transition** (`showpiece.md`, 5; the shared picture alone is fine at moment level); focus moves to the detail's heading. Why: it shows where the visitor went.

**M30. Guarded exceptions (see each snippet):** headlines split by authored lines with an `aria-label`; variable-font weight on a few fixed-width words; real figures counted once, final value in the markup; canvas or WebGL only when the product is the object, or as a showpiece's one WebGL layer (`showpiece.md`, 6 and 7). Why: each breaks a general limit.

## Fit

**M31. Calm and trust-led trades** (clinic, law, care, finance) get quiet effects: picture reveals, a drawn line, a preview pane, a clear hover; never glitch, scramble, cursor followers or marks left on the page. Lively ones may take fills, a sticky scene, a marquee in its own band. Why: the motion must fit the visitor's state of mind.

## Limits

**M32. Animate transform, opacity, clip-path, mask and `stroke-dashoffset`;** never width, height, top, left, margin or padding; filters on small areas; `will-change` only while active. This is the one statement of what may animate. Why: the compositor keeps it smooth.

**M33. Pointer loops read no layout** (cache rects on enter, resize, scroll), run one rAF loop that stops when settled, off screen or hidden, and use passive listeners. Why: INP under 200ms.

**M34. Pointer effects need `(hover: hover) and (pointer: fine)` and no reduced motion;** every hover reveal has a tap or inline equivalent. Why: touch has no hover.

**M35. Every pointer effect has a focus or button equivalent;** a hover picture is placed from the focused row's rect. Why: keyboard users get the same content.

**M36. Reduced motion keeps end states:** followers fixed or off, scrubbed effects on their last frame, parallax, velocity skew and sequences off. Why: vestibular triggers.

**M37. Keep the system cursor;** overlays `aria-hidden`, `pointer-events: none`, off the text being read and the focus ring; cursor labels repeat the accessible name; drag, hold and draw have a single-pointer alternative. Why: the system cursor carries the visitor's settings.

**M38. An effect is wrong when** it delays or moves the action, covers or crosses content, plays on frequent controls, costs LCP (2.5s) or CLS (0.1), or shows two clocks in different states (drive them from one value). Why: motion buys memorability, not proven conversion.

## Verify

**M39. `shot.js`** (`verify.md`): `--hover <target>` for hovers and any interaction, `--frames N --every MS` for a short loop, `--scroll-frames N` for a scroll moment, `--reduced-motion` for end states. A scene, an arrival or a page transition also gets `--scenes`, `--arrival`, `--transition` (over http), `--motion-metrics` and `--fallbacks`, and a showpiece `--perf-scroll`; read every contact sheet (`verify.md`, "Motion capture"). Why: judged from code, motion is guessed.

# Showpiece: choreographed motion, sized to the site

This file owns the motion level, the choreography (scenes, preloader, transitions, WebGL, the toy) and its libraries. `motion.md` owns timing, curves, hovers, reveals and limits, and `craft.md` the safety rules; both hold here unchanged. Starters are in `assets/showpiece/` (gallery: `index.html`); each registers what it moves on `window.__argus`, so `shot.js` can step through it.

## Pick the level

The owner chooses it in the question message (`ask.md`, question 4): moment recommended, showpiece recommended for the site types named below. Write it in `.argus/run.md`. When unsure, moment.

- **Still** (only when the owner asked for no motion). Hover, focus and press states on every control and nothing else; set `data-argus-motion="still"` on `<html>`.
- **Moment** (every business, service, SaaS, booking, clinic, shop and public-service page, and any page not named below). The baseline (`motion.md`, M0: an arrival, reveals as sections enter, controls that respond) and native scroll with **one** choreographed moment made for the subject: a pinned scene, a drawing that completes, a kinetic headline, or a WebGL treatment of the pictures. No smooth scroll, no preloader, no transition overlay. These visitors came to do something. An owner who wants "more wow" here gets a better moment, not a showpiece.
- **Showpiece** (portfolio, studio, launch, fashion, culture, product reveal, or an owner who asks for an award-style or immersive site). Smooth scroll, one to three pinned scenes, split-text reveals, a preloader only when there is something real to wait for (section 4), page transitions, at most one WebGL layer and one toy, and designed edges: menu, footer finale and 404. These visitors came to browse, and the impression is the product.

## The floor holds at both levels

A showpiece loosens nothing in `SKILL.md`, "Rules that always hold":

- **Readable and reachable without waiting.** Content is in the HTML and shows without script; the action works from the first frame the page is shown. A preloader covers only a real load, lifts by 3 s at most, and is skipped on return visits and under reduced motion.
- **The keyboard works everywhere**: every link, the menu, the toy (by buttons), and focus moved to the new heading after a transition.
- **No scroll-jacking on touch.** Phones scroll natively (Lenis `syncTouch` off), get no pin, and scroll speed never changes where people read.
- **Reduced motion gets finished static states**, designed, not a blank frame: no smoothing, no pin, no loader, the WebGL layer never started.
- **Budget.** Motion code under 50 KB gzipped for a moment, 120 KB for a showpiece (GSAP + ScrollTrigger + SplitText + Lenis + OGL is about 95 KB; three.js alone about 186 KB, so it needs a reason). LCP under 2.5 s and CLS under 0.1 (`motion.md`, M38); `--perf-scroll` within its limits.

## Libraries (pinned; checked 26 Nov 2026 with `npm view` and the downloaded packages)

| Library | Version | Licence | How it ships here |
|---|---|---|---|
| gsap (+ ScrollTrigger, SplitText) | 3.15.1 | GSAP Standard "no charge" licence (gsap.com/standard-license): free on sites, commercial included; bars no-code animation tools | **Not vendored**: the licence grants use on sites, not plainly redistribution inside another package. Starters load `https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/{gsap,ScrollTrigger,SplitText}.min.js` (byte-identical to npm, checked by hash). Self-host in the site you build, notices intact. |
| lenis | 1.3.28 | MIT | Vendored: `vendor/lenis-1.3.28.min.js`, `.css`, `lenis-LICENSE.txt` |
| ogl | 1.0.11 | Unlicense (public domain) | Vendored as `vendor/ogl-1.0.11.global.js`: jsDelivr's bundle exposed as `window.OGL`, so it runs from a plain script over file:// |

Optional, with a reason: `matter-js@0.20.0` (MIT) for real rigid bodies; `swup@4.10.0` (MIT) only when a canvas must survive page changes. Not used: Barba (stale), Theatre.js, WebGPU.

**Out of scope, never faked:** custom 3D models and scenes, image-sequence product turns, and Rive, Spline or Unicorn Studio content. Each needs an asset made elsewhere. Wire it in if the owner supplies it; otherwise say so and build the best version without. No primitives pretending to be a product.

## The techniques

For all: start states set by script, never CSS; measure after `document.fonts.ready` and the pictures' `load`; curves and durations are `motion.md`'s (M14, M15; in GSAP, `expo.out` to arrive, `power2.inOut` to move); steps overlap, never queue.

**1. Smooth scroll** (showpiece only) · `smooth-scroll-scene.html`
- Setup: `new Lenis({ anchors: true })`, `lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker.add(t => lenis.raf(t * 1000))`, `gsap.ticker.lagSmoothing(0)`, plus `lenis.css`. `syncTouch` off, `respectReducedMotion` on.
- Goes wrong with: two rAF loops; lerp under 0.07; scrolling panels without `data-lenis-prevent`.

**2. Pinned scene** · `smooth-scroll-scene.html`
- Earns its place when three or more things change together to explain one idea: the subject changing state, a process in beats. One simple scrub is CSS (`motion.md`, M24).
- Setup: one `gsap.timeline` with `scrollTrigger: { pin: true, scrub: 0.5–1, end: '+=150–300%' }` and labelled beats, inside `gsap.matchMedia()`: wide screens get the scene, phones short reveals without a pin, reduced motion the end state. Every screen of the pin changes something (`motion.md`, M26).
- Goes wrong with: measuring before fonts (the pin jumps); the mobile address bar (`ignoreMobileResize`); text read while it moves; pins over three screens.

**3. Split-text reveal** · `split-headline.html`
- The first screen's headline, or one display line a section; never body text.
- Setup: `SplitText.create(el, { type: 'lines', mask: 'lines', autoSplit: true, onSplit })`, returning the tween from `onSplit`; the default `aria: 'auto'` keeps the heading one sentence. Pad the masks for descenders. Hide the headline only by a class set in `<head>`, with a 1.5 s failsafe. Stagger as `motion.md`, M22.

**4. Preloader with hand-off** (showpiece only) · `preloader.html`
- Only when the first screen waits on something real and heavy (a texture, a film still, a WebGL first frame); otherwise none, and the plan says why. Fonts alone are not a reason.
- Setup: wait for real things (fonts, pictures `decode()`d, the first WebGL frame) with `Promise.race` and the 3 s cap; count real progress; the loader's last frame is the hero's first, in one timeline; the page ground is the loader colour; a failsafe removes it if the hand-off has not begun.
- Goes wrong with: fake timers; an asset that never resolves; a long loader hiding the LCP element.

**5. Page transitions** · `transition.html` + `transition-project.html`
- Setup: `@view-transition { navigation: auto }`; `view-transition-name` on the shared picture (only the card being opened); `object-fit: cover` on its snapshots; `pagereveal` moves focus to the new `<h1>`; under 800 ms; reduced motion `navigation: none`. No library. Chrome and Edge 126+, Safari 18.2+; same-origin http(s), not file://.
- Goes wrong with: fading both pages at once (the bare canvas flashes white: keep the old page opaque, move the new one over it); two elements sharing a name; long transitions replayed on Back.

**6. WebGL pictures** · `webgl-image.html`
- On a picture-led site, as its one WebGL layer.
- Setup: one fixed canvas, one OGL plane per `<img data-gl>`, its rectangle read live every frame and on resize, scroll, fonts and pin refreshes (never cached); the bend stays inside the picture's own box; DPR capped at 2 (1.5 on touch); the loop stops when nothing moves.
- **A blank box is impossible**: each `<img>` stays visible until its own plane has been drawn where the picture now is and read back (`readPixels`) as not blank; after any layout change it shows again until re-proven. No WebGL, a lost context, a read-back error or a plane still blank after a second gives the plain `<img>`; touch gets the scroll bend only.
- Goes wrong with: cross-origin pictures without CORS, or local files over file://; a picture showing twice. `shot.js --check` flags a canvas over a picture that captures as one flat colour (`blank-canvas`).

**7. Shader ground** · `shader-background.html`
- One full-screen triangle, DPR 1, at most 30 fps, paused off screen and when hidden; reduced motion draws one frame. A CSS ground shows until the canvas draws, and stays if it never does. Text sits on a solid panel.
- Tie it to the subject (contours, weave, paper, tree rings); a drifting colour blob is the generic look.

**8. Horizontal gallery** · `horizontal-gallery.html`
- Pictures only. The default is a native scroll-snap row (`motion.md`, M27); script pins it into a sideways walk only on wide screens with a fine pointer and motion allowed, scroll distance equal to sideways distance.

**9. Kinetic type** · `kinetic-type.html`
- Two to five words whose weight, tracking and position follow scroll: CSS `animation-timeline` on a named view timeline, a ten-line script fallback, a variable font with a wide `wght` axis. The finished state is the CSS default, and the last third of the stage holds still.

**10. The toy** (showpiece, optional) · `signature-toy.html`
- One per site, from the trade's own verb, beside the content (`motion.md`, M2). Starts still and readable, with buttons for keyboard and touch; its loop runs only while things move. Matter.js only if a 50-line integrator will not do.

## Check it moving

In round 1 (`build.md`, "The rounds"), with the flags in `verify.md`, "Motion capture". Read every contact sheet before trusting a flag. Then the finishing pass (`finish.md`).

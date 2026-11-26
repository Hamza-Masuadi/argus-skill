# Type

Contents: **Choosing** (T1-T7) · **Weights and voices** (T8-T11) · **Sizes** (T12-T16) · **Leading and tracking** (T17-T19) · **Setting** (T20-T24) · **Loading** (T25-T28).

For Persuade and Read pages. Dense product UI keeps the Operate scale in `craft.md`; native apps use the platform's styles (`app.md`). An existing system or the user overrides it. The faces are data: `node "<skill>/scripts/deal.js" list fonts [--tag <class>]`, and `deal.js show <id>` for axes, weights, licence and stylesheet URL.

Good type is comfortable first: the right face for the voice, a clear order of sizes, body text easy to read. How loud the display is depends on the direction: a minimal page may set its headline at a modest size and a regular weight; an expressive one may fill the width.

## Choosing

**T1. Choose the face from the subject and write its source beside it, as for colour.** Look at the lettering the trade paints, stamps, engraves or prints; the era of the craft; the material; the voice (loud to condensed or heavy, measured to a text serif or a quiet sans). Write `Display: Big Shoulders 800, from the painted bay numbers in the depot`. Why: a face with a reason fits; a face from habit does not.

**T2. Take the pairing from the dealer:** `deal.js directions` deals each direction one, different from the others; `list fonts --tag` to look further. Confirm the face has the weights, figures, languages and licence the content needs. A common face (a good neutral sans) is fine when it was chosen for the page. Why: rules that named no faces produced one face in three of five builds.

**T3. Faces whose licence forbids redistribution** (the Fontshare faces, marked `selfHostOnly` in `deal.js show`) are referenced by name and their official stylesheet URL only, dealt only with `--self-host`, and their files are never downloaded into or committed with the project by Argus. Why: the licence says so.

**T4. One family, or two that clearly differ:** in classification (serif against sans), in width, or in role (display against text). Why: two near-identical sans read as a mistake (`type-twin-faces`).

**T5. At most two families carry visible text** (`font-families`). Why: a third is noise, not voice.

**T6. Script and handwriting are not headline faces** unless supplied. High-contrast display serifs only above about 60px. A serif display is one choice among many, not a default for calm or premium; dense working screens read faster in a sans. Why: both break at reading sizes, and the serif headline on a pale page is today's commonest generated look.

**T7. Monospace only for code, aligned data, or a technical subject's real labels.** Why: mono labels on everything is a costume.

## Weights and voices

**T8. Weight follows the voice:** a heavy display against a regular body is one way (suits loud, confident subjects); a regular or light display at a larger size is another (suits calm, premium and trust-led ones); a medium weight is fine when it reads clearly. Body never 300 or lighter (`thin-body-text`). Why: hierarchy comes from contrast in size, weight or space, chosen together.

**T9. At most three weights per family;** a variable family may add a fourth instance on another axis. Why: more reads as indecision.

**T10. Width and optical size where the family has them:** `font-stretch` for display in a family with a `wdth` axis; `font-optical-sizing: auto` on opsz faces. Why: they separate display from text without a second family.

**T11. Italic is a second voice:** standfirsts, captions, pull quotes, used consistently; one italic or coloured phrase in the headline is a habit to notice, not a voice. Small all-caps labels above headings only when they carry information (`composure.md`).

## Sizes

**T12. A few size roles, each a token, and no font-size outside them:** display, heading, lead, body and label, perhaps a larger hero size. Neighbouring tokens at least 1.2x apart.

```css
:root {
  --fs-hero:    clamp(2.75rem, 1.5rem + 5vw, 6rem);   /* the first screen's line; larger in an expressive direction */
  --fs-display: clamp(1.875rem, 1.3rem + 1.8vw, 3rem); /* section headings: a clear step above body, not display size */
  --fs-mid:     clamp(1.5rem, 1.2rem + 1vw, 2rem);    /* 24-32px */
  --fs-lead:    clamp(1.25rem, 1.1rem + .6vw, 1.5rem);
  --fs-body:    clamp(1.0625rem, 1rem + .25vw, 1.25rem); /* 17-20px */
  --fs-label:   .8125rem;                   /* 13px */
}
```

Why: roles keep a scale; a sprawl of near-equal heading sizes makes everything look equally important (`type-untokened-sizes`).

**T13. Body 17-20px on pages, labels 12-14px;** the 16px floor and 12px minimum are in `craft.md`. Why: pages at 14px are hard to read (`type-small-body`).

**T14. The headline is clearly the most important text on the first screen**, at a size the direction sets: a minimal direction about 2.5-4 times body, an expressive one as large as the idea needs. Never so large it pushes the action or the proof off the first screen, or breaks one word per line at 390. Why: size is for order and voice, not a target.

**T15. Keep display lines to a few words so the size holds at 320;** a longer line lowers only its phone size. Why: the order must survive the phone.

**T16. Large type may return below the first screen** (a figure, a name, the finale) wherever it is a section's one thing. Why: an option, not a quota.

## Leading and tracking

**T17. Leading:** above 80px, 0.9-1.0; 40-80px, 1.0-1.15; 32-40px, 1.1-1.2; 20-32px, 1.2-1.3; body 1.45-1.6. Masked display lines get `padding-bottom: .08em` for descenders. Why: big type needs less leading; body text needs more.

**T18. Tracking:** heavy grotesques -0.02 to -0.04em at large sizes; serifs and light weights 0 to -0.02em; body 0 (`tight-tracking` flags tighter than -0.04em, or -0.05em at 96px and above). Why: large letters look loose at default spacing; light and serif letters collide sooner.

**T19. Capitals and small labels open by 5-12%** (`.05em-.12em`, `caps-tracking`); lowercase is never tracked open, nor are numbers. Why: capitals need air, lowercase loses its word shapes.

## Setting

**T20. Measure 45-75 characters** (`max-width: 65ch`). Why: longer lines lose the reader at the return.

**T21. `text-wrap: balance` on headings, `pretty` on paragraphs** (not in Firefox; progressive). Why: no one-word last lines.

**T22. Real figures:** `tabular-nums lining-nums` for prices, tables and anything that changes; `oldstyle-nums` in serif prose; `all-small-caps` only with true small caps. Why: changing numbers must not jitter.

**T23. Hang the opening quotation mark** with `text-indent: -0.4em` (`hanging-punctuation` is Safari only). Why: the text edge stays straight.

**T24. Align big type optically:** pull display lines left about 0.05em so the stem meets the body's edge, and set the breaks by eye on the capture. Why: at large sizes the side bearing is a visible step.

## Loading

**T25. Self-host subset Latin woff2, or use the exact stylesheet URL from `deal.js show`,** with `font-display: swap` (`font-display-missing`). Why: a guessed URL falls silently into the fallback.

**T26. Preload only the display file** (`<link rel="preload" as="font" type="font/woff2" crossorigin>`). Why: it is the largest text on the first screen.

**T27. A metric-matched fallback per face:**

```css
@font-face { font-family: "Display Fallback"; src: local("Arial");
  size-adjust: 104%; ascent-override: 92%; descent-override: 24%; line-gap-override: 0%; }
```

Numbers from the face's data where given; otherwise tune `size-adjust` until the line breaks match. Why: the swap then moves nothing.

**T28. Never capture or judge a page in its fallback face;** wait for `document.fonts.ready`. Why: a rough in Arial is judged on the wrong type.

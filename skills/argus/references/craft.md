# Craft numbers

The single home for every number in this skill. Other files point here. An existing design system overrides all of it, and so does the user.

## Type

| | Pages people read (Persuade, Read) | Dense product UI (Operate) |
|---|---|---|
| Body text | 16px or more | 13-14px |
| Smallest text anywhere | 12px | 12px, including inside charts |
| Text typed into a field, at phone widths | 16px or more | 16px or more (smaller makes iPhones zoom the page when the field is focused) |
| First-screen headline (display) | about 56-120px at 1440 and above, 40-64px at 390; set with `clamp()` | |
| Key figures | | 24-32px |
| Line length | 45-75 characters | |
| Line height | about 1.5 body; 1.1-1.25 large headings | about 1.4 |
| Scale | big jumps; display size clearly dominant | fixed; ratio 1.125-1.2; four or five sizes |

Native apps use neither column: take sizes from the platform's text styles (`mobile.md` has the numbers).

Display type on a Persuade page commits: the first screen's headline is usually its largest element, or second only to the picture, at weights and tracking chosen on purpose (a heavy weight, or a light one at great size). Keep it to a few words, so the size fits without breaking badly at 320.

Both: at most two type families (`check.js` measures it) and three weights on a page, in every register; one family in two or three weights is often the strongest choice. Neighbouring sizes at least 1.2x apart; negative letter-spacing only on large display text and no tighter than -0.04em; never wide spacing on numbers; tabular figures wherever numbers align.

**The plain register** (`create.md` step 2) uses one family for everything, in two or three weights. Headline about 48-88px at 1440, weight 300 to 500, tracking about -0.02em; section headings about 32-56px; body 16-18px. The headline is short: about six words, eight at most where a specific detail needs them. The ground is white or a near-white with a slight tint from the subject.

## Colour

- Decide roles before values: surface, raised surface, text, muted text, border, accent, status.
- Two neutrals and one accent by default: a tinted ground and a tinted ink, and an accent for the primary action, the current selection and one or two emphases. By area, most of it is the ground, a smaller share the ink and its neutral surfaces, and the accent a small share kept for the things that matter. A second accent only with a stated reason.
- Neutrals tinted slightly toward the accent hue; no pure black on pure white.
- A committed ground (one strong colour over the main surfaces) must be deep or muted enough for long text to pass 4.5:1 on it.
- Status never by colour alone: add an icon or a word.
- One colour mode on the web unless the existing system has two or the user asks. Native apps follow the system's light and dark appearance. A second mode is its own set of role values, not an inversion.

## Contrast and targets

| | Required (WCAG 2.2 AA) | This skill's working size |
|---|---|---|
| Text | 4.5:1; 3:1 for large text (about 24px, or 19px bold) | same |
| Control boundaries, focus rings, meaningful graphics | 3:1 | same |
| Pressable targets | 24x24 CSS px; inline text links exempt | 44pt on iOS, 48dp on Android, 44px on the web at phone widths; 28-32px for dense desktop controls used with a pointer |

In reviews, a target between 24 and 44px is a recommendation, not a failure.

## Space

- Base of 4: steps 4, 8, 12, 16, 24, 32, 48, 64.
- Space inside a group clearly smaller than between groups; more above a heading than below.
- Group with space first, a divider second, a box last. No cards inside cards.
- **Fewer boxes.** Do not wrap content in a bordered or shaded card unless it is a distinct object the visitor handles as one thing (a product, a plan, a booking, a message). Separate everything else with space and alignment. Three cards in a row where a list or one large picture would do is the usual case.
- **One button style and one size** for the primary action across the page, one quieter style for the rest (`check.js` measures both, and flags a desktop primary button far from 40-48px). In the plain register, 40-48px tall on desktop (44px or more at phone width), corners fully round or about 4px, the accent used on nothing else.
- One small set of radii; inner radius = outer radius minus padding.
- Shadows share one light direction and few levels. Depth, light and texture chosen in the direction (a lamp's light, layers that overlap, the grain of the kit's surface) are wanted, not trimmed (`tells.md`).
- Dense product UI: table rows 32-40px; gaps of 4-16, with 24 between major regions.

## Motion

Motion is a designed layer, like colour and type, and it is planned in the direction (`create.md` step 5). On Persuade and Read pages it is much of what makes a page feel made rather than displayed. On Operate surfaces it stays sober: feedback and state changes only.

### Which layers a surface gets

| Layer | Persuade and Read | Operate |
|---|---|---|
| **Feedback**: hover, press and focus on every interactive thing | Always | Always |
| **State changes** animate between values (a total updating, a tab sliding, a row added) | Always | Always |
| **The live element**: one thing in the hero, drawn from the subject's own gesture, that moves or responds from the first second (something travels, fills, opens, counts, follows the pointer or the scroll) | One, on every new Persuade page | None |
| **Arrival**: the first screen assembles in a short choreographed sequence | Yes | None; content simply appears |
| **Scroll reveals**: sections arrive as they enter view, children staggered | Yes | None |
| **Scroll-linked**: progress tied to scroll position (a route followed, a drawing that completes, layers that part) | One or two sections, where the idea calls for it | None |
| **Ambient**: a quiet looping movement outside the hero | At most one on the page | None, unless it shows something live |

Every moving thing has a purpose from the subject. Motion that could be moved unchanged to any other site is a tell (`tells.md`).

### Numbers

| Purpose | Duration | Distance |
|---|---|---|
| Hover | 120-200ms | lift 2-4px, or a shadow that deepens one step |
| Press | 100-150ms, visible within 100ms | sink 1-2px, or scale to 0.97-0.98 |
| Focus ring | instant, or under 100ms | none; it never animates out of view |
| Small state change (toggle, tab, a value) | 200-300ms | within the control |
| Large surface (sheet, panel, menu) | 300-500ms; exits about two thirds of the entrance | from the edge or control it belongs to |
| Section reveal, per element | 400-600ms | rise 12-24px with a fade from 0 |
| Stagger between siblings | 40-80ms | a group of more than six staggers its first six, then the rest arrive together |
| Arrival, the whole first-screen sequence | under about 1s in total, in three to five steps | as section reveals; the live element may travel further |
| Counting a figure | 600-1000ms | real figures only |
| Ambient loop | a cycle of 6s or longer | a few pixels, or a slow change of light |

**Easing: two curves, used everywhere.** One for things arriving and responding, one for things moving between two places on screen and for leaving. Define them once as tokens, for example `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` and `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)`. Scroll-linked motion runs linear, because the scroll is its clock. Springs suit only things the user drags or throws.

**Properties: transform and opacity only.** Never animate width, height, top, left, margin or padding. On a drawing, a stroke being drawn (`stroke-dashoffset`) or a `clip-path` opening are fine. A canvas loop stops when it is off screen and when the tab is hidden.

### How the layers are built

Plain mechanisms, in whatever framework the project uses:

- **Arrival**: the first-screen elements carry an order (a CSS custom property such as `--i: 0, 1, 2`) and `transition-delay: calc(var(--i) * 70ms)`; the arrival plays when the script marks the document ready (below).
- **Scroll reveals**: one `IntersectionObserver` watches each section's children. When one enters (threshold about 0.15), add a class that plays its transition, then stop observing it. The same `--i` gives the stagger. Observe something the hiding style leaves with visible area: an element hidden by its own `clip-path: inset(0 100% 0 0)` or scaled to nothing reports no visible area and may never reveal; observe its parent, or use threshold 0, for those.
- **Scroll-linked**: CSS scroll-driven animations (`animation-timeline: view()` or `scroll()`) inside `@supports (animation-timeline: view())`. Where unsupported, show the finished state, or step it with the same observer. Never a scroll listener that reads layout on every frame.
- **Following the pointer**: on `pointermove`, write the position to CSS custom properties inside `requestAnimationFrame`, over a small range. Touch screens get the same element answering a tap or the scroll instead.
- **Counting**: the final value is in the HTML, so it reads correctly without script and to screen readers; the count only animates toward it.

### Safety, which nothing overrides

- **Visible by default.** Content is never hidden until a script runs. Hiding styles apply only under a class the script adds to the root element once it has run, for example `.motion-ready .reveal:not(.is-in) { opacity: 0; transform: translateY(16px) }`. If the script fails, or the page is opened in a hidden or background tab (`document.visibilityState`), the class is never added and everything shows. Elements already in view at load are revealed by the arrival, not left waiting for the observer.
- **Never depend on a frame or an observer firing.** In a browser pane or a tab that is not in front, `requestAnimationFrame` and `IntersectionObserver` can stall while `document.visibilityState` still says "visible", and an arrival that only rAF can finish then leaves the page blank. So: add the hiding class only inside the first frame callback, so a stalled frame hides nothing; and add a timer fallback that reveals everything. For the arrival, a timer of about 150ms after the hiding class is added marks it arrived whether or not a frame came. For reveals, an observer reports every element once as soon as it starts; if it has reported nothing within about a second, a timer reveals every element still hidden.
- **Reduced motion.** Every animation has a `prefers-reduced-motion: reduce` version that removes movement and keeps the end state: reveals become instant or a fade under 200ms, scroll-linked pieces show their finished state, loops stop on a meaningful frame, the live element still responds to input but does not travel. Check the setting in script too (`matchMedia`), since CSS alone does not stop script-driven motion.
- **Pause.** Anything that moves by itself for more than five seconds has a visible pause control, or stops by itself within five seconds.
- **Nothing flashes** more than three times a second.
- **Motion never delays the primary action.** It is visible and works from the first frame, and no animation blocks input.
- **Scroll stays the visitor's.** No hijacked scroll speed, no forced snapping of the page, no section pinned for more than about one screen of scrolling.

## Waiting

| Wait | Show |
|---|---|
| Under about 1 second | nothing |
| A whole view, a few seconds | a skeleton matching the layout |
| One module | a spinner |
| Over 10 seconds | a progress bar and a way to cancel |

## Widths and length

- Web pages: look at 320, 390, 1440 and 1920 wide. Change structure between them; do not just shrink.
- Reading text keeps its measure (45-75 characters), but the page uses the screen. The layout container is about 1200-1440px wide with side padding, wider for dashboards and catalogues. Backgrounds, pictures, bands and the first screen run edge to edge; only running prose is held to a narrow column.
- At 1440 the main content spans at least about three quarters of the width; at 1920 at least about two thirds, and the first screen still fills the screen. A page whose every section is a narrow centred column is a defect, unless its structure is the letter (`structures.md`).
- Product UI keeps its type sizes across widths; fluid type is for marketing display text.
- **Length is about simplicity, not a screen count.** A page may be long when each screen carries one message: a short heading, a sentence or two, one picture, at most one action. The defect is a long page of dense screens, or a section that runs on. Flag a page over 14 screens at 390 wide (an 844px-tall screen) or over 16 at 320 (measured with a 700px-tall screen), and any single section taller than about 2.5 screens at 390. Fix by giving each screen one message: cut words, split a crowded section into two simple ones or drop it, and use compact cards for long lists; never by stripping a section of its picture or its character (`create.md` step 3). Check it at phone width before the loop ends.

## Copy

- Buttons name the outcome: "Save changes", not "OK" or "Submit".
- Errors say what happened and what to do, without blame.
- Undo instead of confirmation for anything reversible.
- One capitalisation rule; sentence case is the safer default.

## Other languages

- Translated text grows by a third or more; never size a container to the English string.
- Right-to-left languages mirror the layout. Use start and end, not left and right. Do not mirror numbers, media controls or logos.
- Arabic-script text needs more line height, must not be letter-spaced, and has no capitals.
- Use a typeface that contains the script at the weights used.

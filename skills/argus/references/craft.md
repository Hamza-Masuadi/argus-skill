# Craft numbers

The single home for every number in this skill. Other files point here. An existing design system overrides all of it, and so does the user.

## Type

| | Pages people read (Persuade, Read) | Dense product UI (Operate) |
|---|---|---|
| Body text | 16px or more | 13-14px |
| Smallest text anywhere | 12px | 12px, including inside charts |
| Text typed into a field, at phone widths | 16px or more | 16px or more (smaller makes iPhones zoom the page when the field is focused) |
| Key figures | | 24-32px |
| Line length | 45-75 characters | |
| Line height | about 1.5 body; 1.1-1.25 large headings | about 1.4 |
| Scale | big jumps; display size clearly dominant | fixed; ratio 1.125-1.2; four or five sizes |

Native apps use neither column: take sizes from the platform's text styles (`mobile.md` has the numbers).

Both: one or two families, three weights at most; neighbouring sizes at least 1.2x apart; negative letter-spacing only on large display text and no tighter than -0.04em; never wide spacing on numbers; tabular figures wherever numbers align.

## Colour

- Decide roles before values: surface, raised surface, text, muted text, border, accent, status.
- One accent, for the primary action and the current selection.
- Neutrals tinted slightly toward the accent hue; no pure black on pure white.
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
- One small set of radii; inner radius = outer radius minus padding.
- Shadows share one light direction and few levels.
- Dense product UI: table rows 32-40px; gaps of 4-16, with 24 between major regions.

## Motion

| | |
|---|---|
| Feedback (press, toggle) | 100-150ms, visible within 100ms of the press |
| Small transitions | 200-300ms |
| Large surfaces | 300-500ms; exits faster than entrances |
| Easing | out for entering, in for leaving |
| Properties | transform and opacity by default; a small paint-only effect is fine; never animate size or position across a large area |
| How much | Controls responding to the user are feedback and are always fine. On a Persuade page, at most one thing moves by itself. On Operate surfaces, nothing does |
| Things that move by themselves | need a visible pause control if they run longer than five seconds, and must not loop unless they show something live or are a demo the visitor can stop |
| Always | a reduced-motion version; content visible without animation |

## Waiting

| Wait | Show |
|---|---|
| Under about 1 second | nothing |
| A whole view, a few seconds | a skeleton matching the layout |
| One module | a spinner |
| Over 10 seconds | a progress bar and a way to cancel |

## Widths and length

- Look at 320, 390 and 1440 wide. Change structure between them; do not just shrink.
- Product UI keeps its type sizes across widths; fluid type is for marketing display text.
- A page stays under about ten screens at phone width. Past that, use compact cards, collapse long sections, cut repeats.

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

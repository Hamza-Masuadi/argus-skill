# Mobile apps

Contents: **The route** · **What the app is for** · **The screens** · **Directions** · **Pictures** · **Light and dark** · **The bar for the main screen** · **Building screens** · **An HTML prototype** · **Native work** · **App faults**.

For a new mobile app with nothing to match, built native or shown as an HTML prototype at phone size, and for new screens in an existing app (with `extend.md`). A page is read once and must persuade; an app is opened many times a day, for a few seconds, by someone who already chose it. So what is written for landing pages, and much of what is written for desktop tools, is wrong here. Keep a `.argus/run.md` (`SKILL.md`, section 7).

## The route

| Step | Read |
|---|---|
| Questions | `ask.md`, with question 1 asked as "what does the user open the app to find out?" |
| Kit and directions | `ideas.md`: the kit, the cut, the three kinds, as changed below. `directions.md`: the deal (take the pairing's display face and the shape; the dealt ground and hero do not apply), the choosing page, the pick |
| Building | This file. `pictures.md` if photographs. `product.md`, "Numbers" and "Sample data", if the app shows figures |
| The loop | `verify.md` and `review.md`, plus "App faults" below |

**What does not apply**: the headlines, `first-screen.md`, the section plan, `flow.md`, `motion.md`, the header rules. Applied to an app, they give a landing page squeezed onto a phone.

## What the app is for

Write the one question the user opens the app to answer, in their words: "when is my coffee ready?", "is the cabin free on Saturday?". Make its answer the largest thing on the main screen: a time, a balance, a photograph of the thing they are about to buy. This replaces the headline. A second question is answered smaller and lower.

## The screens

Name the flow before drawing. Most apps have five parts: **the main screen**; **the thing looked at** (the detail for one item, place or account); **the main action** (ordering, booking, paying, usually a sheet over the detail); **the result** (a confirmation that says what happened, when and what next); **what is mine** (orders, trips, history). List each screen with the one question it answers; a screen that answers none is cut.

Count the real destinations. One or two: no tab bar. Three to five: a tab bar, named in the user's words, never a stock set (Home, Explore, Profile) by habit. Drilling down pushes a screen with a clear way back; self-contained tasks (compose, edit, pick) open as a sheet with cancel and confirm. The system back gesture always works.

## Directions

- **Ground**: the system's, white or near-white in light, near-black in dark. Colour comes from one accent, the pictures, and at most one coloured surface per screen; a committed coloured ground on every screen only when the owner asks. A fill that would strike on a page tires on a screen seen all day.
- **How directions differ**: every direction is neutral with one accent, accents in different hue families. They differ in what they are, each in at least three of: what the main screen leads with (built on one named kit item); its layout (one large card, a list, a picture grid, a single figure); how content is grouped; the accent and how much of it; type weight and scale.
- **Type**: body text, controls, lists and bars use the platform's system font and named text styles, always, so the user's text size works. A direction may add one display face for large titles and figures only; at least one direction keeps the system font throughout.
- **Brand**: the mark sits once at the top of the main screen and once on the result screen; inner screens carry their own title.
- **Roughs**: each direction's main screen at phone size, with real content, one quick look at 390. Write the list into the choosing page as `{ "surface": "app", "directions": [...] }`, which opens it in its phone setting. Choose by: which answers the user's question fastest; which looks like this business and no rival; which will hold across the screens not yet drawn. Then add one second screen for your pick, usually the detail.

Record the direction in `DESIGN.md`:

```
Question:  the one question the user opens the app to answer
Screens:   each screen and its question; the tab bar or none
Leads:     what the main screen leads with, and the kit item it is built on
Layout:    the main screen's layout and how content is grouped
Palette:   system ground, accent (named for its thing), any one coloured surface
Type:      system font, or the one display face and where it is used
Pictures:  the one-line decision; where photographs sit on each screen
Refuses:   two or three things it will not do
```

## Pictures

Decide the kind of picture once, as for a page (`pictures.md`). **If the subject is physical**, photographs are large, because the picture is the product: a full-width picture card on the main screen; the detail opens with the photograph edge to edge, at most about 55% of the screen tall, so the name, price and action stay visible; browsing uses full-width cards or a two-column grid. Small thumbnails only for what the user already chose (basket, history).

- **One set or none**: the same light, angle and ground; one aspect ratio per list; the same item shows the same photograph on every screen. Never mix photo cards with empty or tinted tiles: the blanks read as missing. If no set covers every item, use the best photograph large and make the items type-led rows.
- **Resolution is judged at 2x**: the long edge at least twice the slot's displayed width.
- **Never draw a fake map or a fake photograph.** Use a real map image with its attribution, or the address with an "Open in Maps" row.
- **Money, utility and tracking apps** take no decorative photographs: the figure is the picture, large, with its comparison.

## Light and dark

Design light first. Dark is derived from the same token roles on the system's dark ground: the accent lightened until it passes contrast, photographs unchanged. Capture it once and fix what fails; it is not a second direction. This is the app exception to "one mode unless asked": phones switch appearance by themselves. Only if the owner says light only, set `color-scheme: light` and say so.

## The bar for the main screen

Capture the main screen at 390, light and dark, and answer each in writing:

1. Can the user's question be answered in three seconds, without scrolling? Is the answer the largest thing on the screen?
2. Is the one main action, where the screen has one, in the lower half, pinned at the foot if it acts on the content?
3. Is something real on screen (a photograph, a real figure, the product), not only labels?
4. Could a rival's app show this screen unchanged? If yes, it fails.
5. Does it look like a phone app at a glance: the status bar drawn, standard bars, 16pt margins, the system type scale, the system ground?
6. About 25 words outside lists, and no sentence explaining a figure?
7. At most one colour-filled button? A browsing screen may have none.

A "no" to any but 4, or a "yes" to 4, means rework: two rounds, then another direction once. Then build the rest in order: the detail, the main action, the result, what is mine, each given one quick look before the next.

## Building screens

Figures are iOS points at 390x844, written as CSS pixels, unless marked Android; a native build takes them from the platform's own styles and components.

- **Type**: one fixed scale. Large Title 34/41; Title 1 28/34; Title 2 22/28; Title 3 20/25; Headline 17/22 semibold; Body 17/22; Callout 16/21; Subheadline 15/20; Footnote 13/18; Caption 1 12/16; Caption 2 11/13. Hierarchy from weight and colour, not new sizes; the one exception is the hero figure (a balance, a ready-by time), about 44-64. The smallest text is 11. Stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`; Android `Roboto, system-ui, sans-serif` with the Material scale (Body 16/14/12sp). `tabular-nums` on prices, times and balances.
- **Colour**: grouped ground `#F2F2F7` / dark `#000000`; cell `#FFFFFF` / `#1C1C1E`; raised `#FFFFFF` / `#2C2C2E`; fill `#E5E5EA` / `#2C2C2E`; separator `#D1D1D6` / `#3A3A3C`; secondary text `#6C6C70` / `#AEAEB2` (the system's own 60% grey fails 4.5:1). The accent is for what the user can act on and the current state, never on text that does nothing.
- **One colour-filled button per screen**, two at most; every other control grey-filled, tinted or plain text. The action that belongs to the content (order, book, pay) is a full-width button about 50 tall, pinned at the foot of the screen or sheet, its label a verb with the amount ("Pay £12.40"). A button that commits an edit (Done, Save) sits at the top trailing corner of the sheet.
- **Space**: 4, 8, 12, 16, 24, 32, 48; 4-8 inside a group, 12-24 between cards, 32-48 between sections; margins 16. The same gap everywhere is a fault: the difference between gaps is what groups things. Corners: a capsule, one small set of radii, or concentric (inner = outer minus padding). At most one soft shadow, only on what floats (the tab bar, a sheet).
- **Bars**: draw the status bar (the time leading, signal, wifi and battery trailing, `aria-hidden`) and the home indicator (a round bar about 134 by 5, about 8 above the bottom). Insets `max(env(safe-area-inset-top), 47px)` and `max(env(safe-area-inset-bottom), 34px)`. On iOS the tab bar floats as a capsule inset about 21 from the edges, in a translucent material with an opaque fallback under `prefers-reduced-transparency`; labels single words, icons filled, never an action or a disabled tab. The top bar has no strip at rest; the first screen of each tab opens with a large title that collapses as content scrolls. Glass belongs to the navigation layer alone, never on content cards. Android: a 64dp navigation bar with a 56x32dp indicator pill, 3-5 destinations.
- **Sheets**: a grabber when resizable; top corners about 20; a scrim about 25% black; everything behind `inert`; Cancel top leading, Done top trailing; the main button pinned at the foot above the keyboard.
- **Icons**: one family in one weight (Phosphor, Lucide, Tabler, Ionicons; Material Symbols on Android), inlined as SVG. Never embed SF Symbols in HTML: Apple licenses them for apps on Apple platforms only.
- **Words**: an app screen is glanced at. One line of secondary text per row; buttons and empty states use concrete verbs ("Order the usual"), never "Welcome back".
- **States**: empty (teaches the next step), loading (a spinner in the button with a changed label, or a skeleton), sold out (greyed, still findable, says when it returns), failed payment (says what happened, keeps the basket), offline (keeps what the user typed, offers a retry).
- **Feel**: every control has a pressed state (opacity .6 or scale .97, gone within 150ms). Motion like the system's: no bounce, about 400-500ms, about `cubic-bezier(0.32, 0.72, 0, 1)`; pushing a screen slides it in (View Transitions inside the one page), sheets slide up, all off under reduced motion. Feedback in place on iOS ("Added"); a bottom message with undo on Android. Links are rows or buttons. A 36-tall pill is fine when its hit area is 44.
- **Touch and typing**: targets 44pt / 48dp; the whole row is tappable; every gesture has a visible alternative; ask for as little typing as possible, one field per row with the right keyboard; the focused field and submit stay above the keyboard. Ask for a permission at the moment it is needed.

## An HTML prototype

The deliverable is the app itself at phone size, in `index.html` unless the project dictates otherwise: no device frame, the status bar and home indicator drawn, every screen reachable by tapping and by URL hash (`index.html#detail`), each opened directly showing a sensible sample. Pin "today" in one constant and work every weekday out from it in code; every sum on screen adds up. Say it is sample data once, at the foot of the main screen's scroll or on the account screen.

Capture each screen by its hash, as a URL (`file:///.../index.html#detail`; a bare path cannot carry a hash), with `node "<skill>/scripts/shot.js" <url> --widths 390,320 --height 844 --scheme light --app --check`, then once at 390 with `--scheme dark`. Reach a sheet or later state with `--tap "<selector>"` or `--tap "text=Pay £12.40"`. The final look, the reviewer's captures and the report are at 390, light and dark, never desktop widths. Without a browser, `lint.js --app` reads the source with the app rules. Before the reviewer looks, use the main flow by hand once.

## Native work

Build and run it on a simulator or device and capture the screen. Look at four things at least: light, dark, a large accessibility text size, and the screen after its main action.

| | iOS Simulator | Android emulator or device |
|---|---|---|
| Screenshot | `xcrun simctl io booted screenshot shot.png` | `adb exec-out screencap -p > shot.png` |
| Dark appearance | `xcrun simctl ui booted appearance dark` | `adb shell cmd uimode night yes` |
| Large text | `xcrun simctl ui booted content_size accessibility-large` | `adb shell settings put system font_scale 1.3` |

Relaunch after changing the text size; wait for sheets and transitions to finish before capturing; set appearance and text size back when done. Use the platform's named text styles so text scales, line content up with the system's margins, and leave the system's parts (status bar, navigation bar, sheets, alerts, keyboard) standard. On tablets and foldables, use the width with two panes.

## App faults

Check these on every look: a solid colour on every screen; a full-width strip tab bar on iOS; an empty band where the status bar should be; icons from mixed families, or hand-drawn; thumbnails where the picture is the product; a photo grid ending in blank tiles; a marketing headline or an explanatory paragraph under a figure; more than one colour-filled button; invented type sizes; glass on content cards; the accent on text that does nothing; a default system blue as the accent; SF Symbols in HTML; the same gap everywhere; a display face in body text; a drawn map; a device frame instead of the app; underlined text links; a tab named Home or Profile by habit; a second visual design for dark mode; a wrong weekday or a sum that does not add up; at large text, clipped rows or a stranded separator; system grey text failing on a custom ground; a back gesture that traps the user.

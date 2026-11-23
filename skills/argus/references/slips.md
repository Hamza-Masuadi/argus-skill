# Slips

Mistakes that were actually found in generated pages, mostly in work that read as correct in code. Go through the sections that apply each time you look at a rendered result. The numbers behind them are in `craft.md`.

Last revised: 2026-11.

## Every surface

**Broken: fix first**

- **A column collapses.** A grid or flex child loses its width and its text breaks to a word per line. Look at every multi-column section at desktop width.
- **The page scrolls sideways** at 320 or 390. Something is wider than the screen: a chart, a table, a long word, a button.
- **The main action leads nowhere.** The form posts to an address that does not exist, opens an email client, or shows an error for a correct entry. Fill it in and submit it.
- **Content never appears.** An entrance animation leaves text invisible until scroll, or forever if the script fails or the tab was in the background. Hiding styles must wait for the script to mark the document ready (`craft.md`, Motion).
- **Text is clipped or overlapping.** Labels on charts and timelines collide when narrow; positioned text sits on other content.
- **A raw value reaches the screen**: `undefined`, `NaN`, `null`, `[object Object]` or Lorem ipsum where a real value or sentence belongs. Look at every figure and empty state.
- **Everything sits in a narrow column** at 1440 and 1920: every section held to 900-1100px or less, with wide empty margins, so the page looks small on a desktop. Widen the layout container and let sections use the width; keep only prose narrow (`craft.md`).

**Phone width**

- Navigation to other pages vanishes with no menu to replace it. (Dropping up to three links to sections of this same page is allowed: `web.md`.)
- The main action is out of reach: neither in the header nor on screen. Or the opposite: two identical full buttons on one phone screen, in the header and in the hero. On a phone the header shows the action only once the hero's own button has scrolled out of view, or shows a compact form of it (`web.md`, "The header and the footer").
- A menu button that does not open from the keyboard, does not say whether it is open, or is under 44px.
- Buttons wrap to two lines or run past the edge.
- Pressable things are too small: nav and footer links, sliders, steppers, secondary buttons.
- A table or chart drops a column and nearby text still refers to it.
- Form fields with text under 16px, which makes an iPhone zoom in when the field is tapped.
- Dense screens: a section running past about 2.5 screens at 390, or a page past 14 screens at 390 or 16 at 320, usually because desktop sections were simply stacked (`craft.md`). Length alone is not the fault; screens carrying several messages are. Split or cut until each screen says one thing; never strip a section of its picture.
- A sticky header takes more than about a tenth of the screen, or wraps to two rows.
- The main action is below the first screen on a phone although it fits on desktop.

**Text**

- Captions, labels and footnotes below the smallest allowed size.
- The quietest text fails contrast: notes, labels, footnotes, placeholder text.
- A heading wraps badly: one word alone on the last line, or a line starting with punctuation because an inline element split from it.
- Wide letter-spacing breaks up numbers.
- A web font fails to load and the fallback changes every measurement.

**Structure and controls**

- A select, button or input inside a heading by accident: unnamed, or turning the heading into nonsense when read aloud. A deliberate headline that is a control, marked up as `web.md` says, is fine.
- More than one `h1`, or heading levels skipped.
- No skip link; focus lost after a form succeeds.
- An error that does not mark its field, or that blames the user for a system failure.
- A field with a placeholder and no visible label.
- Motion with no reduced-motion version; something that moves by itself for more than five seconds with no pause control; motion that flashes, animates layout properties, or delays the primary action.
- Buttons for one action in several styles, heights or shapes (`check.js` measures it: `button-styles`).
- Content boxed for no reason: bordered or shaded cards around text that is not a distinct object.
- A control that silently stops at a limit without showing it is disabled.
- A change that is lost on reload, or confirmed only to screen readers.
- A figure left showing a sum that no longer adds up after the state changed.
- Two statements on the same page that contradict each other.
- The same value shown in two places disagrees: a clock in the header and one in the page, a total and its breakdown.
- Two copies of one form or control that do not stay in step: filling one leaves the other stale.
- An error message changes the layout: a neighbouring field stretches, a row jumps. Trigger every error and look.
- A list in no order a reader could name (time, price, name).
- Time-based content opens on what is already past (today's sessions that have left, classes that have started). Lead with what is next and bookable.

**Over-building**

- Machinery nobody asked for: a second colour mode, a network call to justify a loading state.
- Invented proof: customer counts, logos, testimonials.
- The same palette as the last piece of work in this project.

## Persuade surfaces only

- **The idea is only a layout.** Asked what the page's idea is, the honest answer is an arrangement or a mood.
- **A drawing of the premises stands in for an idea.** The shopfront, the building or the street sits beside an ordinary headline. Build from what the customer handles or does instead (`create.md` step 2, the subject's kit).
- **Dark by habit.** A dark ground, a very large condensed capital headline and one warm accent, with no reason from the subject or from when it is used (`tells.md`).
- **Nothing big on the first screen.** Everything is a sensible medium size, the headline included.
- **One colour floods the page.** A single warm hue (yellow, cream, amber, kraft) covers every surface, so the action has nothing to stand out from. Go back to two neutrals and one accent (`ingredients.md`).
- **The headline says nothing only this business could say.** It describes the layout or the category instead of the difference or the belief from the user's answers (`ask.md`).
- **The directions were one idea.** Every rough shown was built around the same object or interaction, or shared a hue family. Replace until they differ (`create.md` step 2).
- **The idea stops at the hero.** The sections below are plain bands and cards that could sit on any site: each fails the section test (`create.md` step 3). Rebuild each from its own kit item.
- **The kit used once.** The kit lists eight or ten things and the page uses one of them, in the hero.
- **One picture, then text.** The hero has a visual and every section below is headings, paragraphs and cards (`imagery.md`).
- **Drawn when it could be real.** Illustrations on a page about real things, or drawn shapes standing in for a software product's interface, while photographs could have been found or the product shown. Usable photographs rejected because they clashed with the drawings; the user asked whether to find photographs instead of Argus finding them (`imagery.md`).
- **Every direction concept-led.** A set of three or more with no plain, photograph-led or product-led direction among them (`create.md` step 2).
- **A forced device.** A gimmick invented so a section has "a device": questions hidden behind drawn tools, a price revealed by a game. A section may be simple; questions and answers are readable text (`create.md` step 3).
- **Still.** Nothing on the first screen lives, the page does not arrive, and the sections simply sit there (`create.md` step 3, `craft.md` Motion).
- **Thin.** A hero and two or three short blocks, with a visitor's obvious questions unanswered.
- **The first screen is half empty**, or a blank band follows the hero.
- **The stock header.** A wordmark on the left, three or four links and a button on the right, the same whatever the subject: links to sections that do not exist, "Blog" or "About" by habit, labels from a stock list instead of the section plan, a sticky bar nobody chose, and a four-column footer on a one-page site. Rebuild it from what this site's visitor needs (`web.md`, "The header and the footer"; `check.js` reports dead links: `dead-link`, `missing-anchor`).
- **The action is a jump link** to a form far below. (A header button that jumps to a form on the first screen is fine.)
- **The form is small beside a huge headline.**
- **A demo starts empty** and shows nothing until touched.
- **Rough finish.** A drawing, diagram or map cruder than the type around it; a first screen that works but that nobody would share. The first screen must pass the bar in `create.md` step 7, and every section gets the pass in step 8. A plain rival with better finish is preferred by most viewers.
- **Chosen depth stripped.** A glow, gradient, shadow or texture the direction chose was removed as if it were a tell. Restore it (`tells.md`).
- **A wide section left half empty** at 1440 or 1920 because its content was sized for a phone.
- **The same content appears twice**, or the action sits sections away from what it acts on. (Repeating the action itself is not this.)
- Tells that arrived unchosen: see `tells.md`.

## Operate surfaces only

See the list at the end of `product.md`.

## Photo-led pages only

See the list at the end of `photos.md`.

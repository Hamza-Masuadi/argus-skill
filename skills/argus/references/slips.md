# Slips

Mistakes that were actually found in generated pages, mostly in work that read as correct in code. Go through the sections that apply each time you look at a rendered result. The numbers behind them are in `craft.md`.

Last revised: 2026-11.

## Every surface

**Broken: fix first**

- **A column collapses.** A grid or flex child loses its width and its text breaks to a word per line. Look at every multi-column section at desktop width.
- **The page scrolls sideways** at 320 or 390. Something is wider than the screen: a chart, a table, a long word, a button.
- **The main action leads nowhere.** The form posts to an address that does not exist, opens an email client, or shows an error for a correct entry. Fill it in and submit it.
- **Content never appears.** An entrance animation leaves text invisible until scroll, or forever if the script fails.
- **Text is clipped or overlapping.** Labels on charts and timelines collide when narrow; positioned text sits on other content.

**Phone width**

- Navigation vanishes with no menu to replace it.
- The main button drops out of the header.
- Buttons wrap to two lines or run past the edge.
- Pressable things are too small: nav and footer links, sliders, steppers, secondary buttons.
- A table or chart drops a column and nearby text still refers to it.
- Form fields with text under 16px, which makes an iPhone zoom in when the field is tapped.
- The page is enormously long because desktop sections were simply stacked.
- A sticky header takes more than about a tenth of the screen, or wraps to two rows.
- The main action is below the first screen on a phone although it fits on desktop.

**Text**

- Captions, labels and footnotes below the smallest allowed size.
- The quietest text fails contrast: notes, labels, footnotes, placeholder text.
- A heading wraps badly: one word alone on the last line, or a line starting with punctuation because an inline element split from it.
- Wide letter-spacing breaks up numbers.
- A web font fails to load and the fallback changes every measurement.

**Structure and controls**

- A select, button or input placed inside a heading.
- More than one `h1`, or heading levels skipped.
- No skip link; focus lost after a form succeeds.
- An error that does not mark its field, or that blames the user for a system failure.
- A field with a placeholder and no visible label.
- Motion with no reduced-motion version; something that moves by itself with no pause control.
- Two different styles for the same primary action on one screen.
- A control that silently stops at a limit without showing it is disabled.
- A change that is lost on reload, or confirmed only to screen readers.
- A figure left showing a sum that no longer adds up after the state changed.
- Two statements on the same page that contradict each other.
- The same value shown in two places disagrees: a clock in the header and one in the page, a total and its breakdown.
- Two copies of one form or control that do not stay in step: filling one leaves the other stale.
- An error message changes the layout: a neighbouring field stretches, a row jumps. Trigger every error and look.
- A list in no order a reader could name (time, price, name).

**Over-building**

- Machinery nobody asked for: a second colour mode, a network call to justify a loading state.
- Invented proof: customer counts, logos, testimonials.
- The same palette as the last piece of work in this project.

## Persuade surfaces only

- **The idea is only a layout.** Asked what the page's idea is, the honest answer is an arrangement or a mood.
- **Nothing big on the first screen.** Everything is a sensible medium size.
- **The idea stops at the hero.** The sections below could sit under any other first screen.
- **Big but lifeless.** Large and high in contrast, and nothing responds.
- **Thin.** A hero and two or three short blocks, with a visitor's obvious questions unanswered.
- **The first screen is half empty**, or a blank band follows the hero.
- **The action is a jump link** to a form far below. (A header button that jumps to a form on the first screen is fine.)
- **The form is small beside a huge headline.**
- **A demo starts empty** and shows nothing until touched.
- **Rough finish.** A drawing, diagram or map cruder than the type around it; a first screen that works but that nobody would share. Once everything works, give the first screen and any illustration one pass for finish alone: depth, light, detail, alignment. A plain rival with better finish is preferred by most viewers.
- **A wide section left half empty** at 1440 because its content was sized for a phone.
- **The same content appears twice**, or the action sits sections away from what it acts on.
- Tells that arrived unchosen: see `tells.md`.

## Operate surfaces only

See the list at the end of `product.md`.

## Photo-led pages only

See the list at the end of `photos.md`.

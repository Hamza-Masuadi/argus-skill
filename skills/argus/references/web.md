# Designing for the web

What goes where on a web page, and what the web itself expects. The idea, the big move and the shape of the argument are in `create.md`; numbers are in `craft.md`; dashboards and tools are in `product.md`.

## Start from the visitor's question

Every page answers a question the visitor arrived with. Write it down before laying anything out, because it decides what goes first.

- Landing page: "What is this, is it for me, and what do I do next?"
- Pricing: "What will it cost me, and which option is mine?"
- Article or docs: "Does this answer my question, and where?"

## Use the width

Only running prose sits in a narrow column. The page itself uses the screen: a layout container of about 1200-1440px with side padding, and backgrounds, pictures, bands and the first screen edge to edge. A page built as one narrow centred column looks small on a desktop monitor; look at it at 1920 to see. Numbers in `craft.md`.

## Landing and marketing pages

- **The first screen does three jobs**: says what the thing is in plain words, shows it, and offers one next step. A visitor who reads only the headline should be able to describe the product.
- **The action is on the first screen, sized to match the headline.** If the goal is a sign-up, the field itself sits in or beside the hero. A giant headline over a small, quiet form says the action is an afterthought. On phones the main action stays in reach, shown once per screen (below, "The header and the footer").
- **Show the thing, large.** A real photograph, or the product itself working, and below the first screen pictures that are large rather than many: edge to edge or filling their column, not boxed in a card. A section without a good picture is type-led (`imagery.md`), not padded with a weak one. Where pictures come from, in order, is in `imagery.md`: supplied, the product itself, then stock photographs found without asking, generated images only when the user asks for them, and drawn illustration last. Never a stock picture with no connection to the subject, or an abstract shape standing in. Say in the report if real imagery would improve it.
- **Mark product mock-ups.** A drawn app window or phone screen carries `data-mock` on its outer element, so `check.js` leaves its text out of the page's count of type sizes (`many-type-sizes`); where it is only a picture, it also gets `role="img"` and an `aria-label`. A working demo keeps its controls reachable. The page's own text is still counted.
- **Motion is a layer, built to `craft.md`.** A live element in the hero, an arrival under about a second, sections that arrive as they enter view, physical hover and press feedback on every control, and at most one ambient loop. Content is visible without script, and every animation has a reduced-motion version.
- **A headline that is itself a control** (a sentence with a choice inside it, such as a size or a day): the heading element holds the sentence as text, and each choice is a real `button` or `select`, inside the heading or right beside it, with an accessible name of its own (`aria-label="Choose a day"`). Read aloud, the heading must still make a sentence with the current value. Never fake the control with a styled `span`.
- **One message per screen reads best.** A short heading, a sentence or two, one picture, at most one action. A long page of simple screens beats a short page of crowded ones (`craft.md`, length).
- **Vary the rhythm.** Sections that share one layout blur together. Change density, alignment and scale between them while type and colour stay constant.
- **One primary action**: one kind of action in one style, worded the same wherever it repeats. It may appear several times (on each bookable item, at the start and at the end). Anything else is visibly secondary.
- **Proof is specific or absent.** A named customer, a real number with its source, a real quotation. Vague proof reads as none.
- **Navigation is short**: five or six items at most, and designed from this site (below).
- **A form with no backend still completes.** Validate the input and show the confirmation the finished product would show, as real copy. Note in a code comment and in the report that it is not connected. Never post to an invented address, hand off to an email client, or tell visitors "this is a preview". The two labels differ: sample data the page shows (figures in a demo, taken slots, a catalogue) is labelled as sample once on screen; a form not being connected is said only in the code comment and the report.
- **End with the action** and the practical details: price, contact, what happens next.

## The header and the footer

The header is designed from this site, not drawn from habit. A wordmark on the left, three or four links and one button on the right, the same whatever the subject, is the default to avoid, not a starting point.

- **Decide what it is for before drawing it.** From the lines on what this site is for and the section plan (`create.md` steps 1 and 3), answer one question: what does a visitor need at every scroll position? Often only the name and the one action. A one-page site may need no links at all.
- **Links are the page's real sections, in the visitor's words**, in page order, and only those worth jumping to: usually two to four. Their labels come from the section plan, not from a stock list ("Features / Pricing / FAQ"). Never a link to something that does not exist: no "Blog", "About" or "Resources" by habit, no `href="#"`, no `#id` with nothing behind it (`check.js` reports both: `dead-link`, `missing-anchor`).
- **One extra item: what this kind of visitor looks for first**, when the business has it. A place with opening hours can show whether it is open now and its phone number; a booking business shows the booking action; an app shows its download for the visitor's platform; a shop shows the basket; a service shows how to reach a person. One such thing, not all of them.
- **It belongs to the direction.** It uses the direction's type, colour and shape, and its form follows the first screen: over a full-bleed picture it sits on the picture with no bar; on a type-led page it may be a single line; it need not be a full-width bar with three zones. In a set of directions the headers differ as the directions differ; an identical bar across all of them is a sign the directions only changed paint.
- **Its behaviour is chosen, not defaulted.** Sticky only when the page is long and the action must stay in reach; then it is slim (about a tenth of a phone screen at most), covers no content and never hides a focused element. The direction says in one line what the header does on scroll.
- **On a phone** the name and the main action stay in view, the action in the hero or the header. With three links or fewer, show them or drop them rather than hiding them behind a menu; drop only links to sections of this page, which scrolling reaches anyway, never links to other pages. A menu button only when there are more: it opens and closes from the keyboard, says whether it is open (`aria-expanded`), and is a 44px target. Never two identical full buttons on one screen: the header shows the action only once the hero's own button has scrolled out of view, or shows a compact form of it (a shorter label, a smaller size).
- **The footer follows the same thinking.** It holds what a visitor at the bottom needs: the action again, how to reach the business, and the legal minimum; a one-page site gets no four-column farm of links.

## Reading pages

- The text column is the design. Set measure, line height and heading hierarchy first, then add only what helps reading.
- Long pages show their structure (contents, clear headings) and where the reader is.
- Code, tables and figures may be wider than the text column; plan for it.

## What the web itself expects

- **Links look like links, buttons look like buttons.** Navigation is a link; an action is a button.
- **The address bar is part of the interface.** A view someone would bookmark or share (a filter, a tab, an open item) lives in the URL, and the back button undoes navigation, never work.
- **Any width, any input.** Mouse, touch and keyboard all work. Nothing essential depends on hover.
- **Usable while loading.** Reserve space for images and late content so the layout does not jump.
- **The visitor's settings are respected**: reduced motion, larger text and zoom always.
- **Works without the script.** Anything a script animates in is visible when the script has not run (`craft.md`, Motion).

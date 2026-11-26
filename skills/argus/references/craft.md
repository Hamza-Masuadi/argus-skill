# Craft: the floors and the web page

Contents: **Floors** · **Space and controls** · **Motion layers and safety** · **Waiting** · **Length** · **Copy** · **Other languages** · **The web page** · **The header and the footer** · **What the web itself expects**.

The floors every surface keeps, and what a web page expects. An existing design system overrides all of it except accessibility, and so does the user. Page type, colour, layout and motion numbers are in `type.md`, `colour.md`, `layout.md` and `motion.md`; native app sizes in `app.md`.

## Floors

| | Pages (Persuade, Read) | Dense product UI (Operate) |
|---|---|---|
| Body text | 16px floor; 17-20px set in `type.md` | 13-14px |
| Smallest text anywhere | 12px | 12px, including inside charts |
| Text typed into a field at phone width | 16px or more | 16px or more (smaller makes iPhones zoom on focus) |
| Line height | `type.md` | about 1.4 |
| Scale | a few size roles, each a token (`type.md`) | fixed; ratio 1.125-1.2; four or five sizes |

- **Contrast** (WCAG 2.2 AA): text 4.5:1, large text (about 24px, or 19px bold) 3:1; control boundaries, focus rings and meaningful graphics 3:1. Never waived.
- **Targets**: 24x24 CSS px is the floor (inline text links exempt). 44px at phone widths (44pt iOS, 48dp Android) is the goal: the checker reports a target between 24 and 44 as roughness, not a failure. 28-32px is fine for dense desktop controls used with a pointer.
- Status is never shown by colour alone. Every surface uses at most two type families. Numbers that align use tabular figures and are never letter-spaced wide.
- The web keeps one colour mode unless asked; native apps and their prototypes follow the system's light and dark (`app.md`).

## Space and controls

- Product UI uses a base of 4: steps 4, 8, 12, 16, 24, 32, 48, 64; table rows 32-40px. Pages use the fluid scale in `layout.md`.
- Space inside a group is clearly smaller than between groups; more above a heading than below. Group with space first, a divider second, a box last; never a card inside a card.
- **One button style and one size** for the primary action across the page, one quieter style for the rest: 40-48px tall on desktop, 44px or more at phone width; its shape from the page's shape system (`colour.md`, C12).

## Motion layers and safety

Motion is a designed layer, sized to the direction (`motion.md`). On Operate surfaces it stays sober: feedback and state changes only.

| Layer | Persuade and Read | Operate |
|---|---|---|
| **Feedback**: hover, press and focus on every interactive thing | Always | Always |
| **State changes** animate between values | Always | Always |
| **Arrival**: the first screen assembles in a short sequence | Optional, under about a second; none is fine | None |
| **Scroll reveals** by content type | Optional, gentle | None |
| **Scroll-linked** or a **live element** | Only for the page's one or two moments | None |
| **Ambient**: a quiet loop | At most one per screen, stopped off screen | None, unless it shows something live |

**How the layers are built**, in any framework:

- **Arrival**: first-screen elements carry an order (`--i: 0, 1, 2`) and `transition-delay: calc(var(--i) * var(--stagger-line))`; it plays when the script marks the document ready.
- **Scroll reveals**: one `IntersectionObserver` per page watches each section's children (threshold about 0.15), adds a class that plays the transition, then stops observing. Observe something with visible area: an element hidden by its own `clip-path` or scaled to nothing reports none, so observe its parent or use threshold 0.
- **Scroll-linked**: CSS scroll-driven animations inside `@supports (animation-timeline: view())`, the finished state elsewhere; never a scroll listener reading layout each frame.
- **Counting**: the final value is in the HTML; the count only animates toward it.

**Safety, which nothing overrides:**

- **Visible by default.** Hiding styles apply only under a class the script adds to the root once it has run (`.motion-ready .reveal:not(.is-in) { opacity: 0 }`). If the script fails, or the page opens in a hidden tab, everything shows.
- **Never depend on a frame or an observer firing.** Add the hiding class inside the first frame callback; a timer about 150ms later marks the arrival done regardless; if the observer has reported nothing within about a second, a timer reveals everything still hidden.
- **Reduced motion.** Every animation has a `prefers-reduced-motion: reduce` version that removes movement and keeps the end state. Check it in script too (`matchMedia`).
- **Pause.** Anything moving by itself for more than five seconds, a looping video included, has a visible pause control, or stops within five seconds.
- **Nothing flashes** more than three times a second, and **motion never delays the primary action**.
- **Scroll stays the visitor's.** No hijacked speed, no forced snapping of the page. A sticky scene runs up to two or three screens, no taller than its steps, and stacks on phones.

## Waiting

| Wait | Show |
|---|---|
| Under about 1 second | nothing |
| A whole view, a few seconds | a skeleton matching the layout |
| One module | a spinner |
| Over 10 seconds | a progress bar and a way to cancel |

## Length

Length is about simplicity, not a screen count: a page may be long when each section carries one message. The checker flags a page over 14 screens at 390 wide or over 16 at 320, and any section taller than about 2.5 screens at 390 (`page-length`, `section-length`). Fix by giving each section one message: cut words, split a crowded section, merge two thin related ones, turn a long list into a horizontal row; never by stripping a section of its picture.

## Copy

- Buttons name the outcome: "Save changes", not "OK" or "Submit". Errors say what happened and what to do, without blame. Undo instead of confirmation for anything reversible.
- One capitalisation rule; sentence case is the safer default.
- A headline is about six words, eight at most for a specific detail, eight to ten when a number makes the offer.

## Other languages

Translated text grows by a third or more; never size a container to the English string. Right-to-left languages mirror the layout (use start and end), but not numbers, media controls or logos. Arabic-script text needs more line height and is never letter-spaced. Use a typeface that contains the script at the weights used.

## The web page

Every page answers a question the visitor arrived with ("What is this, is it for me, and what do I do next?"; "What will it cost me?"; "Does this answer my question?"). Write it down before laying anything out.

- **Use the width.** Only running prose sits in a narrow column. The page uses the screen: a layout container of about 1200-1440px with side padding, and backgrounds, pictures, bands and the first screen edge to edge. Look at it at 1920.
- **The action is on the first screen, sized to match the headline.** If the goal is a sign-up, the field itself sits in or beside the hero. A giant headline over a small, quiet form says the action is an afterthought.
- **Show the thing, large**, sharp at the size shown (`pictures.md`). A section without a good picture is type-led, not padded with a weak one.
- **Mark product mock-ups.** A drawn app window or phone screen carries `data-mock` on its outer element, so the checker leaves its text out of the page's counts; where it is only a picture, it also gets `role="img"` and an `aria-label`.
- **A headline that is itself a control** (a sentence with a choice inside it): the heading holds the sentence as text, and each choice is a real `button` or `select` inside or beside it, with its own accessible name. Read aloud, the heading still makes a sentence.
- **A form with no backend still completes.** Validate the input and show the confirmation the finished product would show, as real copy. Note in a code comment and in the report that it is not connected. Never post to an invented address or hand off to an email client.
- **Reading pages**: the text column is the design. Set measure, line height and heading hierarchy first; long pages show their structure and where the reader is.

## The header and the footer

The header is designed from this site, not drawn from habit. A wordmark left, three or four links and one button right, whatever the subject, is the default to avoid, not a starting point.

- **Decide what it is for.** What does a visitor need at every scroll position? Often only the name and the one action. A one-page site may need no links at all.
- **Links are the page's real sections, in the visitor's words**, in page order, only those worth jumping to: two to four, six at most. Never a link to something that does not exist: no "Blog" or "About" by habit, no `href="#"` (the checker's `dead-link`, `missing-anchor`).
- **One extra item: what this kind of visitor looks for first**, when the business has it: open now and the phone number, the booking action, the basket, the app download.
- **It belongs to the direction**: its type, colour and shape, and a form that follows the first screen (over a full-bleed picture it sits on the picture with no bar). In a set of directions the headers differ as the directions do.
- **Its behaviour is chosen.** Sticky only when the page is long and the action must stay in reach; then slim (about a tenth of a phone screen at most), covering no content and never hiding a focused element.
- **On a phone** the name and the main action stay in view. With three links or fewer, show them or drop them rather than hiding them behind a menu (drop only links to sections of this page). A menu button only when there are more: it opens and closes from the keyboard, says whether it is open (`aria-expanded`), and is a 44px target. Never two identical full buttons on one screen: the header shows the action once the hero's button has scrolled away, or a compact form of it.
- **The footer** sits in or under the designed ending (`flow.md`): the action again, how to reach the business, the legal minimum, and where they apply the one sample-data line and the credits. A one-page site gets no four-column farm of links.

## What the web itself expects

- Links look like links, buttons look like buttons. Navigation is a link; an action is a button.
- A view someone would bookmark (a filter, a tab, an open item) lives in the URL, and the back button undoes navigation, never work.
- Mouse, touch and keyboard all work; nothing essential depends on hover.
- Space is reserved for images and late content, so the layout does not jump.
- The visitor's settings are respected: reduced motion, larger text and zoom.
- Details that signal care: `::selection` in the accent; a visible `:focus-visible` ring at 3:1; `theme-color` set to the ground; an SVG favicon from the motif; a designed 404 and empty states; `@media print` without navigation and motion.

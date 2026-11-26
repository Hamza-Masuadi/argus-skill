# Faults

Contents: **Whole default looks** · **Faults found in real pages** · **What the checker reports**.

Last revised: 2026-11. These drift as models change.

A default is a choice that appears because it is the default, and readers have learned to recognise it. **Nothing here is banned.** Each pattern below is fine when the brief, the existing system or the subject asks for it, and a user who asked for one gets it built well. The question for each: was this chosen, or did it just arrive? After replacing a default, check the replacement is not the next most common one; what cures that is a direction from the subject, a reference from the user, and the history.

## Whole default looks

Defaults arrive as a whole look: three or four features that come together because each makes the next feel natural. **Three shared features, none of them chosen, send the rough or page back to its idea**, not to a new coat of paint. One or two shared features are judged one by one.

- **The habitual set (what a dealt deal turns into when nothing pushes back).** A pale cream or near-white ground; the first screen as text on the left and a picture on the right; a small all-caps or monospace label above every heading; a monospace face for "designations"; a grid of equal cards numbered 01 to 04; a step timeline. With three or more present, change the skeleton or the type and ground, not the details (`build.md`, the section pass).
- **The quiet editorial page.** A cream or off-white ground, a serif headline with one phrase in italic, small all-caps tracked labels above headings, tiny icons, a lot of empty space, everything muted. Each part is fine alone and when chosen for the subject; the set arriving by habit reads as "made by an AI" to many people now. Room must be earned by a strong thing in it.
- **The launch page.** A near-black ground, a purple or blue glow or gradient behind the headline, a tilted floating screenshot, a centred badge, headline, subhead and two buttons.
- **The generated landing page.** A centred hero over a gradient blob; glass panels on a bento grid of equal tiles; three equal cards with thin-line icons; Tailwind blue or indigo with a pale tint behind every badge; uniform padding, radius and card height. Bento, glass and mesh are each fine when they fit the content; the habit is the set.
- **The warm default.** A cream, beige or kraft ground flooding the page, a serif display in terracotta or amber, soft rounded cards, reached for because the brief said "warm". Warmth may come from the pictures, the type and the wording.
- **The dark stage.** A dark ground, a very large condensed all-capitals headline, one warm accent, reached for because it looks dramatic. Light or dark comes from where and when the thing is used.
- **The studio portfolio.** The overcorrection when told not to be generic: one giant headline, numbered monospace labels, a clock or coordinates in the header, no picture, nothing from the business.
- **The dashboard default.** Four figure cards with sparklines, a large chart, a table, every block in the same rounded card. Start from the question this person arrives with (`product.md`).
- **The dark developer tool.** Near-black, monospace for most text, a green or cyan accent, a self-typing terminal hero.
- **A costume on every section.** Tickets, receipts, chalk, notebook paper, sticky notes as section styling, so the product gets lost among the props. One idea, one or two moments, the rest well set (`ideas.md`).
- **Every effect at once.** A cursor follower, marquee, tilt, scramble and scroll scene on one page, whatever the subject (`motion.md`, "How much").

A direction drawn from the subject may share a trait with a default look (a boarding card sets its figures in mono): name the trait in the report.

## Faults found in real pages

Mostly in work that read as correct in code. Look for these on the captures.

**Broken: fix first.** A column collapses to a word per line. The main action leads nowhere: the form posts to an address that does not exist or opens an email client. Content never appears because an entrance animation hides it until scroll, or forever if the script fails or the tab was in the background. Labels on charts collide when narrow. Images render at their intrinsic height (missing `height: auto`), making the page enormous.

**At phone width.** Navigation to other pages vanishes with no menu (dropping up to three links to sections of the same page is fine). The main action is out of reach, or two identical full buttons sit on one screen. A menu button that does not open from the keyboard, does not say whether it is open, or is under 44px. Buttons wrap to two lines. A table drops a column and nearby text still refers to it. A sticky header wraps to two rows.

**Structure and state.** An error that does not mark its field. A control that silently stops at a limit. A change lost on reload. A figure that no longer adds up after a state change; two copies of a value that disagree. Time-based content opening on what is already past.

**On a Persuade page.**
- The idea is only a layout or a mood; the headline says nothing only this business could say.
- A drawing of the premises (the shopfront, the street) standing in for an idea.
- The look stops at the hero: the sections below are bands and cards from another kit, every heading left and paragraph right.
- One picture, then text: every section below the hero is headings, paragraphs and cards.
- The wrong tone for the visitor: heavy display type, dark grounds or playful effects on a page meant to calm nervous people.
- A forced device: questions hidden behind drawn tools, a price revealed by a game.
- Proof far from its claim, or written by Argus; a vague or changing action label; prices without their fees.
- Sample labels scattered beside figures and photographs instead of one footer line.
- A half-empty screen with nothing strong in it, or a thin strip for an ending.
- The form small beside a huge headline; the action a jump link to a form far below.
- Chosen depth stripped: a glow, gradient or texture the direction chose, removed as if it were a default.

**Copy.** "Elevate", "seamless", "unlock", "reimagine"; "It's not just X, it's Y"; three-part rhythm everywhere; "Submit", "Learn more"; "John Doe" and "Acme"; a perfect 5.0 and a wall of badges. Write what the product does, with a verb and an object.

## What the checker reports

The checker measures many of these itself; read its messages rather than a list here (`node "<skill>/scripts/rules.js"` lists every rule with its tier). Its floor rules (contrast, overflow, covered content, broken actions, missing alt, text under 12px, video without a pause) are never waived. Its advisory rules (`blank-band`, `repeated-layout`, `lopsided-section`, `narrow-content`, `hero-crowded`, `hero-wordy`, `eyebrow`, `numbered-grid`, `motionless-page`, the colour and type prompts) ask you to look: keep what was chosen, and say why in the report.

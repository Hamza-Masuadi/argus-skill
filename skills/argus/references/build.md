# Stage 5: the rest of the page, the loop, the record

**If `.argus/run.md` exists, read it first**, and again after any compaction or when resuming.

Produces: the section and motion plans, every section, the rounds, `DESIGN.md` completed, the history recorded, the report.

Start only once the first screen, built alone, has passed its bar (`first-screen.md`).

## The section plan

Before building, write one row per section:

```
Section | Answers | Its one thing (kit) | Layout | Words | Motion
```

- **The plan makes the whole argument**, in the order in `convert.md`, "The order of the argument", with proof and the answered objections beside the claims they support. The last section returns to the opening picture or motif, with the action.
- **One idea, one or two moments** (`ideas.md`). The plan marks the moments; every other section is well set in the first screen's type, colour and spacing. A ruled list, a clear price table or a calm FAQ is a right answer; a costume per section is a fault.
- **Layouts are named and neighbours differ**, chosen by the content's shape from the dealt sections and `flow.md`.
- **The frame does not compete.** Navigation, buttons and body text serve; colour, material, detail and motion go where the eye is meant to stop. That is not a rule for a pale or sparse page: a page may be dense, dark or saturated, as long as the moments lead.
- **Each section has one thing** (`composure.md`, "One thing per section"): a picture, a drawing, a ruled table or a statement, with a short heading, a sentence or two and at most one action; or one device where it beats a list (a comparison, a worked example, a control that recalculates). Questions and answers stay readable text, in plain disclosure rows.
- **The header comes from this plan**: its links are sections worth jumping to, in the plan's words (`craft.md`).
- **Long is fine; crowded is not** (`craft.md`, "Length").

## The motion plan

Written now, by you, in `run.md`; nothing is dealt. **Name the level the owner chose** (`showpiece.md`, "Pick the level"): **still**, **moment** or **showpiece**. Unless still, the plan has the baseline, one line each (`motion.md`, "How much"): the first screen's arrival; the reveals, varied by content (a picture opens, a list steps in, a rule draws, a drawing completes), never one fade-up everywhere; the hover, focus and press of every kind of control, each showing or changing something; and the page's choreographed moment, tied to its idea and made for this subject (`bespoke.md`). Mechanics come from the snippet gallery (`assets/snippets/index.html`) or a starter (`assets/showpiece/`). A quiet direction moves less at once and more softly; it still moves. Nothing moving crosses content, and reduced motion gets finished static states. If the owner chose still, set `data-argus-motion="still"` on `<html>`.

A **showpiece** plan also lists, one line each and each from its starter: the scenes (one to three, with their beats), the preloader (or why none), the page transitions, the one WebGL layer (or none) and the toy (or none), with the floor and budget in `showpiece.md`, "The floor holds at both levels".

## Building

Build each section to the first screen's finish, copy before layout (`convert.md`): benefit before feature, proof beside its claim, objections answered where they arise. Use the project's own framework, components and dev server; check the built output too when the project has a build step (`verify.md`, "Capture").

## The rounds

The loop is in `SKILL.md`, section 5: up to three look-and-fix rounds, stopping when a round is not better. Round 1 also carries these passes; add every failure to the round's one list:

- **The section pass**, each section at both widths: one thing, the frame not competing (`composure.md`)? Something to look at, sharp, at the first screen's finish? Nothing colliding or covering text? Its layout the plan's, different from its neighbours'? Any motion visible without script, with a reduced-motion version? The action the same words and working? Every header link real? Before calling a section done, compare the page with `faults.md`'s named default set, "The habitual set": if three or more of its ingredients are present, change the skeleton or the type and ground, not just details.
- **The swap test** (`first-screen.md`, the bar) on the whole page: strengthen what fits any business with something only this one has, never with props.
- **The content pass** (`convert.md`) and **the scroll test** (`flow.md`) on fresh full-page, `--hover` and `--frames` captures, before the reviewer sees the page.
- **The motion capture**, for every page not still: `shot.js <url> --arrival --scenes --hover "<the action>" --motion-metrics --fallbacks`, plus `--transition "text=<link>"` over http, and `--perf-scroll` for a showpiece (`verify.md`, "Motion capture"). Read every contact sheet; a flag is a prompt, the sheet is the evidence. A dead arrival or moment, or a `motionless-page` finding, is a fault to fix.

**The reviewer** gets only the captures, the brief lines and `review.md` (`review.md`, "As the loop's reviewer"); never your direction or intent. Without subagents, review the captures yourself as a separate pass, findings written before fixing, and say so.

**Keep the best version.** Save each round's captures and changed files (`.argus/rounds/<n>/`). If a round looks worse than the last, go back to the better version; a louder page is not a better one, and neither is a barer one.

**The finishing pass.** After the last round and before the final look, every page gets `finish.md`, in its order; record what changed in `run.md`.

Before the final look, check off:

- [ ] Motion level named in `run.md`; unless still, the arrival, reveals, hovers and moment built and seen moving; a showpiece's scenes, preloader, transitions, WebGL layer and toy each from its starter
- [ ] Motion capture read, sheet by sheet
- [ ] The in-between widths (768, 820, 1024) captured with the checker: nothing collides, no picture blank
- [ ] The finishing pass done (`finish.md`) and its changes in `run.md`

## The record

After the loop: complete `DESIGN.md` with what was built (final tokens and values, type families and sizes, spacing and radii, components and where they live, the motion as built, each image's source and licence, any decision that changed and why; `design-md.md`). Then record what was **built**, not what was dealt, with every swapped hero, section or pairing replaced by the one built: `node "<skill>/scripts/deal.js" record --history .argus/history.json <ids>`. It rejects ids that are not in the library (most likely a typo); a section made for this page is recorded with a prefix, `section:<name>`. Rewrite `run.md` as finished. Say in the report what was written.

## What to read

- **Whole**: `finish.md`, at the finishing pass; `showpiece.md`, for a showpiece.
- **In part**: `showpiece.md`, "Pick the level", for every page; `composure.md`, at the section plan, the sections it names; `flow.md`, "Section variety" and "The scroll test"; `layout.md`, "Space" and "Sections"; `motion.md`, "How much" and "Choosing"; `bespoke.md`, for the moments; `pictures.md`, "Delivery"; `verify.md`, "A round"; `convert.md`, "The content pass"; `faults.md`; `craft.md`, "The header and the footer".
- **Query**: `deal.js show <id>` and `deal.js list sections --tag <x>`; `assets/snippets/index.html`.

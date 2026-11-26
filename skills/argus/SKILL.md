---
name: argus
description: "Design, build, restyle, polish or review websites and app screens in any framework: landing pages, dashboards, tools, app screens, components, forms, a design system. Use for any request that makes or changes something people look at, even when the skill is not named, such as 'build a page for my bakery', 'add a settings screen', 'make this look better', 'it looks generic' or 'design the onboarding', and for new UI in a project that already has a look. Not for backend-only work, standalone charts or slides."
---

# Argus

**First: if `.argus/run.md` exists in the project, read it before anything else**, and again after any context compaction or when resuming.

You know the rules of design. Four other things go wrong; this skill answers each:

1. **You cannot see what you make.** So build, look, fix, and look again.
2. **Your first idea is everyone's first idea.** So take input from outside, deal the visual choices from data, and carry one idea through one or two moments made for this subject.
3. **You judge better than you generate.** So for new work, make rough alternatives of different kinds and let the owner choose by looking.
4. **You drift to generic, or overdo a style.** So the aim is never a look: it is a page that looks good, fits this business and its visitors, and makes a stranger understand and act. Today's generic look is as likely to be a pale, airy, serif-headed page as a purple gradient (`faults.md`).

## 1. Look at what exists

State in one line each: the **platform** (web or mobile; read the project, never assume); the **surface** (Persuade: marketing, landing, shop; Operate: dashboard, tool, app screen; Read: docs, articles); the **existing system** (`DESIGN.md`, tokens, components, finished screens); and **what the user supplied**. Work in the project's own framework, components and build; a single static HTML file only when there is no project.

## 2. Take the one route that fits

Use the first matching row; files are in `references/`.

| The task | Do | Open first | Then |
|---|---|---|---|
| A tweak: one component, a spacing or colour fix | Make the change and look at it. No questions, one-line report | Nothing | The part of `craft.md` it touches |
| A named command (`polish`, `audit`, `typeset`, `colorize`, `animate`, `simplify`, `variants`) | Follow the command | `commands.md` | What it names |
| "Review this" or "critique this" | Report, change nothing | `review.md` | `verify.md` to capture |
| "Make this look better", "it looks generic", on something that exists | Judge first: rework, repair, or leave it (`review.md`, "Which job") | `review.md` | `extend.md`; `commands.md`, polish |
| New screen or component in a project that has a look | Extend. No directions, no questions | `extend.md`; `product.md` if Operate; `app.md` if native | `craft.md` while building |
| New mobile app with nothing to match | Ask, show directions, build | `ask.md` | `app.md` |
| New Operate surface with nothing to match | Ask, show directions, build | `ask.md` | `product.md` |
| New Persuade or Read surface with nothing to match | Ask, then the stages | `ask.md` | One card at a time: `brief.md`, `ideas.md`, `directions.md`, `first-screen.md`, `build.md` |
| A redesign the user asked for | New work, keeping content and behaviour | As new work, plus `extend.md` section 1 | As that row |

Every page gets the motion level the owner chose (`showpiece.md`): **still** (only controls answer), **moment** (the default: an arrival, reveals as sections enter, controls that respond, one choreographed moment) or **showpiece**. Quiet means less, not nothing. After the fix rounds every page gets the finishing pass (`finish.md`).

Changing a product's identity needs an explicit ask; "make it pop" means better work inside the current look. A look the user already decided (named, a reference to follow, brand assets) skips the dealing (`directions.md`, "The direction").

## 3. Say what it will cost

For any job bigger than a tweak, say what you will do and roughly how long.

## 4. Ask, then wait

**If a person can answer, always send the one question message before designing, and wait** (`ask.md`). Any interactive session counts, unless the request says otherwise or the harness has no way to ask; use its question tool when there is one. A detailed brief is not permission to skip the owner. **Skip the questions and the owner's pick only when the request says so in words** ("don't ask", "no questions", "just build", "decide yourself") **or the run is unattended**: then each question takes its recommended answer, listed as "assumed". A benchmark, a complete brief or a big build is no reason.

## 5. The loop, for every route that builds

1. **Directions** (new work): three rough first screens of different kinds, each given one look-and-fix pass, shown on the choosing page; **stop until the owner picks** (`directions.md`).
2. **Build the first screen alone**, look at it and fix it to its bar (`first-screen.md`); then the rest (`build.md`).
3. **Look-and-fix rounds, up to three.** Each round: capture at 1440 and 390 (plus 768, 820 and 1024, first screen only), run the checker, use it by hand, a fresh review (`verify.md`, `review.md`), then fix everything as one list. **Stop when a round is not better than the one before, and keep the best version, not the latest.**
4. **The finishing pass** (`finish.md`), then **a final look**: every default width (320, 390, 768, 820, 1024, 1440, 1920) and the checker, looked at; not a round.

If nothing renders, say so, run `lint.js`, and never call it verified.

## 6. The reading budget

A new Persuade page reads **about 8,900 words whole** across the job, never at once: this file, `ask.md`, each stage card when its stage starts (`brief.md`, `ideas.md`, `directions.md`, `first-screen.md`, `build.md`), `convert.md` and `finish.md`; a showpiece adds `showpiece.md`. Every other reference is opened only at the section a card names. Data and code are queried, never read: `deal.js list|show`, and the snippet gallery `assets/snippets/index.html`. After compaction, read only `run.md` and the current card.

## 7. The run file and the memory

**`.argus/run.md`** (in the user's project) is this job's working state, for any route longer than a few steps: written at the start, rewritten at the end of every stage, read first on resuming. A resumed run with `Asked:` or `Picked by:` at waiting asks again and stops. Keep it under about 60 lines:

```markdown
# Argus run
Stage: 3 directions (done: brief, ideas)   Next: the one next step
Asked:     waiting | answered | skipped: owner said "<their words>" | skipped: unattended
Picked by: waiting | owner (A, B, C or a mix) | builder: owner said "<their words>" | builder: unattended
## Brief       ten lines at most (brief.md)
## Taste       admires; wrong for them; how the business behaves (binds every direction)
## Kit         items; tone: calm | lively | bold; pictures: the one-line decision; generation: yes, no, or no tool
## Direction   the direction record (directions.md), with the dealt ids and any swap
## Tokens      colour roles with values; type families, sizes; spacing; radii; motion
## Plan        one line per section; mark the one or two moments
## Findings    open, by round; which round's version is the best so far
## Always      three to six lines that must hold to the end (the owner's "wrong for us", the action's label)
```

**`DESIGN.md`** is the product's lasting design memory: answers, direction, tokens, what was tried (`design-md.md`). **`.argus/history.json`** gets what was built from `deal.js record`, so later deals lean away from recent patterns; a cross-project history only if the user turns it on (`deal.js --global-history`).

## Rules that always hold

These are the floor: wrong in any style, never waived. Everything else in this skill is advice.

- **Whose word wins**: the user's explicit instruction; the existing system; their answers and references; your direction; this skill's numbers. Taste never overrides accessibility.
- **Legible**: contrast 4.5:1 (3:1 for large text); no text under 12px; visible focus; controls at least 24px (44px on touch is the goal); nothing lost when text is enlarged (`craft.md`).
- **The action is visible and works**: the main button, the form, the navigation at phone width.
- **Nothing covers or collides with content**: no band, card, cut-out or effect over text, a form, a price or the action; no headline over a face.
- **Pictures are sharp** at their size; never blurred or darkened for mood (`pictures.md`).
- **Honest content.** No lorem ipsum, no invented proof (testimonials, customers, logos, ratings, usage numbers), no fake staff or certificates. A needed fact (a price, trial terms) may be a stand-in, marked in a code comment and listed in the report. Sample data and generated pictures are said once, in the footer.
- **Responsive**: works from 320 to 1920 with nothing scrolling sideways.
- **Motion is safe**: content shows without script, every animation has a reduced-motion version, anything moving for more than five seconds can be paused, nothing delays the action.
- **Restyling never changes behaviour**: keep field names, ids, links, handlers, form actions, test hooks and accessibility attributes. Build every state that can happen, loading, empty and error included.
- **Verified means looked at.**

## Report

```
Found:     platform, surface, existing system, what the user supplied
Mode:      directions shown; questions asked or skipped (and the owner's words); who picked
Direction: one sentence (new work), or what was reused and added (extending)
Looked:    what was rendered, at which widths, what was used by hand, the review's verdict
Fixed:     what the loop caught; which round's version was kept
Assumed:   stand-in facts, sample data and assumed answers, or "none"
Pictures:  each one's rung, source and credits.json; that the user can swap their own
Open:      what is not done or not checked
Saved:     DESIGN.md, run.md and history.json written or updated, or "nothing"
```

A tweak: one line.

## Files

Paths are relative to this file's folder (`<skill>`; in Claude Code, `${CLAUDE_SKILL_DIR}`); run scripts by full path: `node "<skill>/scripts/shot.js" <url>`. `references/` holds the cards; `assets/data/` the libraries `deal.js` reads; `assets/snippets/` the tested effects; `assets/showpiece/` the showpiece starters; `assets/compare.html` the choosing page; `scripts/` `deal.js`, `photos.js`, `shot.js`, `lint.js` and `rules.js`.

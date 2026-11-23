---
name: argus
description: Design, build, restyle, polish or review websites and mobile app screens in any framework - landing pages, dashboards, app screens, components, forms, a design system. Use for any request that makes or changes something a person looks at, including "build a page for X", "add a settings screen", "make this look better" or "it looks generic", and for new UI in a project that already has a look. Not for backend-only work, standalone charts or slides.
---

# Argus

You know the rules of design. Four other things go wrong; this skill answers each:

1. **You cannot see what you make.** So build, look at the rendered result, fix, and look again.
2. **Your first idea is everyone's first idea.** So take input from outside: what exists, what the user says, what they show you.
3. **You judge better than you generate.** So for new work, pages and screens alike, make rough alternatives and choose by looking.
4. **You drift to medium, to thin and to still.** So new pages get one idea built from the subject's own kit, one big move, large real pictures, motion with a purpose, and a complete argument.

## 1. Look at what exists

First, find and state in one line:

- **Platform**: web, or a mobile app (iOS, Android, both). Read the project; never assume.
- **Surface**: Persuade (marketing, landing, shop window), Operate (dashboard, tool, admin, app screen) or Read (docs, articles).
- **Existing system**: `DESIGN.md`, theme or token files, shared components, two or three finished screens.
- **What the user supplied**: screenshots, links, logos, brand colours, fonts, photographs.

Use the project's own framework and conventions.

## 2. Take the one route that fits

Use the first row that matches. Open the "First" files before starting, the others only on reaching that step.

| The task | Do | First | At that step |
|---|---|---|---|
| A tweak: one component, a spacing or colour fix | Make the change and look at it. No questions, one-line report | Nothing | The one part of `craft.md` it touches |
| A named command (`polish`, `audit`, `typeset`, `colorize`, `animate`, `simplify`, `variants`) | Follow the command | `references/commands/<name>.md` | What it names |
| "Review this" or "critique this" | Report, change nothing | `review.md` | `verify.md` to capture; `laws.md` to cite a principle |
| "Make this look better", "it looks generic", on something that exists | Find what is actually wrong, then fix inside the existing look | `extend.md` section 3 | `commands/polish.md`, or for one clear weakness the matching command |
| New screen or component in a project that has a look | Extend. No direction work, no questions | `extend.md`; `product.md` if Operate; `mobile.md` if native | `craft.md` while building |
| New Operate surface with nothing to match | Ask, show directions, then build | `ask.md` | After the answers, `product.md` (and `mobile.md` if native); `create.md` steps 2 (the kit) and 4 (the choosing page); `craft.md` while building; `design-md.md` to record |
| New Persuade or Read surface with nothing to match | Ask, then the full flow | `ask.md` | After the answers, `create.md`; its reading table names every other file and the step that needs it |
| A redesign the user explicitly asked for | Treat as new work, keeping content and behaviour | The matching new-work row, plus `extend.md` section 1 to inventory what must survive | As that row |

**Read a reference only at its step, never before, and once a session**: what you have read stays with you; re-open a named section only to check against it. Where a step names one section of a long file, read only that section. Every route that builds something ends in the loop below; read `verify.md`, `slips.md` and `review.md` when it starts. Tweaks only need a look.

Changing an existing product's identity needs an explicit ask. Without one, "make it pop" means better work inside the current look.

## 3. Ask (new work only)

When the brief is open, ask before designing: two short rounds of at most four questions, each skippable, each with a recommended answer specific to this business, none about fonts or colours. Round 1 is the business (who it is for, why they would choose it, how the main action works, what the user can supply); it is asked once and saved in `DESIGN.md`. Round 2 is this page or screen, written from round 1's answers, and ends with how many directions to show (1, 3 or 5; 3 chosen). Build exactly that many and show them on one choosing page (with one, skip the page and build); in a set of three or more, exactly one is plain, led by photographs, the product or, for an abstract subject, type (`create.md`). This holds for all new work with an open look, product screens included; `ask.md` has the questions and the three exceptions. Skip any question the brief, the code or `DESIGN.md` already answers.

Then, before any design choice, write two or three lines: what this site is for, who arrives and from where, and what they do next. Every later choice (header, sections, pictures, motion) is checked against them.

If nobody can answer, state each assumption and carry on; never wait in a loop.

## 4. The loop

1. **Build** the first real version.
2. **Look.** Capture it once at 320, 390, 1440 and 1920 wide (for native, on a phone-sized simulator or device). 320 is the narrowest phone and the reflow width; 390 the common phone; 1440 a laptop; 1920 a desktop. Before reading code again, write down what is visible.
3. **Check.** Run the checker once (`verify.md`) and go through `slips.md`. For new work, check the default looks in `tells.md`: three shared features send it back to its idea.
4. **Use it.** Press the main button, complete the form, Tab through it, find the navigation at phone width.
5. **Fix** everything found in steps 2 to 4 as one list, then run one more round. Do not capture again after each fix.

Two rounds; a third only if the second still shows a P0, a P1 or something broken. After the last fixes, one final capture at 1440 and 390, looked at; not a round (`verify.md`). Then report what remains. On a new Persuade page the rounds start after the first screen has passed its bar (`create.md` step 7). If nothing can be rendered, say so, check the source instead, and do not call the work verified. For a whole page or screen where subagents exist, hand the first round's screenshots to a fresh reviewer who has not seen your reasoning; its findings join that round. With none, review it yourself as a separate pass from the screenshots alone, findings listed before fixing, and say so (`verify.md`).

## Rules that always hold

- **Whose word wins**: an explicit instruction from the user; then the existing system; then the user's answers and references; then the direction you wrote; then this skill's numbers and lists. Taste, yours or this skill's, never overrides accessibility minimums. Something the user asked for is never reported as a defect.
- **Real pictures before drawings.** Decide the kind once per page, in one line, before the directions: photographs for a physical subject, the product working for software, diagrams or type for an abstract one (for those two, one direction may add a single mood photograph). Supplied first; otherwise stock photographs, found without asking, in one batch of searches. Generated images, or drawing, only when asked; drawing also for a diagram, chart, icon or map, or when no usable photograph turns up (`imagery.md`).
- **Honest content.** No lorem ipsum, and no invented proof: testimonials, customers, logos, ratings, usage numbers. Facts a page needs (a price, trial terms) may be plausible stand-ins, marked in a code comment and listed in the report. Sample data in a demo, catalogue or dashboard is welcome when specific, and is labelled as sample once on screen. A form that is not connected gets a code comment and a line in the report, not an on-screen notice (`web.md`).
- **Restyling never changes behaviour.** Keep field names, ids, links, handlers, form actions, test hooks and accessibility attributes.
- **Build the states that can happen**, and all of those. Pressed and disabled always; hover and keyboard focus wherever there is a pointer or a keyboard. Loading, empty and error wherever something real loads, can be empty or can fail. Never build a network call just to have a loading state.
- **Accessibility minimums**: text contrast 4.5:1; visible keyboard focus; controls at least 24px, and 44pt / 48dp on touch screens; a reduced-motion path; nothing lost when text is enlarged. Numbers in `craft.md`, the standard in `laws.md`.
- **Motion is safe**: content shows without script, every animation has a reduced-motion version, and nothing delays the action (`craft.md`).
- **Verified means looked at.**

## Report

```
Found:     platform, surface, existing system, what the user supplied
Direction: one sentence (new work), or what was reused and what was added (extending)
Looked:    what was rendered, at which widths, what was used by hand
Fixed:     what the loop caught
Assumed:   stand-in facts and sample data, by kind, or "none"
Pictures:  their sources; for stock, where `credits.json` is and that the user can swap in their own
Open:      what is not done or not checked, and anything a guide says to flag
Saved:     DESIGN.md written or updated (new work), or "nothing"
```

These lines, plus any the route's file adds; a tweak gets one.

## Files

All in `references/`: `ask.md` (question rounds), `create.md` (new Persuade and Read work; the choosing page), `imagery.md` (kinds and sources of pictures), `structures.md` (page structures), `ingredients.md` (token roles and options), `extend.md` (an existing look), `product.md` (Operate surfaces), `photos.md` (any photograph), `web.md` and `mobile.md` (what goes where), `slips.md` (mistakes actually made), `verify.md` (capture, check, review, scripts), `craft.md` (every number), `laws.md` (UX laws and myths), `tells.md` (generated-design defaults), `review.md` (critique format), `design-md.md` (design memory).

Every path here (`references/...`, `scripts/...`, `assets/...`) is relative to this file's folder (`<skill>` in commands), not the user's project; in Claude Code, `${CLAUDE_SKILL_DIR}`. Run scripts by full path: `node "<skill>/scripts/lint.js" <target>`.

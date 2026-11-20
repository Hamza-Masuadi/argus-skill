---
name: argus
description: Design, build, restyle, polish or review websites and mobile app screens in any framework - landing pages, dashboards, app screens, components, forms, a design system. Use for any request that makes or changes something a person looks at, including "build a page for X", "add a settings screen", "make this look better" or "it looks generic", and for new UI in a project that already has a look. Not for backend-only work, standalone charts or slides.
---

# Argus

You know the rules of design. Four other things go wrong, and this skill answers each:

1. **You cannot see what you make.** So build, look at the rendered result, fix, and look again.
2. **Your first idea is everyone's first idea.** So take input from outside: what exists, what the user says, what they show you.
3. **You judge better than you generate.** So for new work, make rough alternatives and choose by looking.
4. **You drift to medium and to thin.** So new pages get one idea, one big move, and a complete argument.

## 1. Look at what exists

Before anything else, find and state in one line:

- **Platform**: web, or a mobile app (iOS, Android, both). Read the project; never assume.
- **Surface**: Persuade (marketing, landing, shop window), Operate (dashboard, tool, admin, app screen) or Read (docs, articles).
- **Existing system**: `DESIGN.md`, theme or token files, shared components, two or three finished screens.
- **What the user supplied**: screenshots, links, logos, brand colours, fonts, photographs.

Implement with whatever framework and conventions the project already uses.

## 2. Take the one route that fits

Use the first row that matches. Read only the files it names.

| The task | Do | Read |
|---|---|---|
| A tweak: one component, a spacing or colour fix | Make the change and look at it. No questions, one-line report | Nothing, or the one part of `craft.md` it touches |
| A named command (`polish`, `audit`, `typeset`, `colorize`, `animate`, `simplify`, `variants`) | Follow the command | `references/commands/<name>.md` and what it names |
| "Review this" or "critique this" | Report, change nothing | `review.md`, `laws.md`, `verify.md` |
| "Make this look better", "it looks generic", on something that exists | Find what is actually wrong, then fix inside the existing look | `extend.md` section 3, then `commands/polish.md`; for one clear weakness, the matching command |
| New screen or component in a project that has a look | Extend. No direction work, no questions | `extend.md`; plus `product.md` for Operate surfaces, `mobile.md` for native |
| New Operate surface with nothing to match | Ask if the brief is open, then build | `ask.md`, `product.md`, `craft.md`; `mobile.md` if native |
| New Persuade or Read surface with nothing to match | Ask if the brief is open, then the full flow | `ask.md`, `create.md` (which brings in `structures.md` and `ingredients.md`), `web.md` or `mobile.md`; `photos.md` if pictures do the selling or photos were supplied |
| A redesign the user explicitly asked for | Treat as new work, keeping content and behaviour | The matching new-work row, plus `extend.md` section 1 to inventory what must survive |

Every route that builds something ends in the loop below, with `slips.md` and `verify.md`. Tweaks only need a look.

Changing an existing product's identity needs an explicit ask. Without one, "make it pop" means better work inside the current look.

## 3. Ask (new work only)

When the brief leaves open who it is for, how it should feel or what the user has to show, ask before designing: one round, at most four questions about the product, each skippable, none about fonts or colours. For a new page, also ask what the first screen should be built around (three approaches you propose for this subject) and how many directions they want to see side by side (1, 3 or 5; 3 recommended). `ask.md` has them. Skip questions the brief or `DESIGN.md` already answers.

If nobody is there to answer, state each assumption and carry on. Never wait in a loop.

## 4. The loop

1. **Build** the first real version.
2. **Look.** Render it and capture it at 320, 390 and 1440 wide (for native, on a phone-sized simulator or device). Before reading code again, write down what is visible.
3. **Check** it against `slips.md`. Run the scripts that apply (see `verify.md`).
4. **Use it.** Press the main button, complete the form, Tab through it, find the navigation at phone width.
5. **Fix** what you found and look again. Two rounds, then report what remains.

If nothing can be rendered, say so, check the source instead, and do not call the work verified. For substantial work (a whole page or screen) where subagents exist, hand the screenshots to a fresh reviewer who has not seen your reasoning; its fixes count as one of the two rounds.

## Rules that always hold

- **Whose word wins**: an explicit instruction from the user; then the existing system; then the user's answers and references; then the direction you wrote; then this skill's numbers and lists. Accessibility minimums are not overridden by taste, yours or this skill's. Something the user asked for is never reported as a defect.
- **Honest content.** No lorem ipsum, and no invented proof: testimonials, customers, logos, ratings, usage numbers. Facts a page needs (a price, trial terms) may be plausible stand-ins, marked in a code comment and listed in the report. Sample data in a demo, catalogue or dashboard is welcome when specific, and is labelled as sample once on screen.
- **Restyling never changes behaviour.** Keep field names, ids, links, handlers, form actions, test hooks and accessibility attributes.
- **Build the states that can happen**, and all of those. Pressed and disabled always; hover and keyboard focus wherever there is a pointer or a keyboard. Loading, empty and error wherever something real loads, can be empty or can fail. Never build a network call just to have a loading state.
- **Accessibility minimums**: text contrast 4.5:1; visible keyboard focus; controls at least 24px, and 44pt / 48dp on touch screens; a reduced-motion path; nothing lost when text is enlarged. `craft.md` has the numbers and `laws.md` the exact standard.
- **Verified means looked at.**

## Report

```
Found:     platform, surface, existing system, what the user supplied
Direction: one sentence (new work), or what was reused and what was added (extending)
Looked:    what was rendered, at which widths, what was used by hand
Fixed:     what the loop caught
Assumed:   stand-in facts and sample data, by kind, or "none"
Open:      what is not done or not checked, and anything a guide says to flag
```

Keep it to these lines. A tweak gets one line.

## Files

| File | Holds |
|---|---|
| `ask.md` | The question round |
| `create.md` | New Persuade and Read work: the idea, the big move, rough alternatives, the direction |
| `structures.md` | Page structures to choose between, so alternatives differ in shape and not only in colour |
| `ingredients.md` | The token roles every direction fills in, and the options for colour, type, shape and space |
| `extend.md` | Working inside an existing look |
| `product.md` | Operate surfaces: dashboards, tools, app screens |
| `photos.md` | Pages led by photographs |
| `web.md`, `mobile.md` | What goes where on a web page or a phone screen |
| `slips.md` | Mistakes actually made, by surface. Checked on every look |
| `verify.md` | How to capture, check and review; the helper scripts |
| `craft.md` | Every number: type, colour, space, motion, targets |
| `laws.md` | What the laws of UX do and do not justify; myths |
| `tells.md` | Common generated-design defaults |
| `review.md`, `design-md.md` | Critique format; recording decisions |

All are in `references/`.

Every path in this skill (`references/...`, `scripts/...`, `assets/...`) is relative to the folder that contains this file, not to the user's project. In Claude Code that folder is `${CLAUDE_SKILL_DIR}`. When running a script, use its full path, for example `node "<this skill's folder>/scripts/lint.js" <target>`.

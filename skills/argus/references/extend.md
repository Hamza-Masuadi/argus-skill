# Extend: new UI inside an existing system

The goal is a screen that looks as if the original team built it. Success is measured by how little it stands out, and it can be measured.

## 1. Inventory

Read before writing, in this order, and stop reading when you can fill in the snapshot below.

1. **`DESIGN.md`**, if there is one. It says what was intended.
2. **Tokens**: theme files, CSS variables, the Tailwind config. These say what is allowed.
3. **Two or three finished screens** that resemble the one being built. These say what is actually done, which wins when it differs from the tokens.
4. **Shared components**: what exists, their variants and sizes.

**Measure, do not estimate.** If a screen can be rendered, run `node "<skill>/scripts/shot.js" <url> --inventory --no-shots`. It prints the fonts, text sizes, weights, colours, border and radius values, shadows, control heights and table row heights the screen really uses, most used first. A guess of "about 14px" becomes a list of the five sizes that exist.

**Keep evidence.** Copy two or three real components (a button, a form row, a table, a panel), markup and styles, into your notes exactly as they are written. New components are derived from these, not from memory of them.

**Collect what measurement cannot show:**

- Patterns: how a page is headed, how forms are laid out and validated, how empty, loading and error states look, where primary actions sit.
- Voice: sentence case or title case, how buttons are worded, how errors are phrased.

**Write the snapshot**, 15 lines or fewer, ending with the system in one sentence ("dense paper-and-ink ledger: Plex Sans at 12 and 14, 3px corners, no shadows, green only for money in"). If you cannot say it in a sentence, you have not understood it yet.

If the project has no `DESIGN.md` and the task is more than a tweak, say in the report that the snapshot could become one (see `design-md.md`).

## 2. Build by reuse

Work down this list and stop at the first that fits:

1. Use an existing component as it is.
2. Use an existing variant, or add a variant to the existing component.
3. Compose existing components into the new pattern.
4. Create a new component, derived from its siblings in the evidence: same control heights, radii, padding rhythm, border treatment, focus ring and motion.

Rules that keep the result in family:

- **What counts as existing.** Anything the existing screens render is in the system. A token or class that is defined but never rendered (an unused tint, a filled button style nobody uses) is available, since someone intended it, but using it changes how the product looks: prefer what is rendered, and list any defined-but-unused piece you use under "Unmatched".
- **Variant or new kind?** A variant keeps the component's structure and behaviour and changes one property using existing values (an outlined button in the danger colour). A new kind adds a structure or behaviour the system does not have (a dialog over the page, a shadow, a filled button where all are outlined). Variants are fine and reported; new kinds need a reason strong enough to state.
- **Never invent a value.** Every font size, colour, radius, shadow, border and control height in the new screen must already be in the inventory. If the screen needs something the system does not have, do not quietly add it: list it under "Unmatched" in the report with what you used instead and why.
- **Never add a kind of thing the system does not have.** No shadow in a system without shadows, no modal in a system that edits in place, no filled button where every button is outlined. These stand out far more than a wrong shade.
- **Copy raw values exactly.** Where the existing code uses a raw value for something (a border, a table header), use that value. Do not tokenise or tidy the existing code unasked.
- Match density. Count how much fits on comparable screens and stay close.
- Match the copy voice, including capitalisation and punctuation.
- Put actions where neighbouring screens put them.
- Make the content agree with the rest of the product. Names, plans, prices, dates and totals on the new screen must match what existing screens already show for the same things.

## 3. When the system is the problem

- **Inconsistent**: two button heights, three greys. Follow the majority or the most recent pattern, and note the inconsistency in the report. Do not add a fourth.
- **No way between screens**: the product had one screen and now has two. Add the smallest navigation that fits the existing structure, the same in both screens, and report it as a system addition. This is the one change to existing screens that a new page always justifies.
- **Missing a piece**: no empty state, no table. Add it as a system addition: built from existing values, and flagged in the report.
- **"Make it better / make it pop"**: first say which job it is (`review.md`, "Which job": rework, repair or leave). Then raise quality inside the system first. Hierarchy, spacing rhythm, alignment, states, copy and real content usually account for most of what feels wrong. Touch identity (palette, type families, radius language) only on an explicit ask.
- **A rule of this skill conflicts with the system** (its fields are 14px, where `craft.md` asks for 16px on phones): follow the system, and report the conflict under "Open" as something to fix across the product. Matching wins over this skill's preferences; only real accessibility failures are fixed locally.
- **A different viewer**: the new screen is for someone other than the existing screens' user (a customer's billing page beside an owner's dashboard). Do not quietly join the two in one navigation. Build the screen, keep the link minimal, and raise it under "Open": whose product view is this?
- **Accessibility failures in the system itself**: fix them in the new work, and report the token or component that causes them so it can be fixed at the source.

## 4. Keep the diff narrow

Do not restyle neighbouring screens or shared components on the way past. If a shared component needs a change, make it a variant, or raise it as a separate proposal, since a silent change alters every screen that uses it.

## 5. Check by measuring

1. Compare the new screen with the existing one: `node "<skill>/scripts/shot.js" <new-url> --against <existing-url> --no-shots` prints every font, size, colour, radius, shadow and control height the new screen uses that the existing one does not. Each is a departure. Remove it, or list it under "Unmatched" with the reason.
2. Put the two screens side by side in screenshots. If the new one can be picked out as the new one, it is not finished.
3. Use the new screen as `verify.md` describes, including a reload: a change the user made must still be there.

Add this line to the report:

```
Unmatched: values or kinds of component the system did not have, what was used, and why; or "none"
```

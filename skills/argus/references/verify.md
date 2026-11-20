# Verify: how to look

Code that reads correctly still renders with clipped text, a collapsed column or a dead form. Looking is what catches it. Use what the session already has; never install global tooling just to verify.

## Capture

Capture at 320, 390 and 1440 wide: the top of the page, then scrolled through. Capture states too: after an empty submit, after a successful one, with the menu open.

| You have | Do |
|---|---|
| A browser tool | Serve the page (the project's dev server or any static server) and screenshot it |
| A headless browser in the project (Playwright, Puppeteer) | Use it |
| Neither, but Node 22+ and a Chrome-family browser installed | `node scripts/shot.js <url-or-file> --out shots --full --check`, then read the PNGs it lists. `--full` adds the whole page as a series of slices; `--check` runs the checker at each width and prints its findings |
| An iOS simulator or Android device | Build, run and capture as `mobile.md` describes ("Looking at native work"): light, dark and large text |
| Nothing that renders | `node scripts/lint.js <file-or-folder>` and walk `slips.md` against the code. Report the work as not rendered |

Background and headless browsers can freeze animation and smooth scrolling, and can return a screenshot one step behind. Set the scroll position directly instead of animating to it, and if a capture does not match what you just did, take another before believing it. If content is still missing after that, it is a finding.

## Look

1. **Describe before you judge.** Write two or three plain sentences about what is on screen, as a stranger would see it, before re-reading the code. Knowing what you intended makes you see it whether or not it is there.
2. **Go through `slips.md`**, the sections for this surface.
3. **Run `scripts/check.js`** if you can execute script in the page (below).
4. **Use it by hand**: the primary button; the form with nothing, with something wrong and with something valid; Tab until the focus ring shows; at phone width, the navigation and the main action.
5. **Compare** with what it must match: an existing screen when extending, the direction and any reference for new work, the other pages in the same job.

## The scripts

None of them needs an install, makes a network call or waits for input. The skill works without them.

**`check.js`** runs inside a rendered page. `shot.js --check` runs it for you. With a browser tool, evaluate the file's text in the page with the tool's script call, at each of the three widths. It measures text contrast, sideways overflow, collapsed columns, some clipped text, line length, target sizes, missing names and labels, heading order, page length on phones, forms that open an email client, endless CSS animation without a pause control, fields that make an iPhone zoom, all-caps text with no letter-spacing, too many text sizes, several filled buttons competing on the first screen, and a few tells.

- `P0` and `P1` are measurements: fix them, or say in the report why one is a false alarm. `P2` is roughness: fix what is cheap. `tell` is a prompt: decide whether it was chosen.
- It cannot measure contrast for text whose section has a gradient or image background; it counts those in its notes, so check them by eye.
- It cannot see: text over a photograph, labels inside drawn charts, overlapping elements, motion driven by script, whether a form completes, focus, or taste. Read its `notes`.
- A clean result means the measurable basics hold. In testing, most real problems were found by looking, not by this script.

**`inventory.js`** measures the design system a page actually uses: `node scripts/shot.js <url> --inventory --no-shots`. It prints fonts, text sizes, colours, radii, shadows, control heights and row heights, most used first. Use it on an existing screen before adding to it, and on the new screen to find where it departs (`extend.md`).

**`lint.js`** scans source when nothing can render: `node scripts/lint.js <file-or-folder>`. It reads HTML and CSS, and component files less reliably. It finds tiny text, forms that go to an email client or an unverified address, focus outlines removed with no replacement, animation with no reduced-motion rule, blocked zoom and fields without labels. It cannot see layout.

**`contrast.js`** checks colour pairs: `node scripts/contrast.js "#14233B/#F1F4F6"`. Six-digit hex only, text/background.

**`compare.js`** builds a before-and-after page from two screenshots: `node scripts/compare.js before.png after.png --out compare.html`. Opened in a browser, it shows them side by side, a slider between them, the pixels that changed, and what share of the image differs. Use it to confirm a fix changed what you meant and nothing else, and to show the user a change.

**`shot.js`** takes screenshots and runs the checker, as in the table above. It starts an installed Chrome-family browser headless and drives it directly, at 320, 390 and 1440 wide unless told otherwise. It exits with 4 when the checker found P0 or P1 problems, and 2 when it could not capture at all (some sandboxes block browsers); in that case do not retry, move to the next row of the table.

## A second pair of eyes

For a whole page or screen, where subagents exist, give a fresh reviewer the screenshots, the brief and `review.md`. Do not give it your direction or your account of what you intended; a reviewer told the intent tends to see it. Fix what it rates P0 or P1. This counts as one of the two fix rounds.

## Limits

- Two rounds of fixes, then list what remains under "Open".
- Never fix a finding by hiding it: deleting the element, shrinking text to fit, removing the state.
- Say exactly what was looked at. "Rendered at 390 and 1440, form submitted, dark mode not checked" is a report. "Verified" alone is not.

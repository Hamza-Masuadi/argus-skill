# Verify: how to look

Code that reads correctly still renders with clipped text, a collapsed column or a dead form. Looking is what catches it. Use what the session already has; never install global tooling just to verify.

Contents: **A round**, **Capture**, **Look**, **The scripts** (read `check.js` and `shot.js` now; the others only when you use them), **A second pair of eyes**, **Limits**.

## A round

One round of the loop is:

1. Capture all four widths once (`shot.js --full --check` does the capture and the checker together).
2. Run the checker once, at each width.
3. Use it by hand (below).
4. Write one list of every finding: from the screenshots, from the checker, from `slips.md`, and on the first round of a new Persuade page from the section pass (`create.md` step 8).
5. Fix everything on the list, then start the next round.

Do not capture again after each single fix; the next round's capture shows them all. Rounds are capped, and the last fixes get one final look (Limits, below).

## Capture

Capture at 320, 390, 1440 and 1920 wide (`SKILL.md` says why these): the top of the page, then scrolled through. Capture states too: after an empty submit, after a successful one, with the menu open. At 1920 the first screen and a scroll through are enough, not every state. Take each screenshot after web fonts have loaded (wait for `document.fonts.ready`, or a second); a capture in a fallback font misjudges every size and line break.

| You have | Do |
|---|---|
| A browser tool | Serve the page (the project's dev server or any static server) and screenshot it |
| A headless browser in the project (Playwright, Puppeteer) | Use it |
| Neither, but Node 22+ and a Chrome-family browser installed | `node "<skill>/scripts/shot.js" <url-or-file> --out shots --full --check`, then read the PNGs it lists. `--full` first scrolls through the page so content that appears on scroll and lazy images are there, then adds the whole page as a series of slices; `--check` runs the checker at each width and prints its findings; `--help` lists the options |
| An iOS simulator or Android device | Build, run and capture as `mobile.md` describes ("Looking at native work"): light, dark and large text |
| Nothing that renders | `node "<skill>/scripts/lint.js" <file-or-folder>` and walk `slips.md` against the code. Report the work as not rendered |

**The choosing page** (`assets/compare.html`, copied in as `roughs/index.html` or `variants/index.html`) is checked like any page before the user sees it: open its full address, never the server root or the folder, wait for fonts, and screenshot it. Confirm every card shows its live preview, name, idea, palette swatches, type and risk, and that nothing scrolls sideways. If a card shows only a file name, `directions.json` or the inline `directions` list is missing or broken (`create.md` step 4).

Background and headless browsers can freeze animation and smooth scrolling, and can return a screenshot one step behind. Before a scroll-through capture, set `scroll-behavior: auto` on the root element, set each scroll position directly instead of animating to it, wait for reveals to finish (or finish running animations with `document.getAnimations().forEach(a => a.finish())` where the animations are finite), and only then capture. If a capture does not match what you just did, take another before believing it. If content is still missing after that, it is a finding.

**A blank or half-arrived capture from a browser pane is not yet a finding.** The pane may be hidden, and there frames and observers can stall while the page still reports itself visible (`craft.md`, Safety). Re-take it with `shot.js --full`, which scrolls through the page a screen at a time, waits for pictures and animations, and captures from the top; only what is still blank there is a finding. Report it as a finding about the page's fallback (content must show without a frame or an observer firing), not as a blank page. To finish animations in a pane before a quick look, run `document.getAnimations().forEach(a => a.finish())` and add the page's reveal class to every hidden element.

**Motion is checked three ways.** In motion: watch the arrival, the live element and a scroll through, and confirm the action is present from the first frame. Without script: load the page with script disabled, or before the script has marked the document ready, and confirm every section shows. Reduced: emulate `prefers-reduced-motion: reduce` (a browser tool's media emulation, or `Emulation.setEmulatedMedia` in the browser protocol) and confirm nothing travels, every end state shows, and the live element still responds.

## Look

1. **Describe before you judge.** Write two or three plain sentences about what is on screen, as a stranger would see it, before re-reading the code. Knowing what you intended makes you see it whether or not it is there.
2. **Go through `slips.md`**, the sections for this surface.
3. **Run `scripts/check.js`** if you can execute script in the page (below).
4. **Use it by hand**: the primary button; the form with nothing, with something wrong and with something valid; Tab until the focus ring shows; at phone width, the navigation and the main action.
5. **Compare** with what it must match: an existing screen when extending, the direction and any reference for new work, the other pages in the same job.

## The scripts

None of them needs an install or waits for input, and none makes a network call except `photos.js`, which does only when run. The skill works without them.

**`check.js`** runs inside a rendered page. `shot.js --check` runs it for you. With a browser tool, evaluate the file's text in the page with the tool's script call, at each width. It applies 71 rules (`node "<skill>/scripts/rules.js"` lists them, with lint's 30, 101 in all). It measures:

- **Text:** contrast, small and thin text, clipped and truncated text, line length and line height, justified text, all-caps tracking, too many sizes (text inside a product mock-up marked `data-mock`, `role="img"` or `aria-hidden` is left out: `web.md`), more than two font families, a timid first-screen headline, and raw values on screen (`undefined`, `NaN`, `null`, `[object Object]`, Lorem ipsum).
- **Layout:** sideways overflow, collapsed columns, page length on phones (over 14 screens at 390, or 16 700px screens at 320), any one section over about 2.5 screens at 390, content held in a narrow column at desktop widths, fixed bars covering too much of a phone screen, and near-miss left edges.
- **First screen:** different filled actions competing (repeats of one action, such as a Book button on each row, links to the same place and a set of app-store badges count once; skip links and visually hidden links do not count), no visible action, and nothing large.
- **Buttons and pictures:** filled buttons of one colour in several heights or corner shapes, more than one strong filled button colour, a primary button far from about 40-48px tall on desktop, and photographs mixed with a large drawn illustration. All four are prompts.
- **Access:** target sizes, missing names and labels, generic link text, links told apart only by colour, clickable elements that are not controls, focus that shows no change or hides behind a fixed bar, blocked zoom, heading order, page title, main landmark and language, and links that go nowhere: `href="#"` (`dead-link`) or a same-page `#id` that nothing on the page carries (`missing-anchor`).
- **Forms:** forms that open an email client, fields that make an iPhone zoom, missing autocomplete, the wrong field type, errors not linked to their field, and required fields with no marker.
- **Images, charts and tables:** missing or file-name alt text, images with no reserved size or far larger than shown, unnamed charts, tables with no header cells, and numeric columns not right-aligned or not in tabular figures.
- **Motion and colour:** animation with no reduced-motion rule, endless animation with no pause control, slow transitions on controls, many scroll reveals with the same computed reveal and no stagger (a delay or a per-element `--i` counts as one), and four colour prompts (one colour flooding the first screen, a warm yellow or cream ground, many hues, pure black on pure white), plus a few tells.

Reading its result:

- `P0` and `P1` are measurements: fix them, or say in the report why one is a false alarm. `P2` is roughness: fix what is cheap. `P3` is minor polish: fix it if it is cheap. `tell` is a prompt: decide whether it was chosen.
- On Operate surfaces (dashboards, tools, app screens) `timid-headline`, `first-screen-no-action` and `first-screen-nothing-large` are skipped: the checker treats a page as product UI when it has a table, a grid or tab list, a step or progress indicator, a form holding most of the controls, or is about one screen tall at phone width. If one of the three still appears on such a screen, ignore it.
- The four colour rules, `button-styles`, `primary-button-height`, `mixed-pictures` and `near-miss-alignment` are prompts to confirm a choice, not failures. `mixed-pictures` is a heuristic: a drawn diagram or map that carries information is allowed beside photographs. A finding the user asked for (a yellow ground they requested, a flood of their brand colour) is never reported as a defect.
- It cannot measure contrast for text whose section has a gradient or image background; it counts those in its notes, so check them by eye.
- It checks focus on the first 40 controls only. It moves keyboard focus for a moment, without scrolling, then restores the focused element and every scroll position. Run it before, not during, an interaction you are driving by hand.
- Wait a moment after load, or after changing styles, before running it; `shot.js --check` waits for finite animations (two seconds at most). If animations or transitions were still running, its notes say so: contrast and layout findings may be mid-change, so run it again once the page has settled.
- It never reports depth, gradients, shadows or blur by themselves; whether they were chosen is a judgement (`tells.md`).
- It cannot see: text over a photograph, labels inside drawn charts, overlapping elements, motion driven by script, whether a form completes, keyboard order, or taste. Read its `notes`; a rule that could not run says so there.
- A clean result means only that the measurable basics hold. Most real problems are found by looking, not by this script: look as well.

**`inventory.js`** measures the design system a page actually uses: `node "<skill>/scripts/shot.js" <url> --inventory --no-shots`. It prints fonts, text sizes, colours, radii, shadows, control heights and row heights, most used first. Use it on an existing screen before adding to it, and on the new screen to find where it departs (`extend.md`).

**`lint.js`** scans source when nothing can render: `node "<skill>/scripts/lint.js" <file-or-folder>`. It reads HTML and CSS, and component files less reliably. It finds tiny text, forms that go to an email client or an unverified address, focus outlines removed with no replacement, animation with no reduced-motion rule, `transition: all`, blocked zoom, `100vh` with no `dvh`, `viewport-fit=cover` with no safe-area insets, images with no alt or no size, clickable `div`s, blocked paste, positive `tabindex`, `@font-face` with no `font-display`, placeholder text and fields without labels. It cannot see layout.

**`photos.js`** finds free-licence photographs: `node "<skill>/scripts/photos.js" "baker scoring dough before the oven" --count 12 [--orientation landscape] [--out photos-candidates]`. It is the one tool that uses the network, and only when run: it sends the search words to Openverse and Wikimedia Commons, keeps only CC0, public domain, CC BY and CC BY-SA results of about 1200px or more on the long side, downloads them and writes `credits.json` (title, author, source page, licence and licence address for each). It exits with 2 when nothing could be downloaded, and says so plainly when there is no network; then take photographs from free-licence stock sites if a web search or browser tool is available, or go down the ladder in `imagery.md`. Open and look at every file it saves before using any (`photos.md`).

**`contrast.js`** checks colour pairs: `node "<skill>/scripts/contrast.js" "#14233B/#F1F4F6"`. Six-digit hex only, text/background.

**`compare.js`** builds a before-and-after page from two screenshots: `node "<skill>/scripts/compare.js" before.png after.png --out compare.html`. Opened in a browser, it shows them side by side, a slider between them, the pixels that changed, and what share of the image differs. Use it to confirm a fix changed what you meant and nothing else, and to show the user a change.

**`shot.js`** takes screenshots and runs the checker, as in the table above. It starts an installed Chrome-family browser headless and drives it directly, at 320, 390, 1440 and 1920 wide unless told otherwise, after web fonts have loaded. Before capturing it waits until the page has stopped changing for half a second (no change to the page's elements, no finite animation running and no short script timer still due), six seconds at most, so a first-screen sequence driven by script timers is captured finished; if the page is still changing at six seconds it captures anyway and says so. `--wait <ms>` adds that much more time after it, for a sequence with long pauses between its steps. It exits with 4 when the checker found P0 or P1 problems, and 2 when it could not capture at all (some sandboxes block browsers); in that case do not retry, move to the next row of the table.

## A second pair of eyes

For a whole page or screen, where subagents exist, give a fresh reviewer the first round's screenshots, the brief, `review.md` and the "Whole default looks" section of `tells.md`. Do not give it your direction or your account of what you intended; a reviewer told the intent tends to see it. What it rates P0 or P1 joins that round's list; it is not a round of its own.

If no separate reviewer or subagent is available, do the review yourself as a distinct pass in the first round: work only from the screenshots and `review.md`'s checklist, as if you had not built the page, and list what you find before fixing anything. Say in the report that the review was your own.

## Limits

- Two rounds for the whole page or screen; on a new Persuade page they are counted after the first screen has passed its bar (`create.md` step 7, which keeps its own cap of two reworks). A third round only if the second still shows something at error level: a P0 or P1 from the checker, or something broken on screen. Then list what remains under "Open".
- **One final look after the last fixes.** Fixes made at the end of the last round are otherwise never seen. Always take one more capture, at 1440 and 390 only, and look at it. No checker run unless a fix changed layout structure (a section added, removed or moved, a grid or column changed), and no review. Anything it shows is fixed if trivial, or listed under "Open". This is not a round and does not reopen the loop.
- Never fix a finding by hiding it: deleting the element, shrinking text to fit, removing the state.
- Say exactly what was looked at. "Rendered at 390, 1440 and 1920, form submitted, dark mode not checked" is a report. "Verified" alone is not.

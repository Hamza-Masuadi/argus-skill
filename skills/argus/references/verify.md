# Verify: how to look

Contents: **A round** · **Capture** · **Motion capture** · **Look** · **The checker** · **The other scripts** · **Limits**.

Code that reads correctly still renders with clipped text, a collapsed column or a dead form. Looking is what catches it. Use what the session already has; never install global tooling just to verify.

## A round

The loop and its limit are in `SKILL.md`, section 5 (up to three rounds; stop when a round is not better). One round is:

1. Capture at 1440 and 390 with the checker: `shot.js <url> --widths 1440,390 --full --check --between`. `--between` adds 768, 820 and 1024, first screen and checker only: where columns split, text collides with text or a drawing, and pictures go blank.
2. Use it by hand (below).
3. Hand the captures to a fresh reviewer (`review.md`, "As the loop's reviewer").
4. Write one list of every finding: from the screenshots, the checker, the reviewer, and on the first round of a new Persuade page the section pass, the content pass and the scroll test (`build.md`).
5. Save the round: its captures, the review and a copy of the changed files in `.argus/rounds/<n>/`.
6. Fix everything on the list, then start the next round.

Do not capture again after each single fix; the next round shows them all. **Keep the best version**: if a round's captures look worse than the round before, restore that round's files and fix from there.

After the last round, **one final look**: `shot.js <url> --check` (320, 390, 1440 and 1920, then 768, 820 and 1024 as first screens), and look at every capture. Anything it shows is fixed if trivial, or listed under "Open". It is not a round.

## Capture

Take each screenshot after web fonts have loaded (`document.fonts.ready`); a capture in a fallback font misjudges every size and line break. **Capture every state before calling it done**: the menu open, a hover and a focus state, the form's error and success states, and the page at 390 as a touch user meets it.

| You have | Do |
|---|---|
| A project with a dev server | Run it and point the capture at its URL: `shot.js http://localhost:5173/pricing --check`. When the project has a build step, capture the production build once before the end too (serve the built folder, for example `npx vite preview` or any static server on `dist/`), since minifiers and build settings change what ships |
| A browser tool | Serve the page and screenshot it |
| A headless browser in the project (Playwright, Puppeteer) | Use it |
| Node 22+ and a Chrome-family browser | `node "<skill>/scripts/shot.js" <url-or-file> --full --check`, then read the PNGs it lists. `--help` lists the options |
| An app prototype or native app | As `app.md` says |
| Nothing that renders | `node "<skill>/scripts/lint.js" <file-or-folder>`; report the work as not rendered |

`shot.js` starts an installed Chrome-family browser headless with a throwaway profile, at the widths above unless told otherwise, and waits until the page has stopped changing (six seconds at most) before capturing. Captures go to `shots/<page>/`, so pages never overwrite each other; the folder is printed first. Useful options:

- `--full` scrolls through first, so content that appears on scroll and lazy images are there, then captures the whole page as slices and one joined PNG, with scroll-driven reveals shown finished. A pinned scene shows at its start, often as a blank band; the output lists where each one is. Look at those with `--scenes`.
- `--hover <target>` and `--tap <target>` (a CSS selector or `text=Label`, repeatable) move the mouse onto or press a target first; `--type "text=Email=ana@example.com"` fills a field, so `--type ... --tap "text=Book my service"` submits a form and captures the result.
- `--frames N --every MS` captures a sequence, to see arrivals and loops (`--wait` delays the first frame); `--scroll-frames N` captures down the page; `--reduced-motion` and `--scheme light|dark` emulate the visitor's settings; `--height N` sets the viewport height.
- It exits with 4 when the checker found P0 or P1 problems, and 2 when it could not capture at all (some sandboxes block browsers); then do not retry, move to the next row of the table.

**The choosing page** is checked like any page before the user sees it: open its full address, wait for fonts, and confirm every card shows its live preview, name, idea, palette, type and risk.

A blank or half-arrived capture from a browser pane is not yet a finding: the pane may be hidden, and there frames and observers can stall. Re-take it with `shot.js --full`; only what is still blank there is a finding, about the page's fallback (content must show without a frame or an observer firing).

**Motion is checked three ways**: in motion (`--frames`, `--hover`), without script (every section still shows), and reduced (`--reduced-motion`: nothing travels, every end state shows).

## Motion capture

For a page with a pinned scene, an arrival or a page transition. Each sequence is written as frames and as one labelled contact sheet (`<prefix>-sheet.png`); **read every sheet** before trusting a flag. Pages register what moves on `window.__argus` (`{ timelines, scenes, lenis }`), as the showpiece starters do.

- `--scenes`: every scroll scene (registered, else pinned or scrubbed, else sticky stages and CSS `animation-timeline` animations) at `--points` positions (default 9).
- `--timeline <name>`: a registered timeline seeked from 0 to 1. Repeatable.
- `--arrival`: the load, screencast every 250 ms for 3 s (`--every`, `--ms`).
- `--transition <link>`: press a link (selector or `text=Label`) and record the page change. Cross-document view transitions need http(s).
- `--motion-metrics`: compares consecutive frames and flags dead, pop, flash, not-settled and blank-canvas steps (`motion-metrics.json`). Advisory.
- `--perf-scroll`: real wheel scroll at 4x CPU slowdown; reports long frames (aim under 5% over 20 ms), main-thread blocking over 50 ms and layout shift (aim under 0.05).
- `--fallbacks`: screen by screen with reduced motion, script off and WebGL off at each width, and touch at 390. A flat-colour screen is reported: content hidden by a start state.

The browser starts with software WebGL allowed; if WebGL is still missing, a note says so, and a blank canvas is not yet a finding. `ARGUS_BROWSER` picks the browser; a bad path is one clear line.

## Look

1. **Describe before you judge.** Write two or three plain sentences about what is on screen, as a stranger would see it, before re-reading the code. Knowing what you intended makes you see it whether or not it is there.
2. **Run the checker** and read its findings (below).
3. **Use it by hand**: the primary button; the form with nothing, with something wrong and with something valid; Tab until the focus ring shows; at phone width, the navigation and the main action.
4. **Compare** with what it must match: an existing screen when extending, the direction for new work, the other pages in the same job.
5. **Go through `faults.md`** for the sections that apply.

## The checker

`check.js` runs inside a rendered page; `shot.js --check` runs it for you at each width (`npx argus-skill check <url>` does the same). With a browser tool, evaluate the file's text in the page. `node "<skill>/scripts/rules.js"` lists them with their tiers: 91 checker rules and 32 source rules, 123 in all, 33 of them floor rules.

- **Floor rules** (every P0 and P1, and text under 12px) are never waived, in any style: contrast, sideways overflow, collapsed columns, covered content, text running into text or a drawn line (`text-collision`), a canvas over a picture showing nothing (`blank-canvas`), clipped text, missing names and labels, missing alt, blocked zoom, a form that opens an email client, motion with no reduced-motion rule, endless motion or video with no pause. Fix them, or show the finding is a false alarm.
- **Advisory rules** (P2, P3 and tells) are prompts to look: fix what is cheap and wrong; keep what was chosen, with its reason in the report. The flow and composure prompts (`blank-band`, `repeated-layout`, `lopsided-section`, `narrow-content`, `hero-crowded`, `hero-wordy`) are settled by looking; each message says when it is fine.
- On Operate surfaces the first-screen rules are skipped. Text inside a mock-up marked `data-mock` or `role="img"` is left out of the type counts. A finding the user asked for is never a defect.
- It cannot measure contrast for text over a gradient or image, or under `mix-blend-mode`; it counts those in its notes, so check them by eye. It checks focus on the first 40 controls only. It cannot see text over a photograph, labels inside drawn charts, motion driven by script, whether a form completes, keyboard order, or taste. A clean result means only that the measurable basics hold.

## The other scripts

- **`lint.js <file-or-folder>`** scans source when nothing can render: tiny text, forms that go to an email client, focus outlines removed, animation with no reduced-motion rule, `transition: all`, blocked zoom, images with no alt or no size, clickable `div`s, placeholder text and fields without labels. It cannot see layout. `--app` reads an app prototype.
- **`shot.js <url> --inventory --no-shots`** measures the design system a page actually uses; `--against <existing-url>` lists what a new page uses that an existing one does not (`extend.md`).
- **`photos.js`** finds, delivers and credits pictures (`pictures.md`). **`deal.js`** deals directions (`directions.md`).

## Limits

- Never fix a finding by hiding it: deleting the element, shrinking text to fit, removing the state.
- Say exactly what was looked at. "Rendered at 390, 1440 and 1920, form submitted, dark mode not checked" is a report. "Verified" alone is not.

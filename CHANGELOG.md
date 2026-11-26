# Changelog

## 0.5.1 - 2026-11-26

- **It always asks, and waits.** However detailed the brief, new work sends its one question message first: what it took from the brief, then what only you can decide (likes and dislikes, what would be wrong, pictures, how much motion). Only "don't ask", "just build" or an unattended run skips it, and the run file records which.
- **Directions are always shown.** The three roughs and the choosing page are built for every new site or page, whatever its size, and the build stops for your pick.
- **No text-beside-picture first screen by default.** The dealer deals a side-by-side composition only when asked (`--allow side-by-side`, or a form that must sit beside the headline), and then to one direction at most. Two new first screens for the minimal kind.
- **Motion is a baseline again.** Unless you choose **still**, every page gets an arrival, reveals as sections enter, controls that respond and one choreographed moment. A new advisory check, `motionless-page`, reports a page where nothing moves.
- **Habits the checker now names**: a small capitals or monospace label above most headings, and equal cards numbered 01, 02, 03 (`numbered-grid`). A third, monospace face is dealt only for code or technical data, and the minimal direction's ground is no longer always pale.
- **Choosing page previews.** A direction given as a folder opens the page inside it, and a preview that cannot load says which paths it tried instead of showing a file listing.
- **Captures no longer take on the machine's settings.** `shot` and `check` use a light scheme and normal motion unless told otherwise; before, a computer in dark mode or with reduced motion switched on gave different results.
- **No browser left behind, no capture that hangs.** The tools wait for the browser to exit before removing its temporary profile, every wait has a limit, and a browser that sends no live frames gets timed screenshots instead.
- `photos`: every network call and browser step has a time limit; `photos loop` prints correct commands on Windows.
- 123 rules in all.

## 0.5.0 - 2026-11-26

- **One question message.** New work asks once: first what the brief already settles, then only the gaps, at most about six questions, each with the answer taken if you skip it. No second round; a complete brief or "don't ask" means no questions.
- **One loop, said once.** Three rough directions with one fix pass each; the first screen built alone to its bar; then up to three look-and-fix rounds, stopping when a round is not better. Asking for one direction no longer silently drops a fix round.
- **The dealer deals less and listens more.** It deals each direction's kind, hero composition and structure class, type pairing, ground, shape and candidate sections; it no longer deals hover, scroll, arrival or "signature" effects. The owner's words are hard filters: `--no` covers heroes, sections, pairings, faces, grounds and shapes; `--tone calm` never deals anything loud; `--trade` never deals a hero or section the data says fails for that business (no comparison table for a bakery). No two directions share a hero or a structure class; ground families differ, and at most one direction pairs a light ground with a serif display. `--keep` re-deals the others away from a chosen direction. `--n` outside 1-6 is an error. Pairing descriptions no longer mention other trades.
- **Cross-project history is opt-in.** Nothing is written to the home folder unless you pass `--global-history` or set `ARGUS_GLOBAL_HISTORY`. `deal record` rejects ids that are not in the library instead of storing them; the date is your local date.
- **Fonts whose licence forbids redistribution** (the Fontshare faces) are marked `selfHostOnly`, referenced by name and official URL only, and dealt only with `--self-host`.
- **Checker rules in two tiers.** 33 floor rules (every P0 and P1, and text under 12px) are never waived; the other 88 are prompts to look. `blank-band`, `repeated-layout`, `lopsided-section` and `narrow-content` now report at P3 with a message saying when the layout is fine. `hero-wordy` no longer counts text in SVG drawings, charts, mock-ups or a list that is itself the hero. `hero-crowded` and the docs now agree on the number (seven measured groups, about five designed ones). `rules` shows each rule's tier.
- **Snippets.** 109 effects cut to 49: the cursor group and about fifty show-pieces and near-duplicates removed. Copy markers are now `argus:copy-start <kind>` / `argus:copy-end <kind>`, so a plain text range extracts every block. `svg-annotated-picture` no longer combines `non-scaling-stroke` with `pathLength` dashes, and a test forbids the combination. The gallery is a plain static page that opens from a file.
- **Pictures.** One statement of the picture ladder in one file (`pictures.md`, merging imagery, photos and video). Drawing is for what a photograph cannot show, never a stand-in for one; this corrects 0.4.0's "illustration comes last". With an image-generation tool, the skill asks once; a yes covers the whole set, generated pictures are recorded in `DESIGN.md` and `credits.json` and noted once in the footer. With `PEXELS_API_KEY`, `photos add` reads Pexels photos through its API.
- **Fewer, merged references.** 43 reference files became 25 (27 with `showpiece.md` and `finish.md`) and about 60,000 words about 32,000; a new page reads about 8,600 words whole, the finishing pass included. Merged: tells and slips into `faults.md`; review and the critic into `review.md`; the seven command files into `commands.md`; app, app-build and mobile into `app.md`; web into `craft.md`. Removed: `create.md`, `structures.md`, `ingredients.md` and `laws.md` (folded into the stage cards and the review). The reviewer gives at most three findings, each with its screen region and evidence.
- **Not a house style.** Today's most recognisable generated look (a cream ground, a serif headline with one italic phrase, small capitals labels, lots of empty space) is named in `faults.md` as a habit to notice, and nothing nudges a page toward it. Nothing in `faults.md` is a ban.
- **Motion levels and showpiece mode.** Before building, every page gets a motion level (`showpiece.md`): **moment** (native scroll and one choreographed moment) for business, service, SaaS, shop and public pages; **showpiece** for portfolio, studio, launch, fashion, culture and product-reveal sites, or when the owner asks for an award-style site. A showpiece may use Lenis smooth scroll on GSAP's ticker (touch left native), one to three pinned scenes, split-text reveals, a preloader only when something real must load, cross-document view transitions, one WebGL layer and one toy. The floor is unchanged: content readable and the action reachable without waiting, the keyboard everywhere, no scroll-jacking on touch, finished reduced-motion states, and a stated budget (120 KB gzipped of motion code, LCP 2.5 s, CLS 0.1). Nine tested starters in `assets/showpiece/` (GSAP 3.15.1 from jsDelivr at run time; Lenis 1.3.28 and OGL 1.0.11 vendored with their licences). `deal --motion moment|showpiece` labels a deal (by default from `--trade`), and a showpiece lets the picture-led and expressive directions lean to louder first screens.
- **Motion capture in `shot`.** `--scenes`, `--timeline <name>`, `--arrival` and `--transition <link>` write each sequence as frames and one labelled contact sheet; `--motion-metrics` flags dead, popping, flashing, unsettled and blank-canvas steps; `--perf-scroll` scrolls with real wheel input at 4x CPU slowdown and reports long frames, blocking and layout shift; `--fallbacks` captures reduced motion, no script, no WebGL and touch. Software WebGL is allowed in the headless browser, and a bad `ARGUS_BROWSER` is one clear line.
- **The finishing pass** (`finish.md`): twelve checks for every page after the fix rounds. Six new advisory (P3) checker rules report what a command can catch: `leftover-text`, `straight-quotes`, `price-figures`, `heading-widow` (at 1280px and wider), `bare-easing` and `border-sprawl`; `page-basics` now also reports a missing `og:image`. 121 rules in all.
- **Fixes from three real builds.**
  - Pages are checked between the old widths. `shot` now captures 768, 820 and 1024 by default, or with `--between`; these widths get the first screen and the checker only.
  - Two new floor rules:
    - `text-collision`: text running into text, or text sitting on a drawn line, on the first screen.
    - `blank-canvas`: a canvas over a picture that captures as one flat colour. It runs in every `--check`.
  - The WebGL starter keeps each `<img>` visible until its own plane has drawn and been read back as not blank. Rectangles are read live, so a blank box cannot happen.
  - `shot` changes:
    - Captures go to `shots/<page>/`.
    - `--wait` now delays `--frames`.
    - `--tap "text=…"` prefers a form's button over a header link, and can press a label that wraps a hidden input.
    - `--scenes` finds CSS scroll-driven animations.
    - `--full` lists the pinned scenes it captured at their start.
  - Checker false alarms fixed:
    - A focus style drawn inside an SVG link now counts.
    - A list, timeline or board is one group for `hero-crowded`.
  - Roughs live in `.argus/roughs/` and are built in one thread; subagents are optional.
  - The choosing step names what the pick has that the others lack. When two directions are close, it takes the less familiar one.
  - The dealer never deals a side-by-side hero, or sticky steps, to more than one direction in a set.
  - `photos deliver` keeps credits through renames and takes `--max-kb`.
  - The README shows six real first screens.
- **Removed tools**: `compare` (the before-and-after page) and `contrast`. `video.js` run on its own now prints how to use it.
- README: install, how a build runs, requirements, and what the tools touch on the network and on disk. An `evals/` folder holds six briefs for comparing builds by eye.

## 0.4.0 - 2026-11-23

- Two short question rounds for new work: the business first, then the page, including how many directions to show (1, 3 or 5).
- Every idea is built from the subject's own kit: the real things its customers handle, read and do.
- Photographs first. Argus finds free-licence stock photographs itself, looks at each one, and records the credits. Illustration comes last.
- In a set of three or more directions, one is plain: led by photographs, the product or type, with one typeface and one accent.
- Directions in a set differ in background, layout and header, and are shown on a new choosing page with a desktop and phone view.
- The header and footer are designed from the site: real sections in the visitor's words, plus the one thing that kind of visitor looks for first.
- New first-screen checks, including whether a competitor could put their name on it unchanged.
- An optional look at the nearest competitors when a web tool is available.
- A motion system: one live element on the first screen, purposeful reveals, and a reduced-motion version.
- A list of whole default looks to avoid, and a native mobile checklist.
- New tools: `photos` finds and credits photographs; `rules` lists every rule that `check` and `lint` apply.
- `check` and `lint` now apply 101 rules between them.
- `shot` captures at 320, 390, 1440 and 1920, waits for the page to settle, and scrolls through the page before a full capture.
- The tools are written in TypeScript and every one answers `--help`.

## 0.3.2 - 2026-11-20

First public release.

- A design skill for AI coding agents, built around a build, look, fix loop, with one route per kind of task.
- A short question round for new work, with recommended answers chosen. For a new page it proposes three first-screen approaches and asks how many directions to show.
- Directions shown side by side as real first screens, for you to pick or mix.
- Guides for new pages, product UI, photo-led pages, web and native mobile, and for adding to a product that already has a look.
- Seven commands: variants, polish, audit, typeset, colorize, animate, simplify.
- Tools: `check`, `shot`, `inventory`, `compare`, `lint` and `contrast`.
- Installs as a Claude Code plugin, or with `npx argus-skill install` for Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Kiro, OpenCode, Grok and Devin / Windsurf.

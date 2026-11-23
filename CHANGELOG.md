# Changelog

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

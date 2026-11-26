# Contributing

Thanks for looking. Argus is early, so the most useful contributions are evidence, not opinions.

## What helps most

- **A page it got wrong.** Open an issue with the brief you gave, what it built, a screenshot, and what was wrong. Mistakes found in real output are how `skills/argus/references/faults.md` and the checker grow.
- **A comparison.** Give the same brief to an agent with Argus and to one without, several times if you can, and share what came out, including the cases where Argus did worse.
- **A script report.** Say whether `skills/argus/scripts/shot.js` works on your system and browser, and report false alarms or misses from `skills/argus/scripts/check.js` and `skills/argus/scripts/lint.js` with a small example.
- **A human opinion.** Every score so far comes from a model. If you look at two outputs and prefer one, say which and why.

## Changing the skill

- Keep it small. The always-loaded `skills/argus/SKILL.md` should stay near its current length, and a new page should stay near its stated reading budget (the number in `SKILL.md`, section 6; recount it with `wc -w` if you change a file it names).
- Each rule has one home: say it once, in the file where it is used, and point to it from elsewhere. The floor rules live in `SKILL.md`; the picture ladder in `pictures.md`; the loop in `SKILL.md`, section 5; the page order in `convert.md`. Numbers for a topic live in that topic's file (`type.md`, `colour.md`, `layout.md`, `motion.md`; the floors in `craft.md`).
- A check beats a sentence: if the checker can measure it, put it in `check.ts` and keep the prose short.
- Hard rules only for what is wrong in any style (legibility, the action working, nothing covering content, sharp pictures, honesty, responsive, reduced motion). Everything else is advice, and never a single house look.
- Give the reason for a rule, not just the rule. Do not add a rule because it sounds right: add it because a real output went wrong without it, and say which.
- Prune by deleting whole sentences, not by rewriting everything shorter.
- No dependencies, hooks, telemetry or anything that waits for input. Network calls are allowed only in `photos.js` and `video.js`, only when the user runs them, and each new host is listed in the README's "What it touches". The installer, `deal`, `check`, `shot` (beyond the page it is pointed at), `lint` and `rules` make none.
- If you change guidance, say in the pull request how you tested it; the briefs in `evals/` are a good start.

## Style

Plain language, short sentences, British spelling to match the existing files. No text copied from other skills or from copyrighted sources.

## Working on the code

The command (`src/bin/argus.ts`) and the helper scripts (`src/scripts/`) are TypeScript. Edit those, never the `.js` files in `bin/` or `skills/argus/scripts/`, which are generated.

```bash
npm install
```

```bash
npm test
```

`npm test` compiles with strict type checking, copies the compiled files into place and runs the tests. Commit the regenerated `.js` files with your change; CI fails if they are out of date. Add a test for any bug you fix.

`src/scripts/check.ts` runs inside a web page, so it has no imports or exports and must stay a single expression.

# Contributing

Thanks for looking. Argus is early, so the most useful contributions are evidence, not opinions.

## What helps most

- **A page it got wrong.** Open an issue with the brief you gave, what it built, a screenshot, and what was wrong. Mistakes found in real output are how `skills/argus/references/slips.md` grows.
- **A comparison.** Give the same brief to an agent with Argus and to one without, several times if you can, and share what came out, including the cases where Argus did worse.
- **A script report.** Say whether `skills/argus/scripts/shot.js` works on your system and browser, and report false alarms or misses from `skills/argus/scripts/check.js` and `skills/argus/scripts/lint.js` with a small example.
- **A human opinion.** Every score so far comes from a model. If you look at two outputs and prefer one, say which and why.

## Changing the skill

- Keep it small. The always-loaded `skills/argus/SKILL.md` should stay near its current length, and every rule should live in one file only. Numbers belong in `skills/argus/references/craft.md`.
- Give the reason for a rule, not just the rule.
- Do not add a rule because it sounds right. Add it because a real output went wrong without it, and say which.
- Do not add dependencies, network calls, hooks or anything that waits for input. The skill must work as plain text.
- If you change guidance, say in the pull request how you tested it.

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

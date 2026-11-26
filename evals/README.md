# Evals

Six briefs for invented businesses, used to compare builds by eye: a bakery, a sea-kayak guide, a rota app, a coastal hotel, a freight-tracking product and a vineyard. Each asks for a real page with working flows, honest proof and real stock photographs, and says "do not ask me to choose anything", so a build runs without questions.

## Run a build

1. Make an empty folder per brief and arm, for example `runs/4-bakery/argus/` and `runs/4-bakery/none/`.
2. Open an agent session in that folder (with Argus installed for the `argus` arm, without it for the other) and paste the brief's text as the first message.
3. Let it finish. Keep what it leaves: the site, `.argus/` (the run file, rounds and history) and `DESIGN.md`.

Use a fresh session per build, the same model and effort for every arm, and no other design skill installed. Run each brief more than once if you can: one run says little.

## Compare by eye

1. Capture every build the same way, from the repo root:

   ```bash
   node skills/argus/scripts/shot.js runs/4-bakery/argus/index.html --out runs/4-bakery/argus/shots --full --check
   ```

   (Point it at the dev server URL instead when the build is a framework project.)
2. Put the first screens side by side at 390 and 1440, then the full pages. Hide which arm made which.
3. For each pair, note which you would show the owner, and why, in a sentence: clear in five seconds, looks good, fits the business, finish. Write the reasons down; the reasons are more useful than the tally.
4. Read the checker's floor findings (P0 and P1) for each build: a build that fails the floor loses whatever it looks like.

Nothing here is scored automatically. The briefs are fixed so that changes to the skill can be judged against the same work.

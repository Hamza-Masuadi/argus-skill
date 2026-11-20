# variants

Show several distinct directions side by side so the user can choose by looking. People pick from real options far better than they describe what they want. Use it when the user asks to see options, or is unsure about direction.

This is step 4 of `create.md`, run with the user choosing. New pages already do this when the user asks to see directions (`ask.md` question 6); the command is for asking at any other time. Default to three variants; five at most.

## 1. Get the candidates

Follow `create.md` steps 1-3. Keep as many candidates as variants wanted, and make them differ on at least two of: what the first screen is built around, tone, how much colour it commits to, the character of the type. If two could be swapped without anyone noticing, replace one. Include the crossed-out first idea only if the user asks to see the obvious option.

## 2. Build the first screen of each

First screen only, real copy, the big move at full strength. Each in its own file so styles cannot bleed between them:

```
variants/
  a.html
  b.html
  c.html
  index.html     <- a copy of assets/compare.html
```

Open `variants/index.html?a.html,b.html,c.html`, or edit its `versions` list to give each one a label. It shows every variant in a row at desktop or phone width, each at a real screen's height, with a link to open it full size.

For a native app, build each variant as a separate preview or screen, capture a screenshot of each, and present the screenshots together.

## 3. Check before showing

Look at each one and fix anything broken (`slips.md`). A variant should lose on its idea, not because of a bug.

## 4. Present and wait

Give the user the comparison page and one line per variant: its idea in a sentence, and its trade-off. Do not rank them or argue for a favourite unless asked.

Wait for the choice. This is the one decision in the skill worth waiting for; if nobody answers, pick as `create.md` step 4 describes and say that you did.

Users often want a mix ("B's layout with C's colours"). Write the merged result as a direction (`create.md` step 5), restate it in two lines, and build.

## 5. Record and tidy

Record the chosen direction as the project's direction and list the rejected ones under "Tried" (`design-md.md`). Delete the `variants/` folder unless the user wants it kept.

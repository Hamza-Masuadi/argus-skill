# variants

Show several distinct directions on one choosing page so the user can choose by looking. People pick from real options far better than they describe what they want. Use it when the user asks to see options, or is unsure about direction.

This is steps 1 to 4 of `create.md`, run with the user choosing. All new work with an open look already does this (`ask.md`, "Who gets the directions question"); the command is for asking at any other time. For a dashboard, tool or app screen, the variants are working-screen roughs as `product.md` describes, not marketing first screens. Default to three variants; five at most.

## 1. Get the candidates

Follow `create.md` steps 1 to 3. Read `DESIGN.md` first; if it has no "Product" section, ask round 1 of `ask.md`. Write the subject's kit first (`create.md` step 2): every variant is built on one item from it, names that item in its idea, and is ranked by how close it sits to what the customer handles or does. Choose the set as `create.md` step 2 says: each variant has a different first-screen move, a different structure fingerprint, a different colour strategy and main hue family, and a display face of different character; grounds differ visibly, with at most one pale neutral and at most one dark (a dark one with a reason from how or when the thing is used), and a second coloured ground only in a clearly different hue; at most one uses a condensed all-capitals face. Build no variant you would not be willing to pick yourself: a straw man is replaced by the next candidate. Two built around the same central object or interaction are one variant; replace one. In a set of three or more, exactly one is in the plain register, photograph-led, product-led or type-led (`create.md` step 2), and every variant's idea starts with its register. One is the wildcard, chosen by chance (`echo $((RANDOM % N))`) as you select them; the rest differ most from it and from each other. Your pick is decided later, by looking (step 3), and it may be the wildcard. Every headline comes from the difference or the belief in the user's answers. Include the obvious option only if the user asks to see it.

If the user asks for a new set, safer or bolder, build it from candidates not yet shown, by the same rules, and add the rejected ones to "Tried".

## 2. Build the first screen of each

First screen only, real copy, a real picture, the big move at full strength and its live element working, no sections below it (for Operate work, the main working screen at real density with sample data). Decide the kind of picture once for the set (`imagery.md`, "The kind of picture"); where it is photographs, every variant draws on one shared batch of searches, not a search each. Each in its own file so styles cannot bleed between them:

```
variants/
  a.html
  b.html
  c.html
  directions.json  <- name, idea, palette, type, risk and tag for each
  index.html       <- a copy of assets/compare.html
```

Write `directions.json` as `create.md` step 4 shows, with a real name, idea, palette, type line and risk for every variant, and `tag` set to `"wildcard"` for the wildcard and `""` for the rest. `"pick"` is added in step 3. If the page will be opened from a file rather than a server, put the same list in the page's `const directions = [...]` instead, since a browser may refuse to read the JSON file there.

Open that page's full address, for example `http://localhost:PORT/variants/index.html`. Never open the server root or a folder: that shows a file listing, not the variants. The page shows each variant as a card with a live preview (Desktop or Phone), its name, idea, swatches, type and risk, a link to open it full size and a "Choose this" button.

For a native app, build each variant as a separate preview or screen, capture a screenshot of each, and present the screenshots together with the same details for each.

## 3. Check before showing

Give each one quick look, one capture at 1440 and one at 390 (for a phone-first app, phone width only), taken after its arrival animation has finished, and fix anything broken: overflow, overlap, a missing picture or unreadable text. No look loop, no four-width capture, no checker run, no review: those are for the chosen direction once it is built. A variant should lose on its idea, not because of a bug. Then, with them all on the choosing page, hold each against the whole default looks in `tells.md`: one that shares three features with a look goes back to its idea. Decide your own pick as `create.md` step 4 describes: the first screen a visitor would understand and trust fastest, that will hold up for the whole page, and that a competitor could not put their name on unchanged; novelty is not a criterion, and specific is not the same as novel. A dark pick carries a written reason from the subject or from when it is used. Write `"pick"` on it in `directions.json` (`"wildcard pick"` if the wildcard won) and reload to confirm the tag shows. Then take a screenshot of the choosing page itself, after web fonts have loaded, and confirm every card shows its preview and its details.

## 4. Present and wait

Show the user the choosing page, or that screenshot; if the environment has a preview pane or link, it is on the choosing page when you ask. The question in chat stays words only: one option per variant, its name and one plain sentence with its idea and its trade-off, plus a "mix" option in plain words. Never put drawings made of text characters, markup or code in a question or its preview. Do not rank them or argue for a favourite beyond the pick tag unless asked.

"Choose this" on the page copies a sentence such as `Build direction B, "The Workshop Manual".` for the user to paste; they may also just say the name. Wait for the choice. This is the one decision in the skill worth waiting for; if nobody answers, pick as `create.md` step 4 describes and say that you did.

Users often want a mix ("B's layout with C's colours"). Write the merged result as a direction (`create.md` step 5), restate it in two lines, and build.

## 5. Record and tidy

Record the chosen direction in `DESIGN.md` and list the others under "Tried", each with its fingerprint, colour strategy and main hue (`design-md.md`). Delete the `variants/` folder unless the user wants it kept.

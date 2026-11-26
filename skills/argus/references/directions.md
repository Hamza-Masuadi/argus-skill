# Stage 3: directions, dealt and chosen by looking

**If `.argus/run.md` exists, read it first**, and again after any compaction or when resuming.

Produces: the dealt directions, the roughs, the choosing page, the pick, and the direction in `DESIGN.md` and `run.md`.

**For any new site or page, the three roughs and the choosing page are always built, and the build stops for the owner's pick** (and mix, and what to change), whatever the scale: for a site of many pages, still only the home page's first screen. Skipped only when the owner's request says so in words ("don't ask", "no questions", "just build", "decide yourself") or the run is unattended: then you pick by the rule below, write `Picked by: builder` with the reason in `run.md`, and say so first thing in the report.

## Dealing

`node "<skill>/scripts/deal.js" directions` deals each direction its kind, a hero composition and its structure class, a type pairing, a ground, a shape and candidate sections, all different across the set. Motion is not dealt (`motion.md`).

The owner's words are filters, applied first: `--no` with what they said would be wrong (`--no dark,serif,sticky-steps`), `--taste light|dark`, `--tone calm` (nothing loud), `--trade` (nothing its data says fails for this business). Pass `--picture` from the picture line and `--needs` naming assets you have (`form-in-hero` when a form or tool must sit beside the headline). Side-by-side first screens and monospace faces are dealt only when asked: `--allow side-by-side` when the owner asked for one, `--allow mono` (or `--needs code`) for code or technical data the page really has. The history only leans away from recent builds; it never overrides the brief.

Match each dealt direction to the survivor of its kind. **Swap for a reason** (the taste, the idea, the pictures) and note it; a swapped hero never takes a structure another direction uses. **Never swap to a side-by-side composition** (text beside a picture, device or drawing) unless the owner asked for one or the first screen must hold a form or tool beside the headline: that is the owner's standing preference for this skill's default, because it is the arrangement every generated page falls into.

## What must differ

The ideas differ in what they are: what leads the first screen and how much is on it. Two built around one object are one; three palettes on one structure are one; so are three pale pages with serif headlines. A dark ground needs a reason from when the thing is used, or dark photographs.

## The roughs

Build the **first screen only** of each as one file in the project's `.argus/roughs/` folder (`a.html`, `b.html`, `c.html`, beside the choosing page; never among the site's own pages, and never deployed), all with the same care: a headline from the brief, the real action, its own header, its picture from the shared batch. Build them **in this thread, one after another**, so the three share one standard; subagents are optional.

**One look-and-fix pass each**: `shot.js .argus/roughs/a.html --widths 1440,390` (its captures go to `shots/roughs-a/`), then fix whatever keeps it from the shared standard: readable in five seconds, its picture sharp, nothing colliding. One pass, not a loop: a rough that still fails is replaced, or the set shows fewer and says why; never a foil.

## The choosing page

Copy `assets/compare.html` to `.argus/roughs/index.html` and write the list into the page, between its `argus:directions` markers, so it opens from a file as well as from a server. Each `file` is the rough's own `.html` file, relative to the choosing page: `"a.html"`, never a folder (`"a/"`) or a path from the project root. The roughs and the choosing page reference each other relatively, so open the page as a file, or serve the project root or `.argus/roughs/` itself; a server for the site's own folder cannot reach them. For example, roughs at `<project>/.argus/roughs/a.html`, `b.html` and `c.html` are listed as:

```json
[{ "file": "a.html", "name": "Harbour Instruments", "kind": "minimal", "idea": "The sentence: what leads and why",
   "palette": ["#ground", "#ink", "#accent"], "type": "Display over Body",
   "risk": "the trade-off it makes, plainly", "tag": "" },
 { "file": "b.html", "...": "..." }, { "file": "c.html", "...": "..." }]
```

`tag` is `"pick"` or `""`. Then **look at it before the owner does**: `shot.js .argus/roughs/index.html --full --widths 1440`, and read the capture. Every card must show its rough; a card that says it could not load names the path to fix.

- **Your recommendation** (the `"pick"` tag), by looking: which fits what the owner said they like and this business's visitors; which a visitor would remember; which can carry every section. All three must already pass the five-second test at 390 and 1440, so readability never decides it. When two are close, take the less familiar one, and say why in `run.md` in two or three sentences.
- **Default looks**: a rough that shares three features with a whole default look nobody chose (`faults.md`) goes back to its idea.
- **A mix is allowed**: say what came from where.
- **Show the owner and stop**: give the choosing page's address, then ask with the question tool when there is one (each direction's name, kind, idea and trade-off, plus "mix" and "change something"). Set `Picked by: waiting` and build nothing more until they answer.
- **A new set** on request (calmer, bolder, more pictures): `deal.js directions --keep "<the pick's record ids>" --n 2 ...` re-deals the others away from the pick; or deal a fresh set with another `--seed` and record the shown directions so the next deal prefers others. Add the rejected to "Tried".

## The direction

Write the chosen direction as one record, to `run.md` and to `DESIGN.md` ("Direction"):

```
Kind:      minimal, picture-led or expressive
Idea:      what leads the first screen and why it convinces this visitor; the headline
Kit:       the items the page shows, the hero's first
Voice:     how the business sounds and behaves, from the owner's answers, in plain words
Source:    where the colour and light come from: the main picture, or a named material
Moments:   the one or two places the page gets rich, and what each shows
Only here: one fact or detail only this business has (a price, a place, an hour, a number)
Dealt:     hero (and its structure), pairing, ground, shape (ids); any swap and why
Structure: the fingerprint (ideas.md)
Palette:   token roles with values, sampled from the main picture (photos.js palette) or the Source line
Type:      display and body; display size, weight, tracking
Pictures:  the picture line, each picture's rung (pictures.md), the one treatment (or none)
Motion:    the level; unless still, the arrival, reveals, hovers and moment (motion.md)
Header:    links from the section plan, its one extra item, its scroll form
Refuses:   two or three things, from what the owner said would be wrong
```

If it could describe another industry, it is a mood: make the Idea and Only here lines specific. In `DESIGN.md` add "Tried", with each unchosen direction's kind, fingerprint, colour strategy and main hue.

## What to read

- **In part**: `faults.md`, "Whole default looks"; `colour.md`, "Choosing colour"; `type.md`, "Choosing"; `heroes.md`, "Choosing a composition".
- **Query**: `deal.js show <id>` for every dealt item, `deal.js list` for swaps.

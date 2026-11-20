# Create: new Persuade and Read work

For a new page with nothing to match, where the job is to persuade or to be read. (New dashboards, tools and app screens use `product.md` instead.) The aim is a page that could only belong to this product, with a first screen worth a second look.

The route: brief, idea, the move, rough directions shown side by side and chosen by looking, a written direction, build, then a pass on the first screen alone, and the loop.

If photographs were supplied, or pictures do the selling, read `photos.md` now and look at every image before step 2.

## 1. Brief

Know three things: who is looking, what they came to do, and the one thing they should do or remember. Take them from the brief and the user's answers (`ask.md`). If nobody can be asked, write the assumptions down and continue.

## 2. The idea

**If the look is already decided, skip to step 5.** That means the user named the look, gave a reference, or supplied brand assets. Write the direction from what they gave. From a reference, take its specifics (palette, type, density, layout idea, tone) and say which you are carrying over; do not copy another brand's identity wholesale. A feeling ("energetic", "calm") is not a decided look: it narrows the candidates below without choosing one.

Otherwise, read `structures.md`, then list six or seven candidate ideas drawn from the subject's own world: its materials, tools, documents, places, the objects its audience handles. Avoid style labels (minimal, brutalist, glassy), which lead back to stock looks.

**An idea is a mechanism, not a layout with a name.** It can be said in one sentence that a visitor would repeat to someone else, and the sentence names something the visitor sees happen or does: "you choose a wine by the meal you are cooking", "the page is the ticket you would be handed at the door". A sentence that only describes arrangement or atmosphere ("a list beside a large image", "dark and cinematic") describes every competitor too. Write the sentence for each candidate. Where it is only arrangement or mood, find the mechanism or drop the candidate.

Then cut the list:

- Cross out the first two candidates you thought of. They are the ones any model would produce for this brief, and a page built on them looks like its competitors however well it is made.
- Cross out anything under "Tried" in `DESIGN.md`.
- Cross out what the user's answers rule out.
- Write each survivor's structure fingerprint (`structures.md`). If two share the same first two lines, they are one idea in different clothes. Replace one.

Keep as many as the number of directions the user asked to see (`ask.md` question 6): three if they did not say, five at most, and two or three to compare yourself if they asked for one. If the user chose what the first screen is built around (`ask.md` question 5), every survivor uses that approach and they differ in idea, structure and look.

## 3. The move and the page

Two things every candidate must have before it is worth building. They are defined here because the roughs in step 4 depend on them.

**One big move on the first screen.** Restraint everywhere reads as timid, and a careful page with nothing large on it is forgotten. The move is one of:

- **A made picture**: one image built for this page from the subject's own material: a map of the real routes, a chart computed from real figures, a drawing of the object, a scene. It fills most of the first screen and the headline and action sit on or beside it. With no photographs, this is drawn in code (SVG or canvas) and it is the strongest move available; it is what makes a first screen worth sharing.
- **Colour**: the brand colour covers the whole first screen.
- **Scale**: one element far larger than a cautious design would allow. Large type on a flat ground is the weakest form of this; give it something to sit in or against.
- **The product, live**: a working piece of the product, at a size where it shares the stage with the headline, running on a realistic example and starting in an interesting state.
- **Structure**: the whole page takes the form of something from the subject's world.
- **The photograph**: when pictures do the selling, one excellent image, very large, with nothing fighting it (`photos.md`).

The move suits the feeling asked for. For "loud", it is colour, scale and things that respond. For "calm" or "premium", it is space, one perfect image or one exact detail; the move is then a commitment to very little, held just as firmly. The move never costs the action: the primary action stays on the first screen, readable and working, at desktop and phone width. A striking first screen whose form leads nowhere loses to a plain one that works.

Either way, carry it out fully: a bold idea at 60% looks like a mistake. Be restrained everywhere else so the move has room.

**One idea, all the way down.** A strong first screen above ordinary sections reads as a costume.

- Each section takes its form and its name from the idea. A section that could sit unchanged under any other hero has not been designed. Put that language in the headings and the content themselves, not in small labels stacked above them.
- Each section has a **device**: something to look at or do beyond a heading and a paragraph, such as a comparison, a worked example, a control that recalculates, tabs between cases. Devices respond to the visitor; they do not move on their own. One thing on the page may move by itself (see `craft.md`), and it needs a pause control if it runs more than five seconds.
- The page makes the whole argument, in a visitor's order: what it is, how it works, what you get, why believe it, what about my objection, what it costs or what the catch is, what to do now. Usually six to eight sections, each compact enough that the page stays under about ten screens on a phone. With no real proof to hand, "why believe it" is the product shown working on a specific example, never invented customers or numbers.
- Say everything once, and keep the action next to the thing it acts on.

A feeling is delivered by several levers at once: colour, size, pace, density, motion, wording. Size alone gives a page that is large and lifeless.

## 4. Rough directions, chosen by looking

Build the **first screen only** of each surviving candidate, as separate files (`roughs/a.html`, `b.html` and so on): real headline, real primary action, the move at full strength, rough everything else. They must differ in structure (the first two lines of their fingerprints), not only in palette and type. Keep them cheap; all but one will be thrown away.

Render them and look at them side by side. `assets/compare.html` shows several files in a row: copy it next to them and open it with their names after a question mark, for example `compare.html?a.html,b.html,c.html`. No editing needed.

- **A mix is allowed.** If the strongest result takes its structure from one rough and something else from another, say which came from where and write the direction for the merged version.
- **If the user asked to see directions** (three by default, up to five), fix anything broken in each first, then give them the comparison page with one line per direction: its idea in a sentence and its trade-off. Do not rank them unless asked. Let them pick or mix, and wait for the answer; this is the one choice worth waiting for. If they asked for one, or nobody is there, choose yourself.
- **Choosing yourself**, ask in order: which first screen would someone screenshot and send to a friend; which would a visitor describe afterwards; which would be picked out at thumbnail size among competitors; which could only be this product. Then confirm the winner keeps the primary action obvious on the first screen; if it does not, fix that in the winner before giving up the stronger image. Check the winner does no harm to the subject: nothing printed over the product, nothing cut off. Do not pick the one that feels safest. The quiet, sensible option is the default this step exists to beat.

If nothing can be rendered, choose by seed, not by preference: `echo $((RANDOM % N))`, or the word count of the brief modulo N. Preference returns the default.

## 5. Write the direction

Read `ingredients.md` for the token roles every direction fills in and the options for colour, type, shape and space. Make each choice for this subject, then write the direction, short, in this shape:

```
Idea:        the mechanism, in the one sentence a visitor would repeat
World:       where the look is drawn from
Structure:   the fingerprint: what leads, section order, heading placement, rhythm
Combination: colour strategy + type characters + shape and space
Palette:     the token roles filled in, with values
Type:        families, the role of each, the display size
Move:     the big move on the first screen
Sections: each section's name and its device, one line each
Motion:   the one thing that moves by itself, or "feedback only"
Refuses:  two or three things this design will not do
```

Could the same direction describe a different product in another industry? Then it is a mood, and not yet decided.

Choose light or dark from where and when the thing is used, never from the category. Build one mode unless asked for both.

Where it goes: update `DESIGN.md` if the project has one. Otherwise put it in a comment at the top of the main file, and mention in the report that it could become a `DESIGN.md`. Do not stop to ask.

## 6. Build

Keep the winning rough and build out from it. Write the copy for each section before laying it out. Turn the direction into tokens (colour roles, type scale, spacing, radii, motion) in whatever form the project uses, with the numbers from `craft.md`, and build with tokens only. `web.md` or `mobile.md` says what goes where.

## 7. The first screen, once more

When the page works, go back to the first screen alone and spend one pass on nothing but how it looks. Working pages lose to better-looking ones at first sight, and this is the pass that gets skipped. Look at it at 1440 and at 390 and ask what a designer with another day would add:

- **Depth and light**: layers, a horizon, shading, a gradient that means something (time of day, distance), not a flat fill.
- **Detail in the picture**: the small true things from the subject (station names, contour lines, tick marks, a moon in the right phase).
- **The arrival**: one short entrance on load, with a reduced-motion version, so the screen feels made and not just displayed.
- **Type on the picture**: the headline placed with the image, not boxed beside it; sizes and line breaks set by eye.
- **Nothing lost**: the action still on the first screen and working, text contrast still passing over the picture.

Stop when the first screen is the one you would screenshot. Then give any other drawing on the page the same standard, so the first screen does not make the rest look unfinished.

Then run the loop in `SKILL.md`. In its Check step, also go through `tells.md`.

A direction drawn from the subject may share a trait with a tell (a receipt sets its figures in mono). That exception covers only the trait the chosen object itself has, only where that object appears. Name each one used in the report.

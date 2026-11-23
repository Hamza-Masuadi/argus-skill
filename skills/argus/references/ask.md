# Ask

For new work with an open brief. The user's answers are what make this design theirs instead of the one any model would produce, so a few good questions are worth more than any rule in this skill. Asked badly they are also the most annoying thing a design tool does. So: two short rounds, then the choosing page, then build.

- **Round 1, the business.** Asked once per project, then saved in `DESIGN.md` straight away (template below) and never asked again.
- **Round 2, this page.** Written after round 1's answers, using them.
- **Then the directions**, built and shown on one page to pick or mix (`create.md` step 4; for Operate surfaces, `product.md`).

## How to ask

- Use the environment's question tool if there is one, so the user can answer by clicking. Otherwise ask in one short message per round.
- Each round fits one form: four questions at most.
- Drop any question the brief, the codebase or `DESIGN.md` already answers. If a round has nothing left, skip the round. If both are answered, ask nothing.
- Every question can be skipped, and every question comes with your recommended answer already chosen, so a form submitted unchanged still gives you a working start. People skip question forms more often than they fill them in.
- Recommended answers are specific to this business, written from what you know of it. They must not all point the same way. Never recommend "warm", "friendly" or "clean" by reflex: a feeling word is not an answer to any of these questions.
- Options are words only: a short label and one plain sentence, always with room for their own words. Never put drawings made of text characters (boxes of `|` and `─`, checkbox glyphs), markup or code in a question or its preview; they render as noise. Pictures belong on the choosing page.
- Never ask for fonts, hex values or a named style ("minimal or brutalist?"): that is your job, and naming a style in a question gets it chosen.
- Further questions wait until there is something to look at.
- If there is nobody to ask, write down the assumption you are making for each question and carry on. Never wait in a loop.

## Round 1: the business

**1. Who is this really for, and what has just happened to them when they arrive?**
Not a demographic: a person at a moment. "a tenant whose boiler failed this morning and who has never called a plumber before" is useful; "homeowners aged 30 to 55" is not. Offer two or three likely people in situations, one recommended.

**2. Why would someone choose you over the nearest alternative?**
The rival across town, the old way, or doing nothing. Offer two or three plausible differences for this business (a fixed price before any work starts; the same person every time; open on Sundays) and recommend the one that would be hardest for a rival to copy.

**3. What happens when someone says yes?**
A form, a phone call, a booking link, a checkout, an app download. Recommend the likeliest for this kind of business. The answer decides what the first screen's action is and whether it can work on the page.

**4. What can I work from?**
"Do you have a logo, brand colours, your own photos or video, screenshots of the product, or a site you admire?"

Pictures the user supplies come before anything else, which is why this is asked. Do not ask what kind of pictures to use or whether to find them: the kind is decided from these answers, once (`imagery.md`, "The kind of picture"), and where photographs are right and nothing is supplied, Argus finds stock photographs itself and says so in the report.

A reference is the strongest input there is. If they share one, study its palette, type, density, layout idea and tone, and tell them which of those you will carry over. Brand colours and a logo they have are kept, not reinvented. The answers are asked once, here, and recorded in `DESIGN.md` (below, "After each round").

If the folder is empty and the brief does not say how to build it, ask "Plain HTML or a framework?" in place of the lowest-value question above, with plain HTML recommended unless the brief points elsewhere. For a mobile app whose platform is unknown, ask "iPhone, Android or both?" the same way.

## Round 2: this page

Write these after round 1 is answered. Use the answers in the wording and the options: name the person, the difference, the action.

**1. After the first screen, what should a visitor be sure of?**
Offer two or three beliefs, each one sentence in the visitor's voice, built from the round 1 difference: "someone will come today", "the price will not change once they arrive". Recommend the strongest.

**2. What has to be there?**
Real prices, real people, particular sections, opening hours, an area served. This is where real content comes from. Recommend what the belief needs as proof.

**3. What would be wrong for you, even if it looked good?**
Offer two or three ways a competent page could still be wrong for them: too corporate for a one-person trade, too playful for a funeral director, stock smiles where they have real photos of real jobs. Recommend the likeliest.

**4. How many directions should I show you?**
Offer **1, 3 or 5, with 3 chosen**. Five is the most. Each direction is a different idea for the whole page or screen, shown as a rough on one choosing page, to pick or mix. One means you choose and go straight to building. Say plainly that more directions take longer. The answer is the exact number you build; never quietly build fewer.

## Who gets the directions question

**All new work whose look is still open** gets question 4 and the choosing page: landing pages, product screens, dashboards, tools and app flows alike. There are only three exceptions: the work extends an existing system (`extend.md`), the user has already fixed the look (named it, gave a reference to follow, or supplied brand assets that settle it), or it is a tweak. This is the one place the rule is stated; every other file follows it.

## Operate surfaces

Dashboards, tools and app screens use round 1, then round 2 questions 2 and 4 (what must be on it, how many directions) plus any other round 2 question still open. Their roughs are working screens at real density, not marketing first screens (`product.md`, "Directions for a working screen").

## How the answers are used

- **The difference** (round 1, question 2) and **the belief** (round 2, question 1) are the source of the headline and of what the first screen shows. Every direction's headline comes from them, not from its layout.
- **Who lands here** sets the surface, the tone and what the first screen must answer.
- **The main action** is the first screen's action, and it must work.
- **What would be wrong for them** goes into each direction's Refuses line (`create.md` step 5).
- **The number of directions** is the number you build.
- **What they supply** is the first rung of the picture ladder (`imagery.md`). Anything it does not cover comes from the product itself or from stock photographs Argus finds without asking. A user who says "no photos", asks for an illustrated page or asks for generated images gets that instead.
- **What they prefer to look at** also chooses the register when only one direction is built (`create.md` step 2): a user who points at clean sites led by photographs or the product gets the plain register.

## After each round

- Restate what you took from the answers in two or three lines as you start, so a misunderstanding is caught early. Do not wait for a reply.
- Record them in `DESIGN.md` straight after the round: round 1 under "Product", round 2 under "This page". For new work, create the file if there is none, with just these two parts; `design-md.md` is not needed yet. The rest of the file is written at `create.md` step 5 (the direction and what was tried) and completed at step 9 (what was built). Keep it to a few lines:

  ```markdown
  ## Product
  - Who: the person and the moment they arrive in
  - Why us over the alternative: the difference
  - Main action: what happens when someone says yes
  - Supplied: logo, colours, photographs, references, or "nothing"

  ## This page
  - Belief after one screen: the sentence in the visitor's voice
  - Must be there: real content and sections
  - Wrong for them: what would be wrong even if it looked good
  - Directions to show: 1, 3 or 5
  - Competitors (only if looked at, `create.md` step 1): they all say; they all look; this page does differently
  ```

  A skipped question records the recommended answer you used, marked "assumed".
- The choice between designs is not a question to ask in words. Build the directions, show them on the choosing page (`create.md` step 4) and let them pick by looking. When you then ask which they want, each option is the direction's name and one sentence, plus "mix" in plain words.

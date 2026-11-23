# Imagery

Big pictures are a large part of what makes a page feel made by a studio. On a new Persuade page the hero has a large picture, and the pictures below it are few and large rather than small and many (`create.md` step 3). This file says what kind of picture a page uses, where pictures come from, and how to draw when drawing is right. Operate surfaces use pictures only where they carry information (`product.md`).

Contents, and when to read each part: **The kind of picture** and **The ladder**, before the directions; **Real pictures first** and **One register per page**, with them if the choice is unclear; **Video**, only when a clip is used; **Drawing in code**, only when drawing is the decision; **Slips**, in the loop.

## The kind of picture, decided once

Before the directions, decide once for the page, in one line, from round 1's answers. Ask no extra question.

- **The subject is physical and visible** (a place, people at work, objects, food): photographs.
- **The subject is software or a screen**: the product's own interface, shown working.
- **The subject is invisible or abstract** (a process, money moving, data, a protocol, a guarantee): drawn diagrams, or type-led sections. Run no photo search, except for the one mood photograph below.
- **Supplied pictures, or a wish the user stated**, override all of this.

Write the line into the direction (`create.md` step 5, "Imagery") and into `DESIGN.md` under "Images", for example `Pictures: photographs; the subject is a working bakery`. Every direction in the set uses it, so the choice is not remade per direction. The mood photograph below is the one addition allowed.

**One mood photograph, for software and abstract subjects.** Where the decision is the product, or diagrams and type, at most one direction in a set may add a single large atmospheric photograph that carries a feeling the user's answers named: calm, speed, scale, warmth, night work. The product (or, for an abstract subject, its diagram or type-led statement) is still shown on the first screen, in front of the photograph or beside it. The conditions: it is the only such photograph on the page; it shows a place, weather, light, a material or a landscape, never people at laptops, handshakes, offices, abstract 3D shapes or anything literal about computing; the headline stays readable on it at every width; and it passes the same keep test as any photograph (below, and `photos.md`). Its one or two queries, for the place or the light, go into the one batch of searches. It also gives the set a direction with a different ground and composition from the others.

**Type-led** means the section's picture is its type: a statement, a figure or a worked example set large in the page's own faces, on the ground, with space around it. It is not a section of headings, paragraphs and cards.

## Real pictures first

People trust what looks real. A page about real things is shown with real pictures:

- **Real things, places, people or food** (a tailor, a ferry, a clinic, a bakery): the default picture is a **photograph**.
- **Software, and anything with a screen** (an app, a tool, a card, a device): the default picture is **the product itself**: its real interface, rendered in HTML and CSS at high fidelity, inside a plain frame or a device outline, in a meaningful state with realistic data (a week of bookings half full, a balance after a payment). This is not illustration; it is the thing the visitor will use. Each section that shows it shows a different screen or state. Put `data-mock` on the mock-up's outer element (and `role="img"` with an `aria-label` where it is only a picture), so the checker does not count its small interface text among the page's type sizes (`web.md`).
- **Drawn illustration is the last rung.** Use it only when the user asks for it, where a photograph would be wrong (a diagram, a chart, an icon, a map, a cross-section), or when no usable photograph exists after a real search. Say which of the three in the report.

A drawing of something that could have been photographed or shown working is a weaker page, however well it is drawn.

## One register per page

A page is **photograph-led**, **product-led** or **illustration-led**. Do not mix them by default: drawn scenes beside photographs look like two sites. A product-led page may carry photographs of people using it, or its one mood photograph (above), and a photograph-led page may show the product in a photograph; the drawn register stays out of both unless the user asked for it. Diagrams and maps that carry information are allowed in any register, drawn plainly in the page's own type and colour, and so are type-led sections.

If usable photographs exist, never reject them because they would clash with drawings. Drop the drawings.

## The ladder

Take it in order, and use the highest rung available for each picture.

**1. What the user supplied.** Their photographs, video, product screens, illustrations and logo come first. `photos.md` applies to every photograph.

**2. The product itself**, for software and anything with a screen: built in HTML and CSS as above, shown working.

**3. Stock photographs, found by Argus.** This is the default for every picture the first two rungs do not cover. It is not asked about: find them and say so in the report.

- **Where a web tool exists and the subject is a common commercial one** (a shop, a trade, a café, a service people book), the free-licence stock sites below may be searched first: the photo tool's libraries are thin for everyday commercial subjects and often return nothing usable. Run the photo tool as well when its libraries may have the thing (places, landmarks, objects, nature, history). It is still one batch.
- **One batch of searches, run once.** Run the photo tool, `node "<skill>/scripts/photos.js" "<what is photographed>" --count 12`. It searches Openverse and Wikimedia Commons, downloads candidates into `photos-candidates/` and writes `credits.json`. Write three or four different queries from the subject's kit, in words for the thing itself ("baker scoring dough before the oven", not "warm artisan feeling"): the act, the tool, the material, the finished thing. Run them as one batch before the directions; every direction and the final page draw on that batch. One query alone is not a search.
- **Open and look at every candidate, once.** Never use an image you have not looked at. Reject any that is weak, off the subject, watermarked, too small for where it goes, or a near-duplicate of one already kept. Keep only those that show the subject truly, fit the direction and work as a set (`photos.md`, "Look at every image first"). A photograph of the right trade can still be the wrong place: keep it only if it fits this business's age, price level and customers, as round 1 describes them. A long-established neighbourhood business is not shown with a fashionable city interior, nor a budget service with a luxury one. The photographs kept for one page must also read as one place on one day: similar light, colour temperature, setting and era. Prefer several from one photographer or one series. Where that cannot be had, use fewer photographs and treat them alike (one crop ratio, one grade applied in CSS) rather than mixing them. Three that match beat five that do not.
- **If the batch is weak** (or was not run first, above) and the environment has a web search or browser tool, take photographs from free-licence stock sites such as Unsplash and Pexels as well, in one pass. Download each file into the project and add its author, source page address and licence to `credits.json` by hand, in the same fields the tool writes.
- **Then stop searching.** If fewer than three usable photographs came out of the batch and the fallback, use the good ones large and few, and make the remaining sections type-led rather than illustrated, so the page keeps one picture style. Not every section needs a picture of its own.
- Move the kept files into the project's image folder and delete the rest; never hotlink to the source. Never use a picture whose licence you cannot state. Resize large files to the largest size they are shown at (about 2400px on the long side for a full-bleed picture) and compress them.
- Record source, author, licence and licence address for each in `DESIGN.md`, and add a visible credits line or credits page wherever the licence requires attribution (CC BY and CC BY-SA do; CC0, public domain and the Unsplash and Pexels licences do not, but a credit is still courteous).
- A stock photograph is not the client's own: never present it as their premises, work, staff or customers. Stock people are never shown as real staff or customers.
- If nothing usable turns up at all, say so and go down the ladder.

**4. Generated images**, only when the user asks for them in their own words and the environment has an image-generation tool. Never offer them or ask about them. Write one art-directed brief for the set before making anything: the subject, taken from the kit; framing and viewpoint; the light (one source, time of day); the palette, from the direction's tokens; and one treatment for every image. Generate a small set to that brief. Look at each image before using it, and discard any with wrong details, mangled hands or objects, or a look that does not match the set. Never generate people's faces presented as real customers or staff, never put text inside a generated image (set it in HTML instead), and never let a generated image claim something false: a dish the bakery does not make, a ferry it does not run.

**5. Drawn in code**, as illustration, last: only in the three cases above, or as diagrams for an abstract subject. Below.

A user who says "no photos", asks for an illustrated page or supplies their own pictures gets what they asked for; the ladder is a default, not a ban on choice.

The report says which rung each picture came from. Where stock photographs were used, it says so, says where the credits file is, and says the user can swap in their own.

## Video

Video is allowed where the user supplies it, or where a free-licence clip is found the same way as photographs (looked at, credited, downloaded into the project). Keep it muted, short (a loop of under about 20 seconds), with a poster image shown before it plays, a visible pause control, and a still image in its place under reduced motion. Never autoplay sound. A looping clip of the real act (dough being scored, the ramp lowering) is a strong live element for the first screen.

## Drawing in code, as illustration

When drawing is right, draw well. A diagram explains; an illustration is something worth looking at. Most code drawings fail by being diagrams: flat shapes, one weight, centred in a box. Draw like this:

- **Build the picture from the kit.** The objects, marks and lettering the trade really uses, not icons or generic shapes. A paper pattern has notches, grain lines and dashed seam allowances; draw them.
- **Three depth layers.** A ground (a surface, a horizon, a table top), the subject, and a foreground that overlaps it (a corner of another object, an edge out of focus). Overlap is what makes depth.
- **One light source.** Choose where it is and keep every highlight and shadow consistent with it. A soft cast shadow under the subject does more than any outline.
- **A limited palette from the direction.** Three to five colours from the tokens, plus their lighter and darker steps for light and shade.
- **One stroke weight and one corner treatment** across every drawing on the page, so they read as one hand.
- **Texture, so flats are not dead.** Fine grain or noise, paper fibre, hatching, a subtle gradient across a large surface. Keep it quiet enough that text over it still passes contrast.
- **True small details.** Real numbers, real names, the right count of things, the wear on an edge. Detail is where a drawing stops looking generated.
- **Scale it to its space.** It fills its area, bleeds off an edge where that helps, and is not a small object floating in a large empty box.
- **Make it respond or move.** The hero drawing carries the live element; others reveal as they arrive or answer a hover or tap (`craft.md`, Motion).

The forms available:

| Form | Good for |
|---|---|
| **SVG scenes and objects** | The kit object, a scene with layers, maps and routes, anything drawn that must stay sharp and can be animated part by part |
| **Canvas** | Fields of many small things: particles, grain, weather, a crowd of marks; anything that would be thousands of SVG elements |
| **CSS** | Surfaces, light and pattern: paper, cloth, chalk, a gradient of daylight, repeated markings, layered shadows |
| **Type as image** | Lettering at great size, cut, stacked or set on a path, where the words themselves are the picture |

Every drawing that carries meaning has an accessible name (`role="img"` and `aria-label`, or a `title`); decorative ones are hidden from screen readers. Check each one at 320: a scene that works wide may need to be recomposed, not shrunk.

## Slips specific to imagery

- Drawings on a page about real things with no photo search run, or after a single query.
- Searching again and again for a section's picture, instead of making it type-led.
- Usable photographs rejected because they "clash with the drawings".
- Asking the user whether to find photographs, or offering generated images they did not ask for.
- Photographs and drawn scenes mixed on one page without the user asking (`check.js` prompts on it: `mixed-pictures`).
- Gaps filled with drawings when the photographs ran out; type-led sections keep the page in one style.
- A software page shown with drawn shapes instead of its real interface.
- A sourced image used without being opened and looked at, hotlinked from its source, or with no source and licence recorded.
- Stock people presented as staff or customers; a sourced photograph presented as the client's own.
- One picture in the hero, then headings, paragraphs and cards for the rest of the page.
- A drawing that is a diagram: flat shapes, one weight, no light, no ground.
- Pictures in mixed styles or lights on one page; stock photographs from several shoots that read as several places.
- A mood photograph of laptops, offices, handshakes or 3D shapes, or more than one on a page.
- A generated image with text in it, a wrong detail, or a face presented as a real customer or member of staff.
- A picture small in a large empty box, or a photograph shrunk into a card.

# Pictures

Every picture on a page, supplied, found, generated or drawn. Whichever rung a picture comes from, the page reaches the same finish (`composure.md`): generation is an extra, never a requirement. Operate surfaces use pictures only where they carry information (`product.md`).

## The kind of picture

**Decide it once, before the directions, in one line,** from the owner's answers, and ask no extra question: a physical subject gets photographs; software gets the product's own interface working; an invisible or abstract subject (a process, money moving, a protocol) gets diagrams or type-led sections and no photo search. Supplied pictures or a stated wish override this. Write it into the direction and `DESIGN.md` ("Images"): `Pictures: photographs; the subject is a working bakery`.

- **Real pictures first.** Real things, places, people or food are shown in photographs; software and anything with a screen is shown as the product itself, rendered in HTML and CSS in a meaningful state with realistic data, a different screen or state per section, marked `data-mock` (with `role="img"` and an `aria-label` where it is only a picture).
- **One mood photograph is allowed for software and abstract subjects,** in at most one direction of a set: a place, weather, light or a material that carries a feeling the user named; never people at laptops, handshakes or 3D shapes. The product stays on the first screen in front of or beside it.
- **One register per page:** photograph-led, product-led or illustration-led. Plain diagrams and maps that carry information are allowed in any register, as are type-led sections. Never reject usable photographs because they clash with drawings: drop the drawings (`mixed-pictures`).
- **Type-led means the section's picture is its type:** a statement, a figure or a worked example set large in the page's faces, with space around it; not headings, paragraphs and cards.

## The ladder

This is the one statement of where pictures come from. Each picture uses the highest rung available, and the report names each picture's rung.

1. **The owner's own** photographs, video, product screens, illustrations and logo. For software, the product itself counts here.
2. **Generated**, only when a generation tool is in this session and the owner said yes in the question message (below).
3. **Stock**, found without asking: one consistent, sharp set, the palette sampled from it.
4. **Drawn or built in code**, for what a photograph cannot show (a process, a route, a mechanism, a cross-section) or as a built object (a document, a ticket, a product screen, a rendered pack for a physical product with no photograph). A drawing never stands in for a photograph of something real.
5. **Type and space alone**: the statement set well, with room.

When photographs run out, use the good ones large and few and set the other sections type-led; do not fill the gaps with drawings. A user who says "no photos", asks for illustration or generated images, or supplies pictures gets that: the ladder is a default, not a ban.

## Finding photographs

**One batch, run once, before the directions:** three or four queries from the kit, in words for the thing itself (the act, the tool, the material, the finished thing: "baker scoring dough before the oven", not "warm artisan feeling"). Every direction and the final page draw on it. Then stop searching: with fewer than three usable photographs, use the good ones large and set the rest type-led.

What works with no keys (checked 26 Nov 2026 on a clean machine), in order:

1. **`photos.js "<what is photographed>" --count 12`**: Openverse and Wikimedia Commons, downloaded with credits (`--best` puts Commons quality images first). Strong for places, objects and nature; thin for everyday trades. StockSnap and rawpixel hits are listed to download by hand.
2. **Unsplash, chosen by hand**: its search page (`unsplash.com/s/photos/<words>`) opens with any fetch or browser tool the session has; pick by looking, then `photos.js add <photo-page-url> --out <dir>` downloads and credits each, and `photos.js series <photo-or-profile-url>` pulls that photographer's set, so the pictures look like one shoot. Skip Unsplash+ and promoted listings.
3. **Pexels and Pixabay need a free key**: their pages refuse scripts (403), so `add` fails without one. Set `PEXELS_API_KEY` (pexels.com/api) or `PIXABAY_API_KEY` (pixabay.com/api/docs) and search, `add` and `series` use the API.

Software uses the product, with one mood photograph at most. A picture fetched any other way gets its author, source page and licence written into `credits.json` by hand.

## Look at every image

**Open every image before planning or using it:** the search downloads candidates, not choices. Judge them on `photos.js sheet <dir>`, then each at the size it will be shown (`photos.js sharp <dir> --width <px>` flags likely soft and dark ones; its flags are warnings, not verdicts). Keep only what is sharp, well lit and clear at its size, shows the subject truly, fits this business's age, price level and customers, and reads as one place on one day. A soft, dark or noisy photograph is discarded, however apt its subject; never swap a sharp photograph for a moodier, blurrier one. At least one picture places the visitor in the right kind of room (a dental page of tea and armchairs reads as counselling), unless the owner's bans rule every such picture out.

## One set

- **Find the best photograph first, then pull its photographer's series**, and choose every picture from one set if it has four usable ones; otherwise at most two shoots, grouped by section.
- **One light**: the pictures share light, colour temperature, setting and distance. A set from one shoot needs no grade; mixed shoots may take one gentle grade (`photos.js grade <dir> --look warm|cool|mono|duotone`). A grade never darkens or softens a photograph so that its subject reads less clearly, and photographs of the product being sold are never graded.
- **One person, one role:** the same model appears twice only as the same named person.
- **The page's ground, ink and accent come from the main photograph** (`photos.js palette <file>`; `colour.md`, C2).

## Cropping and text on pictures

- **One crop family per set** (for example 3:2 wide and 4:5 tall); a grid shares one ratio. Set the focal point per image (`object-position`) and check every crop at every width.
- **Give each picture a size where its subject reads**; never so small the subject is lost. Listings keep the subject whole.
- **Text sits on a calm area** (sky, wall, floor), on a solid band, or beside the picture; never over faces or the subject. Check contrast against the actual pixels at every width. Prefer a real clear area to an overlay; a scrim is a gradient in the ink's hue on the text's side only, as light as passes 4.5:1.
- **Captions are small and factual**; figures drawn on the picture follow `composure.md`, "Data on the picture".

## Delivery

`photos.js deliver <dir>` writes AVIF, WebP and JPEG at 640, 1024, 1600 and 2400px, the `<picture>` markup with real sizes, and each picture's dominant colour as its placeholder. The hero at or under about 250KB, other images about 120KB; `--max-kb N` re-encodes, then shrinks, until every file fits. Rename pictures freely: credits are kept by the photo's source page and its bytes, and `deliver` writes the new name; the hero `fetchpriority="high"` and not lazy, everything below the first screen `loading="lazy"`; every image has `width` and `height` (or an `aspect-ratio`), real alt text, and `height: auto` in CSS so it never renders at its intrinsic height.

## Honesty and credits

- **Download kept files into the project, never hotlink,** and never use a picture whose licence cannot be stated. Record source, author, licence and licence address in `credits.json` (search, add and series write it) and `DESIGN.md`; credit visibly in the footer or a credits page where the licence requires it (CC BY, CC BY-SA), never as captions on the pictures.
- **A stock photograph is never presented as the client's own** premises, work, staff or customers. Where no honest photograph of their people or premises exists, use names without faces and hands at work, and list what the owner should supply under "Before launch". A stock photograph of a person never carries a name, role or quote, and one of an item never carries a claim about that item.
- **Third-party marks** (logos, plates, watermarks, recognisable people) are noted in the report and cropped where that costs nothing; whether an image may be used is the client's question.
- **Sample content, stand-in photographs and generated pictures are said once, in one footer line** ("Sample business; photographs are stand-ins"), never on individual items. A frame left for a photograph the owner must supply says what goes there.

## Generated pictures

Only when an image-generation tool is in this session, and only after a yes in the one question message (`ask.md`). No yes, or a run without questions: take the next rung and say in the report, in one line, that generation was available.

- **A yes covers the set.** Write one art-direction brief from the direction, then generate the set without asking again per image. When the tool reports cost, state the expected total before starting.
- **The brief**: the subject from the kit; the light (one source, time of day); palette words from the tokens; the composition with a named empty area for the text ("calm sky across the upper left third"); the aspect ratio of its slot; and what must not appear. Generate the set with one look: the same light and palette words, a reference image or fixed seed where the tool allows.
- **Never generated:** staff, customers, faces beside reviews, certificates, awards, the product or results presented as real, food the business does not make, or a real place claimed as the client's premises; no real person's likeness, no logos, no text inside an image (set it in HTML).
- **Look at each image and discard** waxy skin or food, nonsense lettering, too-even light, impossible reflections, hands, and anything off the set.
- **Record each one** in `credits.json` (source "generated", the tool, the prompt) and `DESIGN.md`, as a stand-in to replace, noted once in the footer line.

## Drawing in code

A line drawing that carries information (contour rings, a map outline, a curve, a cross-section) is drawn as `composure.md` says: one stroke weight, the palette's ink, small labels. SVG for objects, maps and anything animated part by part; canvas for fields of many small things; CSS for surfaces, light and pattern. Every meaningful drawing has an accessible name (`role="img"` and `aria-label`); decorative ones are hidden; check each at 320 and recompose rather than shrink. How to build and animate drawings: `bespoke.md`.

## Video (optional)

A muted loop can open a page where being there is the offer (places, hospitality, food, travel, fitness, events) and real movement says it better than a still: water, steam, light through leaves. Never a soft, shaky or fast-cut clip.

- **Finding**: `photos.js video "<words>"` lists free-licence clips (Mixkit's Free licence and Wikimedia Commons without a key; Pexels and Pixabay with a key); `photos.js video get <page-url> --out media/` downloads one under the 4 MB budget and writes its credit. With ffmpeg, `photos.js loop <clip> --seconds 10` writes the 1080 WebM and MP4, a 720 MP4 for phones and a poster; `photos.js poster <clip>` takes the poster frame. Without ffmpeg, use the file as it is if within budget, or its poster as a still.
- **Choosing**: slow, steady footage, one action, no cuts; a calm area for the headline through the whole loop; six to fifteen seconds that loop without a visible jump.
- **Markup**: `<video autoplay muted loop playsinline aria-hidden="true" poster="...">` with WebM then MP4 sources; a visible pause button outside it; under reduced motion or saved data, pause it and keep the poster. Nothing waits for it: the headline and action show on the first frame. The checker reports `hero-video` and `video-heavy`.

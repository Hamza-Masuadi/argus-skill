# Photo-led pages

For sites where pictures do the selling: cars, property, food, fashion, travel, portfolios, products, and any subject made of real things, places or people. Read "Look at every image first" when candidates come in, and the rest when building with them. This file applies whenever photographs are used: supplied by the user, found as stock by Argus (the default where nothing is supplied), or generated because the user asked for that (`imagery.md` has the ladder, the photo tool and the rules for each). Photographs are the default picture for real subjects; drawing is the last rung, not the fallback. Here the photograph is the design and everything else is a frame for it. Most of what makes these pages fail is done to the photos, not around them.

## Look at every image first

Open each image before planning anything or using it, supplied or found: the photo tool downloads candidates, not choices. File names, captions and search results are often wrong. For each one note:

- what it actually shows, and whether it can be named with confidence;
- where the subject sits in the frame and how much space is around it;
- its shape, and whether it would survive a different one;
- how light or dark it is, and its dominant colours;
- anything in it that is not the client's: other brands' logos, number plates, watermarks, people's faces, event branding;
- what kind of place and customer it suggests: its age, its price level, who is in it.

Plan the page from what the pictures can do. A set of wide side-on shots makes a different page from a set of tight details. Discard a found image that is weak, that does not show the subject truly, that shows the right trade in the wrong kind of place (its age, price level or customers do not match this business), that has a watermark or another brand in it, that is too small for where it goes, that nearly repeats one already kept, or that does not belong with the rest of the set: the photographs for one page read as one place on one day (below).

## Photo craft

These hold for every photograph on the page, supplied or found:

- **One place, one day.** The photographs on one page share light, colour temperature, setting, era and distance: morning daylight with morning daylight, close details with close details, rooms of the same age and price as this business. Prefer several from one photographer or one series. Where that cannot be had, use fewer and treat them alike (one crop ratio, one grade applied in CSS) rather than mixing. Five photographs from five different shoots look like stock; three matched photographs beat five unmatched.
- **One treatment for all**: one crop ratio family (for example 3:2 for wide pictures and 4:5 for tall ones), and one grade or overlay, or none. Never a different filter per picture.
- **Big, not boxed.** A photograph goes edge to edge or fills its column. Never a small rectangle inside a card with a heading under it. In the hero it is shown large and uncropped enough to read what it shows, never as a sliver or strip behind a card or a form laid over most of it.
- **Text on a calm area, or beside it.** Put text on a quiet part of the photograph (sky, wall, table, a soft-focus background) with its contrast checked against the actual pixels at every width, or beside the picture. Keep faces and the subject clear of text.
- **Technical basics, every image**: `width` and `height` attributes (or an `aspect-ratio`), real alt text that says what the picture shows, `loading="lazy"` below the first screen (never on the first screen's picture), and a background colour sampled from the image on its container, so the space is the right tone while it loads. Serve a size close to the size shown (`srcset` where the project allows it).

## A mood photograph

On a software or abstract page, one direction may use a single atmospheric photograph (`imagery.md`, "One mood photograph"): a place, weather, light, a material or a landscape that carries the feeling the user named, with the product or its type-led statement in front of it or beside it. Everything in this file applies to it. Choose it for a calm area where the headline can sit, check its contrast at every width, and keep it the only one on the page.

## On photo-led pages, the photo is the big move

The "big move" in `create.md` still applies, and here it is nearly always the same one: one excellent photograph, very large, with nothing fighting it. Type gets quieter as the picture gets stronger. The live element (`create.md` step 3) is the browsing itself, or the photograph answering the visitor: choosing an item changes the picture, a gallery moves under the hand, a slow push-in on the hero image as the page arrives. It does not mean animated devices laid over the photos. The rest of the motion layer (`craft.md`) applies as usual: feedback, the arrival, sections arriving as they enter view.

Where a section has a picture, it is a photograph. When the good photographs are few, use them large and set the other sections type-led (`imagery.md`) rather than adding weaker ones. The rule that every section has a device gives way: on a catalogue page a calm, consistent grid of good pictures is the right answer, and inventing a gimmick per section gets between the visitor and the stock.

**Found and generated photographs** follow every rule in this file, plus those in `imagery.md`: each one looked at before use, downloaded into the project (never hotlinked) and resized; source, author and licence recorded in `credits.json` and `DESIGN.md` and credited on the page where the licence requires it; a written brief for generated ones; no stock or generated people presented as real staff or customers, and never presented as the client's own premises or work.

## Cropping

- **Keep the subject whole.** A wide subject (a car, a building, a table laid for dinner) does not survive a square or portrait crop. Choose the frame's shape to suit the pictures, not the layout's convenience.
- **Use one shape for a set.** Listings in a grid share one aspect ratio, chosen so the widest subject still fits. Mixed shapes in a grid look accidental.
- **Set the focal point per image** (`object-position` on the web, the equivalent elsewhere), because the subject is rarely dead centre. Check each crop at every width: a crop that works on desktop often cuts the subject on a phone.
- **Leave the subject air.** If the original is tight, do not crop tighter.
- When a frame cannot fit the subject, show the whole picture with space around it instead of cutting it.

## Text and pictures

- **Do not put text over the subject.** Text goes beside the image, in a clear area of it (sky, floor, wall), or on a solid band. Find where each picture has room before choosing where words go.
- **Text on a photo must pass contrast against the actual pixels behind it**, at every width, since the crop moves. Prefer a real clear area to a heavy dark overlay; an overlay strong enough to make any text readable also kills the picture.
- **Captions are small and factual.** Name, the two or three facts a buyer scans for, price.

## A set that looks like one set

Supplied photos rarely match: different light, colour, backgrounds.

- Put the strongest, most consistent images in the most visible places and the odd ones lower down.
- Group like with like: studio shots together, location shots together, details together.
- On a dark page, a bright daylight photo glares; on a light page, a night shot becomes a hole. Give outliers a frame, a smaller size, or a section whose background suits them. Do not grade or filter supplied photographs of what is sold into agreement unless asked; that alters what the product looks like. Found stock photographs may share one light grade in CSS, as above.
- Take the page's accent colour from something in the photographs. It will sit with them naturally.

## Catalogues and listings

- The first screen is stock. Its large photograph is an item that is for sale, shown with its name and price and the way into the rest. A visitor who came to browse should not have to get past a mood piece.
- Every listing shows the same facts in the same order, so the eye can compare down the page.
- Filters and sorting sit with the grid, show their state, and give a count. An empty result says so and offers to clear.
- Enquiring about an item carries that item with it: the form opens already knowing which one.
- On phones, long lists get compact cards: a small picture with the name, key facts and price beside or under it, so three or four items fit on a screen. A dozen items each at full-screen height make a page nobody finishes. The length limit is in `craft.md`.

## Honest pictures and labels

- **Name only what you can see.** Give a make, model, place or dish only when the photograph makes it identifiable. Otherwise describe it without the claim. Go no further than the picture does: a trim level, edition, vintage or variety is named only when a badge or label is readable in the image.
- **A sample catalogue says it is a sample**, visibly, once. Invented prices and specifications are stand-ins and are listed in the report.
- **Do not imply stock that the pictures do not show.** A photo of something not for sale belongs in a general section, not on a listing.
- **Third-party marks**: note logos, plates, watermarks and recognisable people in the report. Crop them out where that does not hurt the picture; never edit them away or blur faces without being asked. Whether an image may be used is the client's question, so flag it and do not decide it.
- **Alt text describes the picture** for someone who cannot see it: what the item is and how it is shown.

## Performance

Photos are the heaviest thing on the page. Give every image its dimensions so the layout does not jump, load below-the-fold images lazily, and never load a 4000-pixel file into a 400-pixel card. Resize found files before use (the photo tool flags large ones). Say in the report if the supplied files need resizing.

## Slips specific to photo-led pages

- A headline or button sitting on top of the subject.
- The subject cut off by the crop at one width.
- A grid of mixed image shapes.
- A dark overlay heavy enough to flatten the picture.
- The best photo used small and a weak one used large.
- Devices and decoration competing with the photographs.
- A model or place named from the file name instead of the picture.
- Photographs from different shoots, lights and distances side by side with no grouping; stock from several shoots where fewer, matched ones would do.
- A photograph shrunk into a card, or every picture given a different crop or filter.
- A found image with no credit where its licence asks for one, or loaded from the source site instead of the project.

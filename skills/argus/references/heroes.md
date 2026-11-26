# Heroes

Contents: **Choosing a composition** · **Picture and type** · **Full-bleed openings** · **On the first screen** · **Cut-outs** · **Type-led heroes** · **Honest limits**.

The first screen's composition. What every first screen must do, and the bar, are in `first-screen.md`. Compositions are data: `node "<skill>/scripts/deal.js" directions ...` deals one per direction, fitted to its kind; `deal.js show <id>` gives build notes, fit and failure; `deal.js list heroes --tag minimal|picture-led|expressive` lists the ones for a kind.

There is no single strong hero. A quiet headline with generous space and one sharp photograph, a full-screen photograph with the headline on its calm area, and a width-filling line of type with something live are all strong when they suit the business and are carried out well. What makes any of them weak is the same: unclear, crowded, a poor picture, or things colliding.

## Choosing a composition

**H7. Start from the dealt composition and check it against what leads**, what pictures exist (`pictures.md`) and the direction's kind. Swap it for a reason (it fights the pictures you have, the taste, or the idea), taking the replacement from `deal.js list heroes --tag <kind>`. Why: the deal keeps you off habit; it is not a rule.

**H8. Each direction in a set uses a different composition.** Why: one arrangement in three paints is one direction.

**H9. Fit the composition to the kind.** Minimal: a headline at a comfortable display size with space around it, the action, one proof line if the owner gave one, and one sharp picture or none (`quiet-statement`, `letter`, `ruled-offer`, `trade-board`, `plain-object`, `centred-frame`, `drawn-subject`, `headline-then-photo`, `quiet-field`, `contact-sheet`). Picture-led: the photograph or the product as large as it stays sharp, type quiet on its calm area or beside it (`photo-with-headline`, `photo-caption-bar`, `full-bleed-corners`, `full-bleed-video`, `window-video`, `contact-sheet`, `photo-then-label`, `frame-to-bleed`, `centred-frame`). Expressive: type at scale, a cut-out, a working object or a drawn world, with something live. Why: each kind has its own way to be strong.

## Picture and type

**H11. A side-by-side first screen** (text in one column beside a picture, device or drawing: `calm-split`, `split-device-straddle`, `split-colour-fields`, `stacked-cards`, `sticky-index`) **is never dealt or swapped to unless the owner asked for one or the first screen must hold a form or tool beside the headline** (`deal.js --allow side-by-side`, or `--needs form-in-hero`; then one direction at most). That is the owner's standing preference for this skill's default: it is the arrangement every generated page falls into. When asked for, it fails if the photograph is weak or small, or the column is crowded. Why: clear has more than one shape.

**H12. A full-bleed photograph or muted loop** carries the page when it is excellent: the headline and action sit on its calm area or on a solid panel, never over the subject (H16a-H16g). Why: on photo-led pages the picture sells.

**H13. Type crossing a picture is one option, for an expressive direction,** when the picture has a calm area or a cut-out subject and every word still reads. Build it as a stack (`grid-area: 1 / 1` with `z-index`), check the contrast on the pixels, and recompose at 390. Why: done well it has depth; done carelessly it collides.

**H14. Match the ground to the photograph** when they meet: sample its white or wall as `--c-ground` (`colour.md`). Why: picture and page then share one plane.

**H15. One picture treatment per page**, carried by every picture (`pictures.md`, "One set"). Why: mixed treatments look like two sites.

**H16. Crop for the subject:** keep it whole when the visitor needs to see it (a product, a room, a face); crop at an edge only when it adds scale and loses nothing the visitor needs. Why: a crop is for the picture, not a rule.

## Full-bleed openings

A photograph or a muted loop filling the first screen is one of the strongest openings there is, and it is underused because the rules about faces, busy areas and sharpness are easy to fail. Done as below, it passes them.

**H16a. Use it where being there is the offer:** places, hotels and hospitality, food and drink, travel and the outdoors, fitness, fashion, events, venues. Not for software (the product working is the picture), not for a service where a photograph adds nothing (accountancy, legal, insurance), and never with a weak picture: then a split or type-led opening is better. Why: the picture must carry the sale on its own.

**H16b. Choose the picture for its calm area** as much as its subject: sky, a wall, water, a table top, an out-of-focus foreground, a third of the frame where nothing happens. No calm area, no text on it: put the words on a solid band below or beside. Why: the picture decides where the words can go.

**H16c. Make the calm area work:** crop with `object-fit: cover` and move the focal point with `object-position` per width (`--focus: 30% 60%` at 1440, another at 390) so the subject stays whole and the calm third stays under the text. Why: the crop that works wide often puts the headline on a face when narrow.

**H16d. Earn the contrast lightly.** First a real calm area; then, if needed, a restrained gradient scrim on the text's side only (for example `linear-gradient(to right, oklch(20% .02 <hue> / .55), transparent 60%)`) or a thin tint in the ink's hue, sized until the text passes 4.5:1 on the actual pixels at every width; never a flat dark sheet over the whole picture, and never text over a face. Why: a heavy overlay kills the picture it was chosen for.

**H16e. Type for legibility on a picture:** a medium to semibold weight, a size the direction sets but not thin hairlines or light weights, short lines, the headline and one line under it, the action in a solid button. Why: thin type disappears into texture.

**H16f. The action is visible on the first frame**, at 390 as at 1440; on a phone, a full-height picture may give way to the picture above and the words and action on the ground below (`photo-then-label`). Why: a poster with no way in is a dead end.

**H16g. What follows keeps the opening's light:** the next section continues its palette (sampled from the picture), its type and its calm, with one more picture within the next screen or two; never a jump to a stock card grid. Why: otherwise the page reads as a poster stuck on a template.

Video openings follow the same rules, plus `pictures.md`, "Video".

## On the first screen

**H18. An interaction, when the direction has one, lives where it means something:** on the picture or the product, or as the working form; never as a widget pasted beside an unrelated photograph. Annotations on a photograph (a dimension, a price chalked on) are an option where they explain. Why: it should read as one thing.

**H19. Navigation fits the composition:** a plain bar is fine; a split or corner layout is an option for picture-led and expressive pages (`layout.md`, "Navigation"). Why: the header serves the page.

## Cut-outs

**H20. Prefer stock shot on a seamless ground** ("on white", "studio"). Why: clean edges and believable light.

**H21. Cut with `node "<skill>/scripts/photos.js" cutout <file>`,** then check the edge at 200% on light and dark grounds; recut or replace a haloed one. With rembg installed it uses only the `birefnet-general` model, whose licence allows commercial use. Why: halos give a cut-out away at once.

**H22. A white-ground shot on a light page can skip the cut:** `mix-blend-mode: multiply` drops its white into the ground. Use it only on grounds lighter than the shot's shadows. Why: it keeps the real contact shadow.

**H23. Depth on a cut-out comes from the subject:** a soft `filter: drop-shadow()` or a contact ellipse. Why: it stands on the ground.

## Type-led heroes

**H24. Type-led compositions need no photography:** a statement with space, the type wall, one figure set large, the letter, a marquee title. Why: with no good pictures, type and space make an honest, strong first screen.

**H25. A type-led hero still carries one specific thing:** the price, the hours, the number only this business has. Why: type with nothing specific is a specimen.

## Honest limits

**H26. Out of reach:** art-directed shoots, custom 3D and WebGL, scroll-scrubbed sequences without footage, illustrators. Stock video is within reach (`pictures.md`, "Video"). Say so in the report rather than fake them. Why: a fake looks cheaper than an honest substitute.

**H27. The substitutes, best first:** the best sharp stock photograph used well; a type-led first screen; the product rendered in a real state; a cut-out on a ground sampled from it; one grade across all pictures; a rendered pack where the product has no photograph (`pictures.md`); `<model-viewer>` only for a glTF the client supplies. Why: each reads as made.

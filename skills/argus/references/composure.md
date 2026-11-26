# Composure: a finished page in any style

Habits that make a page read as finished, whether it is bold or quiet, dense or spare, dark or light, picture-led or type-led, and whatever rung its pictures come from (`pictures.md`). None of them is a look. Opened at the section plan (`build.md`).

## One thing per section

Plan the page as sections that each hold one thing (a picture, a drawing, a table, a statement, a working device), then cut or move the rest. Why: one subject gives the eye somewhere to land; stacked blocks read as assembled.

- A section holds its one thing, a short statement and what that thing needs; a caption or one action may join it, a second idea may not.
- A section is as tall as its content: a picture or drawing may take the whole screen; a table, list or form is shorter, with normal section padding (`layout.md`).
- **Room is earned.** Space around a strong thing is a choice; space around nothing reads as unfinished. If a section looks empty, give it a stronger thing, not more air.
- Three columns of icon, heading and paragraph are usually three ideas squeezed into one row: give each its own room, or make them rows of one table, unless the content really is three equal things.

## The frame does not compete

The frame (navigation, labels, body text, headings, rules) never competes with the section's one thing. Why: then the picture or the idea carries the page. This is about the chrome, not the page: the ground may be white, dark or a committed colour, the page dense or spare.

- **Navigation** at label size, few links, one filled button at most (the action).
- **Body** comfortable to read (`type.md`); section headings a clear step above it. Large type anywhere is fine where it is the section's one thing.
- **One accent**, for the action and one or two marks.
- **Plain ruled tables** for rates, specifications, terms, hours and comparisons: label left, value right, hairlines between rows. They beat cards for anything read as rows.
- **A small label above a heading only when it carries information** (a step number in a real sequence, a date); never on every heading by habit.

## Few words

Guidance, not a cap: per section a statement of about four to ten words and at most one short paragraph (about 15-40 words). Detail goes into a ruled table, a disclosure row or the questions block. Why: a page is skimmed in statements. `convert.md` still holds: what it is, who it is for, the action and the answered objections stay findable; they change form, not presence.

## Drawn in code

A drawing carries an idea that is a shape, a place, a process or a comparison better than a photograph can: contour rings for a boundary, a route on a map outline, a tide or load curve, a cross-section. Every drawing on a page shares one stroke weight, label style and corner treatment, in the palette's ink and at most the accent (`bespoke.md`).

A real-looking object built in HTML, CSS and SVG can be the picture: a document, a ticket, a product screen with believable data. True detail (dates, sensible numbers), one soft shadow, marked as a sample (`data-mock`).

## Data on the picture

Draw information on the photograph: a curve over the shore, a route over the hill, rings over the aerial view; thin lines, small labels. To keep it aligned, put image and SVG in one box with the image's aspect ratio, give the SVG the image's size as `viewBox` with `preserveAspectRatio` matching `object-fit`, and place HTML labels in percentages. Legibility comes from a small local backing or a text outline, never a scrim over everything. Labels are real text; the image keeps its alt. The snippet `svg-annotated-picture.html` does all of this.

## One world, and the return

The pictures share one light: one photographer's series, one generation brief, or one gentle grade where mixed shoots need it (`pictures.md`). The palette is sampled from the main picture (`colour.md`, C2); with no picture, from the direction's Source line. One motif from the subject recurs in drawings, rules and the favicon. The last section returns to the opening picture or motif, with the action. Why: a page that ends where it began feels whole.

## Honest labels

Sample data, stand-in photographs and generated pictures are said once, in one footer line, and listed in `credits.json` and `DESIGN.md` as stand-ins to replace. A frame for a picture the owner must supply says what goes there. Why: clean is not passing off.

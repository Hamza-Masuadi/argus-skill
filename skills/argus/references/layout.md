# Layout

Contents: **The grid** (L1-L5) · **Space** (L6-L8) · **Objects and layers** (L9-L13) · **Sections** and **Navigation** (L14-L17) · **Widths** (L19-L21) · **Modern CSS** (L22) · **Shops and booking** (L24-L26).

For Persuade and Read pages (tools: `product.md`). Continuity, density and the finale are in `flow.md`. The checker's advisory prompts `repeated-layout`, `lopsided-section`, `blank-band` and `narrow-content` ask you to look at what this file describes; `covered-content` is a floor rule.

## The grid

**L1. Declare a page grid with named lines:**

```css
.page {
  --gutter: clamp(1rem, 4vw, 3rem);
  display: grid;
  grid-template-columns:
    [full-start] minmax(var(--gutter), 1fr)
    [wide-start] minmax(0, 6rem)
    [content-start] min(100% - 2 * var(--gutter), 76rem) [content-end]
    minmax(0, 6rem) [wide-end]
    minmax(var(--gutter), 1fr) [full-end];
}
.page > *     { grid-column: content; }
.page > .wide { grid-column: wide; }
.page > .full { grid-column: full; }
.prose        { max-width: 65ch; }
```

At most three widths a page: prose, content or wide, full. Why: few repeated x-positions make a page read as designed.

**L2. Inside content, a 12-column grid,** `grid-template-columns: repeat(12, minmax(0, 1fr)); column-gap: clamp(16px, 2vw, 32px)`, items on shared column lines, positions repeating row to row (a product's picture, name and buy button in the same places). Why: repetition makes rows a grid.

**L3. Align across rows with subgrid:** `.item { grid-row: span 3; display: grid; grid-template-rows: subgrid; }`. Why: titles and prices line up across a row.

**L4. Choose the split for the content:** equal halves suit two things of equal weight (text beside a photograph); 5/7, 4/8 or a fixed rail beside a fluid area (`grid-template-columns: 18.75rem 1fr`) suit a lead and a support. Why: the content's weight sets the columns.

**L5. Catalogues add columns, not gaps:** `repeat(auto-fill, minmax(min(100%, 18rem), 1fr))`. Why: wide screens get more things, not more air.

## Space

**L6. A fluid space scale, fluid between 320 and 1440:**

```css
:root {
  --space-s:   clamp(1rem, .9rem + .5vw, 1.25rem);
  --space-m:   clamp(1.5rem, 1.3rem + 1vw, 2rem);
  --space-xl:  clamp(2rem, 1.6rem + 2vw, 3rem);
  --space-3xl: clamp(4rem, 3rem + 2.5vw, 6rem);    /* section padding, 64-96px */
  --space-breath: clamp(6rem, 3rem + 12vw, 15rem); /* a breath section, about 96-240px */
}
```

Why: rhythm needs contrast in space, not a uniform 80px.

**L7. Section padding 64-96px; a breath section of up to about 240px is an option** where one strong statement, figure or picture needs room. A full-screen picture or drawing replaces the padding, edge to edge. Why: varied space paces a long page.

**L8. Sections separate by space, a change of layout or ground, or a rule and air** (a 1px ink line at 15% spanning `wide`). Space inside a group is smaller than between groups, more above a heading than below. Why: grouping by space is what makes a page scannable.

## Objects and layers

**L9. Box what belongs together.** A card suits a thing handled as one (a plan, a product, a booking, a review) and may be soft with a quiet shadow; lists and rows read well split by hairlines, and rates, specifications and terms belong in a plain ruled table, not a row of cards; never a card inside a card. Why: a box should group, not decorate.

**L10. Few things per screen at 1440,** outside catalogues: a picture, a heading, a text block, an action, a figure. Why: eight to twelve small boxes on one screen read as noise.

**L11. Layers are an option, never a quota:** a picture crossing a section edge can add depth; figures drawn on a photograph suit any direction (`composure.md`, "Data on the picture"). Stack items on `grid-area: 1 / 1` with `z-index`; cross an edge with a negative `margin-block-start`. Whatever overlaps never covers text, a form, a price or the action (`covered-content`), and is recomposed at 390. Why: overlap that collides is a fault, not a style.

**L12. Pin annotations with anchor positioning, with a fallback:**

```css
.seam { anchor-name: --seam; }
.note { position: absolute; top: 40%; left: 60%; }             /* fallback */
@supports (position-area: top) {
  .note { position-anchor: --seam; position-area: top right; top: auto; left: auto; }
}
```

Why: the note follows its point at every width.

**L13. Editorial details are optional:** index numerals for real sequences only (`decimal-leading-zero`), label-size captions beside the picture's edge, corner details (edition, price, place). Why: they suit an editorial direction; numbered non-sequences are a tell.

## Sections

**L14. Choose sections from the data:** `deal.js directions` deals candidates; `deal.js show <id>` gives each one's generic and designed forms. Build the designed one; no two neighbours alike (`flow.md`). Why: the generic form is every template's.

## Navigation

**L15. Navigation:** corner (four corners); split (links, centred wordmark, utilities); rail (a fixed index that is also contents); full-screen menu (large type, two columns with contact, `popover` plus `@starting-style`); compact once stuck; a 32-40px announcement bar with real information. A small business shows name, phone or "open now", and book; a shop search, basket count, account; a product sign-in and the action. Links follow `craft.md`, "The header and the footer". Why: the header is part of the first screen.

**L17. At phone width change components, not only stacking:** grids become rails showing 15% of the next item; filters and menus become bottom sheets; overlaps are recomposed; `order` only where reading stays logical. Why: stacked desktop is long and flat.

## Widths

**L19. Use the width:** at 1440 and 1920 the page should not look like a small column in a large window (`narrow-content`); prose holds to 65ch, while pictures, grids and the first screen use the content or wide width. Any page may keep a narrow text column where a picture or a drawing gives the screen its shape. Why: narrow centred pages look unfinished on large screens.

**L20. Grids add columns on wide screens;** display type may keep scaling where the direction is type-led. Why: the screen fills, prose stays readable.

**L21. Above 2200px, cap `wide` at about 112rem** and let full-bleed pictures carry the edges. Why: objects 2500px apart stop relating.

## Modern CSS

**L22. Use these, with support as of late 2026:**

| Feature | Recipe | Support |
|---|---|---|
| Subgrid | `grid-template-rows: subgrid` | Baseline |
| Container queries | `@container (width > 40rem)`; `cqi` units for type | Baseline |
| `:has()` | `section:has(> figure:only-child)` | Baseline |
| Anchor positioning | L12 | Baseline since January 2026; Firefox lacks `anchor-center` |
| `@starting-style`, `popover`, `<dialog>` | entry animations, menus, basket drawer, checkout steps | Baseline |
| View transitions | `view-transition-name`; `@view-transition { navigation: auto }` | Chromium and Safari; progressive |
| Masonry | `display: grid-lanes` inside `@supports`, over `columns: 15rem` | Safari 26.4 only |
| `interpolate-size: allow-keywords` | height to `auto` on `details::details-content` | Chromium only; others jump, acceptable |
| Scroll-state queries | `container-type: scroll-state; @container scroll-state(stuck: top)` | Chromium only; IntersectionObserver fallback |

Snapping on horizontal rails only. Why: support decides the fallback.

## Shops and booking

**L24. Product page:** gallery at about 60% beside a sticky buy box at about 40% (`position: sticky; top: var(--header-h); align-self: start`); variants as buttons, out-of-stock crossed through but selectable; size guide inline; price, delivery date and returns beside the button. Why: Baymard rates most buy sections weak on these.

**L25. Basket and checkout:** a drawer (`popover`) with a free-delivery progress line and editable quantities; a single-column checkout without site navigation; filters in a side rail, a bottom sheet with applied count on phones. Why: each removes a step.

**L26. Subscription and booking:** a subscription is two choices with the saving in money; booking opens on a week strip with availability or price per day, from the next bookable slot. Why: visitors compare in money and days.

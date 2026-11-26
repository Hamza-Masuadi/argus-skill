# The page after the first screen

Contents: **Continuity** (one look, the ground, a thread, **Section variety**, the ending); **Density**; **The scroll test**.

For new Persuade and Read pages, opened at the section plan (`build.md`). The usual failure below the first screen is a run of look-alike bands that never refer back to it: every section heading left and paragraph right, half-empty rows, a thin strip for an ending. Calm is not empty. Grids and widths are in `layout.md`; the section habits in `composure.md`.

## Continuity

**One look all the way down.** The type, colours, spacing, picture treatment and motion of the first screen continue to the last; a section that looks borrowed from another site is rebuilt.

**The ground carries the thread.** Keep one ground the whole way down, or change it deliberately by chapter (a dark band for the proof, a tint for the prices). Check text contrast on every ground. Alternating plain and tint bands for no reason read as separate blocks.

The snippet `scroll-ground-shift.html` eases the ground from chapter to chapter.

**A thread.** One motif from the first screen runs through, in any kind of direction: a shape from the subject in drawings, rules and marks; the product photographed again in use; an object that changes state section by section (an order moving from placed to packed to sent).

**Section variety.** No two neighbouring sections share a layout. Name each section's layout in the section plan, from the dealt sections (`deal.js list sections`) or this list:

- full-bleed picture with text on its calm area
- a drawing made for the subject, labelled (`bespoke.md`)
- one object in several states
- oversized figure or numbered list
- picture cluster (three to five pictures of different sizes)
- horizontal gallery
- quote set large
- working device (the product or the kit object, live)
- table, index or price board, rows split by rules
- text beside a photograph
- sticky side with a scrolling list, where each step changes what is pinned

Each is one option, chosen for the content's shape (`ideas.md`, "The habit check"); none is the safe default. "Heading left, paragraph right" is used at most once on a page; a run of consistent ruled sections is fine when chosen.

**The ending.** The last screen is designed, not left over: it returns to the opening picture or motif, with the action and its reassurance line and the practical details (hours, address, contact). A thin strip is not an ending, nor is an enormous word on an empty screen. The practical footer (`craft.md`) sits inside or under it.

## Density

**Something to look at on every screen.** Look at the page at 1440 in screen-height slices. Each slice has something that holds the eye: a picture, the product, a figure, a quote set large, a dense well-set table. No stretch longer than about half a screen is a little text lost on an empty ground. Space around one strong thing is a choice; a half-empty screen is not.

**Few objects per screen.** Outside catalogues and listings, a desktop screen holds a few distinct things (a picture, a heading, a block of text, an action, a figure). Eight to twelve small boxed items in one screen read as a template grid; merge them into fewer, larger things, or a list split by rules.

**No empty column beside a short list.** Give the other column a picture, a figure or a review, or make the list full width. The questions block is the usual case.

**A sticky scene, where the steps really change what is pinned, ends when its steps end**, the most visible fault in real builds: the sticky parent is as tall as its steps, steps sit about 50-70vh apart, and the sticky object stays in view until the last step leaves. When a sticky card is shorter than the list beside it, it stays stuck for the whole list; when the list is shorter than the screen, the columns end together.

**Height follows content.** A panel fills the screen only when its one thing (a picture, a drawing) fills it; never `min-height: 100vh` for three lines on a plain ground. Tables and lists take their own height.

**Pictures continue down the page** where the picture decision is photographs or the product, at sizes where they stay sharp; with few good ones, use them large and set the rest type-led.

**Length on phones** follows `craft.md`, "Length". A sticky scene becomes stacked steps on phones.

## The scroll test

Run it on fresh full-page captures (`verify.md`) before the reviewer sees the page, at 1440 and 390. Scroll from top to bottom and answer in writing:

1. Does every screen look like the same site as the first?
2. Does any screen look like the one before it?
3. Is any half-screen empty, or does anything collide or cover text?
4. Is every picture sharp at the size shown?
5. Does each control answer the pointer (from the `--hover` captures)?
6. Does the last screen feel like an ending, returning to the opening, with the action?
7. Does each screen hold one thing, with a frame that does not compete (`composure.md`)?

Each weak answer joins the round's list, with its fix named from this file or `motion.md`.

**After each fix round, look again** at fresh `--scroll-frames` captures at 1440 and 390: fixes move things, and blank stretches survive them. The checker's `blank-band`, `repeated-layout` and `lopsided-section` prompts point at likely places; settle each by looking, and keep a deliberate one with its reason in the report.

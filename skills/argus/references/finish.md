# Finish: the last pass

For every page, business or showpiece, after the fix rounds and before the final look. Work in order; nothing cosmetic until the first four hold. Items marked **(checker)** are reported by `shot.js --check` as advisory prompts, named below; the rest need a look at a capture (say what you saw, not what you meant). It is a finish, not a style: add no meta labels, clocks or coordinates because an award site had them.

1. **Nothing left over (checker).** No lorem, TODO, `[placeholder]`, `example.com`, sample names, alt text like "image", or `#` links on real-looking things.
   - Reported as `placeholder-text`, `leftover-text`, `stock-names`, `dead-link`, `img-alt`. A needed stand-in stays only as the floor allows (`SKILL.md`, "Honest content").
2. **A name and a face (checker).** A real `<title>`, a meta description, a favicon in the brand's colours, a social card (`og:image`, `og:title`).
   - Reported as `page-basics`; open the icon and the card picture and look at them.
3. **Every state exists, in the palette.** Hover, focus-visible, pressed, disabled, empty, loading, error, success; no browser defaults, no colours outside the tokens.
   - Check: `--hover`, `--tap`, `--type` with an invalid then a valid value; Tab through at 1440.
4. **Designed edges.** The open menu at 390, the footer and the 404 belong with the hero. The footer closes the story (sign-off, the action again, useful links), not a link dump.
   - Check: `--tap` the menu at 390, `--full`, and capture the not-found page.
5. **Real typographic characters (checker).** Curly quotes and apostrophes, en dashes in ranges, real `×` and `…`, a non-breaking space between number and unit; `tabular-nums` on counters, prices, times and table columns.
   - Reported as `straight-quotes`, `price-figures`, `table-numbers`. Apostrophes, units and counters are by eye.
6. **Lines end well (checker).** `text-wrap: balance` on headings, `pretty` on body; no heading ends on one short word or breaks a hyphen.
   - Reported at 1280 and wider as `heading-widow`; look at each heading at 390 yourself.
7. **Optical alignment.** Large type is pulled in by its side bearing (about −0.03 to −0.06 em) so its stem lines up with the text below. Icons sit centred on the cap height of their label. An opening quote in a pull quote hangs outside the column.
   - Check: zoom the 1440 capture on each left edge and every icon-and-label pair.
8. **One motion vocabulary (checker, partly).** Two curves at most, one to arrive and one to move, as tokens (`motion.md`, M14); exits shorter than entrances; in a sequence the next step starts before the last ends.
   - Reported as `bare-easing` (the default `ease`, or `linear` outside scroll and steady loops). Overlap is read from the `--arrival` and `--scenes` contact sheets and the `--motion-metrics` flags.
9. **Motion has an origin** (`motion.md`, M18).
   - Check: `--hover` and `--tap` with `--frames 6 --every 60`; look at where each first frame starts.
10. **One stroke weight, one radius family (checker).** Icons, rules, borders and drawings share one stroke width and line cap; radii come from one small scale.
    - Reported at 1024 and wider as `radius-sprawl` and `border-sprawl`; icon strokes are by eye.
11. **Words in the page's voice.** Button labels say what happens; errors say what to do. The empty state, the 404, the loader text and the footer sign-off sound like the writer of the headline.
    - Check: read them aloud in the order a visitor meets them.
12. **The first and last screens belong together.** The footer answers the hero: the same type, the same accent, ideally the same idea brought to a close.
    - Check: the first capture and the last `--full` slice side by side.

Record what changed in `.argus/run.md`, under "Finish".

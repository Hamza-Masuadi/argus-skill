# Product UI: dashboards, tools, admin and app screens

For Operate surfaces: screens people work in, often daily. Almost everything written for landing pages is wrong here. There is no big move, nothing needs to be "alive", and the page is not an argument. The user already chose the product; the job is to let them see what matters and act on it fast. Quality here is clarity, density, accuracy and controls that behave.

This file is the whole route for a new Operate surface; `create.md` is not needed. On a native app, read `mobile.md` with it and take from this file only what applies to a phone screen: the user's questions, the direction, numbers and sample data. The sections on dense scale, tables and URLs are for desktop tools.

## Start from the user's questions

Write down the two or three questions this person opens the screen to answer, in their words, and let those order the screen. For most dashboards they are:

1. **Is everything all right?** The few numbers that say so, each with a comparison.
2. **What needs me?** Exceptions and things to act on, as a list that leads somewhere.
3. **What changed, and why?** Trends and breakdowns.
4. **Let me look something up.** The table.

The first screenful should answer the first two without scrolling. A wall of equal tiles answers none of them.

## The direction, for product UI

The direction contract still applies, with different lines:

```
Thesis:    who opens this, how often, and the questions they bring
Layout:    an ASCII wireframe of the main screen with the regions named
Character: the one thing that makes it this product's screen and not a template
           (a way of presenting the key figure, a distinctive structure, a voice)
Palette:   neutrals, one accent, status colours, a categorical set for data
Type:      one family with tabular figures; sizes for the dense scale below
Refuses:   two or three things it will not do
```

Compare alternatives as wireframes in the contract, not as rendered roughs: for a dense screen the choice is between structures, and three thumbnails of grey boxes tell you little. Render once the structure is chosen.

Character comes from structure and from how the main figure is presented, never from decoration. One distinctive idea is plenty.

Record the direction as `design-md.md` describes. When adding to an existing product, skip the direction altogether: `extend.md` governs and the existing screens are the direction.

## Dense scale

Density is a feature for daily users. `craft.md` has the dense column of numbers: 13-14px body, 12px minimum including inside charts, 32-40px table rows, 28-32px desktop controls, and 44px targets at phone widths. Keep the contrast floor at these sizes; small grey text on a tinted panel is the usual failure.

## Numbers

- Every figure has a comparison: previous period, target, or the same period last year. A number alone says little.
- State the period and whether it is complete. A partial day or month compared with a full one misleads; mark it.
- Right-align numbers in columns, with tabular figures, the same decimal places down a column, and units stated once in the header.
- Show change with a sign and a word or arrow as well as colour, and be careful which direction is good: churn going up is bad.
- Abbreviate consistently (12.4k, 1.2M) and give the exact value on hover or in the table.

## Sample data

A demo with numbers that do not add up looks fake at once.

- Make the data reconcile: parts sum to totals, the table agrees with the headline figures or is labelled as a sample of them, and trends are consistent with the current value.
- Use irregular, plausible values (12,847, not 12,000; 4.3%, not 5%) and realistic variety in names, dates and states.
- Include the awkward cases: a long name, a zero, a negative, a missing value, a failed payment.
- Say on screen that it is sample data.

## Charts

- Choose the chart by the question: change over time is a line; parts of a whole over time is a stacked area or bar; comparing categories is a bar, sorted; a single ratio is a number, not a gauge or a pie.
- Label directly where possible, in place of a separate legend. Axis labels at 12px minimum, few ticks, units stated.
- Start bar axes at zero. Line charts may zoom, with the range shown.
- Colour by meaning: one hue for a single series; a small categorical set for distinct series, used the same way everywhere on the screen; a single-hue ramp for ordered values (a heat map). Never rely on red and green alone.
- Give charts a hover or focus readout with exact values, a text summary for screen readers, and a sensible state when there is no data.
- Check for labels that collide or clip at every width. The checker cannot see inside drawn charts, so look.
- Remove gridlines, borders and effects that carry no information.

## Tables

A filterable table is a small application. It needs:

- Sorting on the columns people sort by, with the current sort shown.
- Search and filters whose current state is always visible and removable, with a count of results.
- An empty state for "no results" that names the filter and offers to clear it, distinct from "no data yet".
- Paging or virtual scrolling with the total shown; keep the header visible while scrolling.
- The identifying column always visible; less important columns hidden first on narrow screens, and no text left referring to a hidden column.
- Row actions in a consistent place; bulk selection only if there is something to do in bulk.
- Filter, sort and page reflected in the URL, so a view can be bookmarked and the back button works.
- Status as a word with a dot or icon, never colour alone.

## Controls and structure

- Use standard controls for standard jobs. Originality in how a date range picker works is a cost to the user.
- One primary action per screen at most; many dashboards have none, and that is fine.
- Navigation stays in one place and always shows where you are.
- Things that need attention are links: each one goes to the place where it can be dealt with, or filters the table to it.
- Prefer inline editing, expandable rows and side panels to modal dialogs.
- Keyboard: everything reachable by Tab, a visible focus ring, and shortcuts for the frequent actions if the tool is used all day.

## Settings and account pages

These are forms and facts, not dashboards. The chart and comparison rules above do not apply.

- Show the current state first, plainly: what plan, what it costs, when it renews, what is on file. Then the controls that change it.
- Group by what the user thinks of as one thing (plan, payment, people, danger), each with its own heading and its own save.
- Edit in place: a row that turns into a small form, with Save and Cancel beside it. Say what changed once it is saved.
- Destructive actions sit apart, at the end, in the danger style. Before confirming, state exactly what happens and when: what is lost, what is kept, the date it takes effect, and whether it can be undone. Offer the way back afterwards if there is one.
- Money is exact: currency, tax shown separately, the next charge and its date. After a change, every figure that depends on it is recalculated or removed; a sum that no longer adds up is worse than no sum.
- A change the user made stays made. After a reload the page shows the new state, even in a demo with no server (keep it in the browser's storage). A cancellation that silently disappears is worse than none. If something truly is not saved, say so beside every control it applies to, not only one.
- Confirm a change where the user is looking: visible text beside the thing that changed, not only an announcement for screen readers.
- History (invoices, activity) is a table, following the table rules above.

## States to capture

A product screen is not checked until it has been seen in each state it can be in. Capture all that apply, not only the full, happy one:

- **Loading**, and what stays on screen while it loads.
- **Empty**: no data yet, with the first action offered.
- **Error**: the request failed; what is said and how to retry.
- **Populated**: the normal case.
- **Edge data**: a 200-character name, a zero, a negative, a seven-digit number, one row, a thousand rows.

If a state cannot be reached in the build, say so in the report instead of assuming it works.

## Motion

Feedback only. Values that change may transition briefly so the eye can follow. Nothing animates on load, and nothing loops.

## Narrow screens

Decide how far the phone layout needs to go from who uses it. A desk tool opened daily on a laptop needs a phone view that works for a quick check: the key figures, the exceptions, a simplified table. It does not need every chart reflowed perfectly. Say in the report which you built. Whatever is shown must still be correct: no sideways scroll, no clipped controls, 44px targets.

## Slips specific to product UI

- A grid of equal tiles with nothing ranked.
- Figures without comparisons, or with a comparison whose direction is ambiguous.
- Data that does not reconcile.
- Chart text under 12px, or labels overlapping at narrow widths.
- Filters that reset on reload, or whose active state cannot be seen.
- A beautiful first screen with a table nobody could actually use.
- Landing-page habits: oversized headings, hero spacing, decorative illustration, entrance animation.

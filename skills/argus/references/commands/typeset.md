# typeset

Fix the typography of a screen. Type is most of what a user sees, so this is usually the highest-return change available.

Read `craft.md` for the numbers. In an existing system, use its families and scale; this command then only fixes how they are applied.

## Diagnose first

List every distinct combination of family, size, weight, colour and line height in use. Most screens that feel messy have twelve or more; most good ones have five to seven. The list itself usually shows the problem.

## Fix in this order

1. **Roles.** Name the roles the screen needs: display, heading, subheading, body, small/caption, and data if there are numbers. Map every piece of text to one role. Anything left over is deleted or merged.
2. **Scale.** Give each role one size. Make neighbouring levels clearly different (at least about 1.2x), because two sizes that almost match look like a mistake.
3. **Weight and colour.** Use at most three weights. Secondary text is quieter by colour, not by being tiny. Check the contrast of that quieter colour.
4. **Measure and leading.** Body text 45-75 characters per line. Line height looser for long text and small sizes, tighter for large headings.
5. **Rhythm.** Space above a heading is larger than space below it. Paragraph spacing is consistent.
6. **Details.** Tabular figures for numbers that line up. Real quotation marks and apostrophes. No widows in headings. Left-align long text; centre only short display lines.

## Choosing a typeface (new work only)

- Start from the subject and the surface, not from what is fashionable. A tool people read all day wants a sturdy, neutral text face. A brand page can carry a display face with character.
- One family with enough weights is often sufficient. Add a second only for a clear job.
- Check the face has the weights, figures and language support the content needs before committing.
- The platform's system font, used deliberately, is a legitimate choice for product UI and the default for mobile apps.

## Report

Before and after: the count of distinct text styles, the role table with sizes, and any typeface change with its reason.

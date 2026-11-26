// Generated from src/scripts/rules.ts by `npm run build`. Edit the TypeScript, not this file.
"use strict";
/*
 * Argus rule catalogue. Every rule the in-page checker (check.js) and the
 * source scan (lint.js) can report, with its most serious severity, what it
 * looks for, and where the rule comes from. `argus-skill rules` prints it, and
 * so does running this file directly: `node rules.js [--json]`. Importing it
 * prints nothing.
 * A unit test fails when a rule id is used in either tool but missing here,
 * or listed here but no longer used.
 *
 * Severity: P0 broken, P1 excludes or confuses users, P2 visible roughness,
 * P3 minor polish or a prompt to confirm a choice, "tell" = a common
 * generated-design default; judge whether it was chosen. A rule that can
 * report at two levels lists the more serious one.
 *
 * Tier: "floor" rules are never waived, in any style (every P0 and P1 rule, and
 * text under 12px): fix them, or show the finding is a false alarm. "advisory"
 * rules (P2, P3, tell) are prompts to look; keep what was chosen, with a reason.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULES = exports.FLOOR_EXTRA = void 0;
exports.rulesByTool = rulesByTool;
exports.formatRules = formatRules;
exports.main = main;
/** Rules below P1 that are still never waived: text too small to read. */
exports.FLOOR_EXTRA = ['small-text'];
const tierOf = (id, severity) => (severity === 'P0' || severity === 'P1' || exports.FLOOR_EXTRA.includes(id) ? 'floor' : 'advisory');
const check = (id, severity, summary, basis = 'Argus') => ({ id, tool: 'check', severity, summary, basis, tier: tierOf(id, severity) });
const lint = (id, severity, summary, basis = 'Argus') => ({ id, tool: 'lint', severity, summary, basis, tier: tierOf(id, severity) });
exports.RULES = [
    // ---- check: the rendered page ----------------------------------------------
    // Text and contrast
    check('contrast', 'P0', 'Text contrast below 4.5:1 (3:1 for large text); under 3:1 is P0.', 'WCAG 2.2 1.4.3'),
    check('contrast-uncertain', 'P2', 'Low contrast measured for positioned text whose real background may differ; confirm by eye.', 'WCAG 2.2 1.4.3'),
    check('small-text', 'P2', 'Text smaller than 12px.'),
    check('gradient-text', 'tell', 'Text filled with a gradient or image (background-clip: text).'),
    check('clipped-text', 'P1', 'Text cut off by hidden overflow with no ellipsis.'),
    check('text-collision', 'P1', 'On the first screen, text whose lines run into other text, or text laid over a solid drawn line (an SVG stroke), at any width.'),
    check('truncated-no-title', 'P3', 'Text cut off with an ellipsis and no title or aria-label carrying the full text.'),
    check('line-length', 'P2', 'Paragraphs with more than about 90 characters per line.'),
    check('body-line-height', 'P3', 'Long paragraphs with a line height under 1.3 or over 2 times the text size.'),
    check('justified-text', 'P3', 'Justified blocks of more than about 200 characters.'),
    check('caps-tracking', 'P2', 'All-caps text at 20px or smaller with no letter-spacing.'),
    check('font-families', 'P3', 'More than two font families carrying visible text; code samples and a logo in its own face do not count.'),
    check('thin-body-text', 'P2', 'A meaningful share of body-size text set at weight 300 or lighter.'),
    check('timid-headline', 'P2', 'At 1280px and wider, a first-screen headline under 2.2 times the body size, or an h1 no larger than an h2 unless the h1 is itself four times the body; product UI (tables, forms, steps, grids, tabs, one-screen phone views) is exempt.'),
    check('raw-values', 'P1', 'Visible "undefined", "NaN", "null" or "[object Object]" where a value should be.', 'Argus'),
    check('placeholder-text', 'P1', 'Lorem ipsum placeholder text is visible.', 'Argus'),
    check('filler-words', 'tell', 'Marketing filler words such as "seamless" or "unlock".'),
    check('stock-names', 'tell', 'Stock placeholder names such as John Doe or Acme.'),
    check('emoji-icon', 'tell', 'Emoji used in a heading, control or list item.'),
    check('eyebrow', 'P3', 'A small all-caps label above a heading, unless it is one of a set of repeated markings or a short code with a digit (tell); once per page at P3 when a small all-caps, letter-spaced or monospace label sits above most section headings.', 'Argus faults.md'),
    check('numbered-grid', 'P3', 'Three or more equal cards side by side, each led by a number counting them (01, 02, 03), the familiar numbered feature grid.', 'Argus faults.md'),
    // Layout
    check('page-overflow', 'P0', 'The page scrolls sideways at the current width.', 'WCAG 2.2 1.4.10'),
    check('overflow-source', 'P0', 'An element that extends past the viewport and causes sideways scrolling.', 'WCAG 2.2 1.4.10'),
    check('collapsed-column', 'P0', 'A text block squeezed so narrow that it breaks to about a word per line.', 'Argus'),
    check('page-length', 'P2', 'A page more than fourteen screens tall at 390 (more than sixteen 700px screens at 320).', 'Argus'),
    check('section-length', 'P2', 'At 390, one section more than about 2.5 screens tall, so it carries several messages; product UI and long articles are exempt.', 'Argus'),
    check('narrow-content', 'P3', 'At 1280px and wider, all content held in a column under 62% of the width; a prompt to look, fine for a reading page.', 'Argus'),
    check('fixed-cover', 'P2', 'At 480px or narrower, fixed and sticky bars cover more than a quarter of the screen height.', 'Argus'),
    // Flow: how the page reads below the first screen, at 1024px and wider; skipped with --app
    check('blank-band', 'P3', 'At 1024px and wider, judged screen by screen as a visitor scrolls (through shot.js; sticky and pinned content counts where it is stuck): a stretch at least half a screen tall where content covers under 12% of the text column, nothing at all for 240px on one ground where a sticky scene runs or for 40% of a screen anywhere, or a sticky block that fills under half the screen and leaves its column bare under it; or three or more empty gaps of 240px or more between blocks. A prompt to look: fine for a deliberate panel whose one strong thing has room. The header and the last 200px are left out, and a type line of 96px or more counts as content.', 'Argus flow.md'),
    check('lopsided-section', 'P3', 'At 1024px and wider, a section or a block in one, 300px or taller, whose left or right 45% is empty for 75% of its height or covered under 5% (or under 12% beside a side five times fuller); blocks with a sticky column (filled over its whole scroll range) and centred columns are left alone, a column beside another is judged with its row, and content capped by a centred max-width container is judged within that width. A prompt to look.', 'Argus flow.md'),
    check('repeated-layout', 'P3', 'At 1024px and wider, three or more sections in a row with one layout (columns, heading side, picture side, column widths within 8 points), or one layout used by four or more sections that are at least 40% of the page. A prompt to look: fine for a page of consistent ruled sections.', 'Argus flow.md'),
    check('near-miss-alignment', 'P3', 'Section blocks whose left edge is 1 to 6px off the common edge; a prompt to confirm, not a failure.'),
    // First screen
    check('competing-actions', 'P2', 'More than two different filled actions of the same colour on the first screen; repeats of one action (same name or destination) and a set of app-store badges count once, and skip links do not count.', 'Argus'),
    check('first-screen-no-action', 'P2', 'No button or button-styled link on the first screen; product UI (as for timid-headline) and long articles are exempt.', 'Argus'),
    check('covered-content', 'P1', 'On the first screen, a positioned element (absolute, fixed or sticky) or an endlessly animated one (a marquee) painted over a form control, a price or a line of text; full-width bars held to the top or bottom edge are left to fixed-cover.', 'Argus first-screen.md'),
    check('blank-canvas', 'P1', 'A canvas laid over a picture (a WebGL layer) that captures as one flat colour where the picture is (shot.js --check only).', 'Argus showpiece.md'),
    check('first-screen-nothing-large', 'P3', 'At 1280px and wider, no picture covering 15% of the first screen and no text of 44px or more; product UI is exempt.', 'Argus'),
    // Buttons and pictures, prompts to confirm a choice
    check('button-styles', 'P3', 'Filled buttons of one colour that differ in height by more than 8px or in corner shape, or filled buttons in more than one strong colour; product UI is exempt.'),
    check('primary-button-height', 'P3', 'At 1024px and wider, the primary filled button under 32px or over 64px tall, against guidance of about 40-48px; product UI is exempt.'),
    check('mixed-pictures', 'P3', 'Photographs and a large drawn illustration (an SVG image, or an inline SVG scene of many shapes) on one page; a heuristic prompt that leaves charts, maps and logos out.'),
    // Colour, prompts to confirm a choice
    check('colour-flood', 'P3', 'One saturated colour is the background of more than 55% of the first screen; a prompt to confirm.', 'Argus'),
    check('many-hues', 'P3', 'More than three saturated hue families in use across visible elements; a prompt to confirm.'),
    check('pure-black-white', 'P3', 'The main text is pure black on pure white, or the reverse; a prompt to confirm.'),
    // Controls, names and labels
    check('target-size', 'P1', 'Pressable targets under 24px, or under 44px on touch-sized viewports.', 'WCAG 2.2 2.5.8'),
    check('no-name', 'P1', 'A button or link with no accessible name.', 'WCAG 2.2 4.1.2'),
    check('link-text-generic', 'P3', 'A link or button named only "click here", "read more" or similar.', 'WCAG 2.2 2.4.4'),
    check('link-colour-only', 'P3', 'A link in running text told apart only by a colour under 3:1 against the text around it.', 'WCAG 2.2 1.4.1'),
    check('clickable-not-control', 'P2', 'An element with a pointer cursor or onclick that is not a button, link or other control.', 'WCAG 2.2 2.1.1'),
    check('dead-link', 'P2', 'A link to "#" or an empty address.'),
    check('missing-anchor', 'P2', 'A same-page link to "#id" where nothing on the page has that id; "#top", script routes and tab or toggle links are skipped.'),
    check('focus-removed', 'P1', 'Nothing visible changes when a control takes keyboard focus (first 40 controls).', 'WCAG 2.2 2.4.7'),
    check('focus-obscured', 'P2', 'A focused control hidden behind a fixed or sticky element.', 'WCAG 2.2 2.4.11'),
    // Forms
    check('no-label', 'P1', 'A form field with no label at all.', 'WCAG 2.2 3.3.2'),
    check('hidden-label', 'P2', 'A form field named only for screen readers, with no visible label.', 'WCAG 2.2 3.3.2'),
    check('input-zoom', 'P2', 'At phone width, field text under 16px, which makes an iPhone zoom the page.', 'Argus'),
    check('autocomplete-missing', 'P3', 'An email, name, phone, address, postcode, card or password field with no autocomplete attribute.', 'WCAG 2.2 1.3.5'),
    check('input-type', 'P3', 'An email, phone or web address field using type="text" with no inputmode.'),
    check('error-not-linked', 'P2', 'An invalid field or an error message that is not linked to its field.', 'WCAG 2.2 3.3.1'),
    check('required-unmarked', 'P3', 'A required field whose label shows no marker, in a form that does not mark optional fields instead.', 'WCAG 2.2 3.3.2'),
    check('form-mailto', 'P1', 'A form that submits to a mailto: address.', 'Argus'),
    // Images and charts
    check('img-alt', 'P1', 'An image with no alt attribute (P1), or alt text that is a file name or a generic word (P3).', 'WCAG 2.2 1.1.1'),
    check('image-no-size', 'P3', 'An image with no width and height attributes and no aspect-ratio, which shifts the layout as it loads.', 'Web Vitals'),
    check('image-oversized', 'P3', 'An image file more than 2.5 times wider than it is shown, allowing for screen density.'),
    check('chart-unnamed', 'P3', 'A chart drawn in SVG or canvas with no accessible name.', 'WCAG 2.2 1.1.1'),
    // Tables
    check('table-headers', 'P2', 'A data table of more than two rows and two columns with no header cells.', 'WCAG 2.2 1.3.1'),
    check('table-numbers', 'P3', 'A numeric table column that is not right-aligned or not set in tabular figures.'),
    // Page structure
    check('h1-count', 'P2', 'A page with no h1 or more than one.'),
    check('heading-skip', 'P2', 'Heading levels that skip, such as h2 to h4.'),
    check('viewport-meta', 'P0', 'No viewport meta tag.'),
    check('zoom-blocked', 'P1', 'A viewport tag that disables zoom or sets maximum-scale below 2.', 'WCAG 2.2 1.4.4'),
    check('lang', 'P2', 'The html element has no lang attribute.', 'WCAG 2.2 3.1.1'),
    check('page-basics', 'P2', 'No title or main landmark (P2); no meta description, icon or og:image (P3).', 'WCAG 2.2 2.4.2 and Argus'),
    // Motion
    check('reduced-motion', 'P1', 'The page animates by itself but has no prefers-reduced-motion rule.'),
    check('motionless-page', 'P2', 'Nothing moves outside prefers-reduced-motion: no animation, scroll-driven effect or transition beyond a colour change; exempt when <html data-argus-motion="still"> records that the owner chose no motion.', 'Argus motion.md'),
    check('no-pause', 'P1', 'Animation that loops forever with no pause or stop control.', 'WCAG 2.2 2.2.2'),
    check('hero-video', 'P1', 'A large video that plays by itself with sound on, or moving for more than five seconds with no pause control (P1); or with no playsinline or no poster (P2).', 'WCAG 2.2 2.2.2 and Argus pictures.md'),
    check('video-heavy', 'P3', 'A video file over 4 MB, where the browser reports the bytes it fetched.', 'Argus pictures.md'),
    check('slow-transition', 'P3', 'A transition over 600ms on a control, or "all" transitioned on more than three controls.'),
    // Design: faults of finish that hold whatever the style. Skipped with --app; most also skip
    // product UI unless the first screen is led by display type.
    check('type-untokened-sizes', 'P3', 'At 1024px and wider, sizes not drawn from a few roles: more than two heading sizes, or more than four text sizes, between about 28 and 72px (scaled from 1440), or more than twelve rendered sizes in all; sizes within 8% count as one, and tables, mock-ups (data-mock, role="img") and the header are left out.', 'Argus type.md'),
    check('type-small-body', 'P3', 'More than a quarter of the running text (paragraphs and list items of 120 characters or more that wrap) set under 16px; footers, forms, captions and mock-ups are left out.', 'Argus type.md'),
    check('type-twin-faces', 'P3', 'A display face and a body face of the same class (two sans-serifs or two serifs, by a built-in table of common web faces) whose glyphs drawn on a canvas are within 12% in width per em, with no width-axis contrast; reported only when both faces are loaded.', 'Argus type.md'),
    check('radius-sprawl', 'P3', 'More than three corner radii in repeated use (pills and circles counted apart).', 'Argus colour.md'),
    check('hero-crowded', 'P3', 'At 1280px and wider, more than seven separate groups of content on the first screen (text blocks, pictures and controls more than 14px apart; a form, or the one card holding it, counts as one). About five designed groups measure up to seven, so seven is the line.', 'Argus first-screen.md'),
    check('hero-wordy', 'P3', 'At 1280px and wider, more than 110 words of visible text on the first screen; the header, aria-hidden content, text in SVG drawings, charts and mock-ups, and a list, table or board that is itself the hero are left out.', 'Argus composure.md'),
    // The finishing pass: cheap prompts for what a last look catches (finish.md). Each reports once a page.
    check('leftover-text', 'P3', 'Working text left in visible copy: TODO, TBD, a bracketed placeholder, or an example.com address or link.', 'Argus finish.md'),
    check('straight-quotes', 'P3', 'Straight double quotes, a spaced hyphen or a double hyphen in visible running copy (code, inputs and mock-ups left out).', 'Argus finish.md'),
    check('price-figures', 'P3', 'A price set on its own (outside a table) in proportional figures, with no tabular-nums.', 'Argus finish.md'),
    check('heading-widow', 'P3', 'At 1280px and wider, an h1 to h3 of four words or more whose last line is one word of six letters or fewer.', 'Argus finish.md'),
    check('bare-easing', 'P3', 'A transition or animation on the default ease, or on linear when it is neither tied to scroll nor a steady endless loop.', 'Argus finish.md'),
    check('border-sprawl', 'P3', 'At 1024px and wider, more than three border widths in repeated use.', 'Argus finish.md'),
    check('scroll-reveals', 'tell', 'More than six elements set up to animate in on scroll, all with the same computed reveal and no stagger (delays and per-element custom properties such as --i count as a stagger).'),
    // ---- lint: source files ----------------------------------------------------
    lint('small-text', 'P2', 'A font-size under 12px in px or rem.'),
    lint('caps-tracking', 'P2', 'Uppercase text at 20px or smaller with no letter-spacing in the same rule.'),
    lint('tight-tracking', 'P2', 'Letter-spacing tighter than -0.04em, or tighter than -0.05em where the same rule sets a font-size of 96px or more (a clamp\'s maximum counts).', 'Argus type.md'),
    lint('all-caps-labels', 'tell', 'More than six rules that set text to uppercase.'),
    lint('gradient-text', 'tell', 'Text filled with a background (background-clip: text).'),
    lint('raw-colours', 'P2', 'More than twelve colours written out directly instead of as tokens.'),
    lint('viewport-meta', 'P1', 'An HTML page with no viewport meta tag.'),
    lint('zoom-blocked', 'P1', 'A viewport tag that disables zoom or sets maximum-scale below 2.', 'WCAG 2.2 1.4.4'),
    lint('safe-area-missing', 'P2', 'viewport-fit=cover with no env(safe-area-inset-*) anywhere in the files checked.'),
    lint('vh-units', 'P2', '100vh on height or min-height in a file that never uses dvh or svh.'),
    lint('lang', 'P2', 'The html element has no lang attribute.', 'WCAG 2.2 3.1.1'),
    lint('h1-count', 'P2', 'An HTML page with more than one h1, or headings but no h1.'),
    lint('img-alt', 'P1', 'An img tag with no alt attribute.', 'WCAG 2.2 1.1.1'),
    lint('image-no-size', 'P3', 'An img tag with no width and height attributes.', 'Web Vitals'),
    lint('placeholder-label', 'P1', 'A field with a placeholder and no label that names it.', 'WCAG 2.2 3.3.2'),
    lint('control-in-heading', 'P2', 'A select, button or input inside a heading with no accessible name of its own.'),
    lint('form-mailto', 'P1', 'A form that submits to a mailto: address.', 'Argus'),
    lint('form-endpoint', 'P2', 'A form that posts to an address that should be confirmed to exist.', 'Argus'),
    lint('clickable-div', 'P2', 'A div or span with a click handler and no role.', 'WCAG 2.2 2.1.1'),
    lint('tabindex-positive', 'P2', 'A tabindex above zero, which reorders keyboard focus.', 'WCAG 2.2 2.4.3'),
    lint('paste-blocked', 'P1', 'A paste handler that prevents pasting.', 'WCAG 2.2 3.3.8'),
    lint('focus-removed', 'P1', 'outline: none or 0 with no replacement in the same rule and no visible focus style anywhere in the files.', 'WCAG 2.2 2.4.7'),
    lint('reduced-motion', 'P1', 'Keyframe animation with no prefers-reduced-motion rule anywhere in the files.'),
    lint('infinite-animation', 'P2', 'An animation set to loop forever.', 'WCAG 2.2 2.2.2'),
    lint('hero-video', 'P1', 'A video with autoplay and no muted (P1); or no playsinline, no poster, or no pause control in the file (P2).', 'WCAG 2.2 2.2.2 and Argus pictures.md'),
    lint('video-heavy', 'P3', 'A local video file referenced by a video or source tag that is over 4 MB.', 'Argus pictures.md'),
    lint('transition-all', 'P2', '"transition: all", which also animates layout properties.'),
    lint('font-display-missing', 'P3', 'An @font-face rule with no font-display.'),
    lint('placeholder-text', 'P1', 'Lorem ipsum anywhere (P1), or TODO or "placeholder text" in visible text (P2).', 'Argus'),
    lint('stock-names', 'tell', 'Stock placeholder names such as John Doe or Acme.'),
    lint('filler-words', 'tell', 'Marketing filler words in an HTML page.'),
    lint('emoji', 'tell', 'Emoji in the visible text of an HTML page.'),
];
/** Rules grouped by tool, in catalogue order. */
function rulesByTool() {
    return { check: exports.RULES.filter((r) => r.tool === 'check'), lint: exports.RULES.filter((r) => r.tool === 'lint') };
}
/** The catalogue as text, grouped by tool, or as JSON. */
function formatRules(rules = exports.RULES, json = false) {
    if (json)
        return JSON.stringify(rules, null, 2);
    const lines = [];
    const tools = [
        ['check', 'check: measured in the rendered page'],
        ['lint', 'lint: read from source files'],
    ];
    for (const [tool, title] of tools) {
        const list = rules.filter((r) => r.tool === tool);
        lines.push(`${title} (${list.length} rules)`);
        for (const r of list)
            lines.push(`  ${r.severity.padEnd(4)} ${(r.tier === 'floor' ? 'floor' : '').padEnd(5)} ${r.id.padEnd(28)} ${r.summary}  [${r.basis}]`);
        lines.push('');
    }
    const floor = rules.filter((r) => r.tier === 'floor').length;
    lines.push(`${rules.length} rules in all: ${floor} floor rules (marked "floor": never waived, in any style) and ${rules.length - floor} advisory (prompts to look; keep a choice with its reason). Severity is the most serious level a rule reports.`);
    return lines.join('\n');
}
/**
 * Print the catalogue for a command line: `--json` for JSON, `--help` for usage.
 * `command` is how the usage line names the command. Returns the exit code.
 */
function main(argv, command = 'node rules.js') {
    const wantsHelp = argv.some((a) => a === '--help' || a === '-h');
    const extra = argv.filter((a) => a !== '--json');
    if (wantsHelp || extra.length) {
        console.log(`Usage: ${command} [--json]`);
        console.log('Lists every rule the checker and the source scan apply, with severity and basis.');
        return wantsHelp ? 0 : 1;
    }
    console.log(formatRules(exports.RULES, argv.includes('--json')));
    return 0;
}
// Run directly (`node rules.js`), print the catalogue; imported, do nothing.
if (require.main === module)
    process.exitCode = main(process.argv.slice(2));

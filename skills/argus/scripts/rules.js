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
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULES = void 0;
exports.rulesByTool = rulesByTool;
exports.formatRules = formatRules;
exports.main = main;
const check = (id, severity, summary, basis = 'Argus') => ({ id, tool: 'check', severity, summary, basis });
const lint = (id, severity, summary, basis = 'Argus') => ({ id, tool: 'lint', severity, summary, basis });
exports.RULES = [
    // ---- check: the rendered page ----------------------------------------------
    // Text and contrast
    check('contrast', 'P0', 'Text contrast below 4.5:1 (3:1 for large text); under 3:1 is P0.', 'WCAG 2.2 1.4.3'),
    check('contrast-uncertain', 'P2', 'Low contrast measured for positioned text whose real background may differ; confirm by eye.', 'WCAG 2.2 1.4.3'),
    check('small-text', 'P2', 'Text smaller than 12px.'),
    check('gradient-text', 'tell', 'Text filled with a gradient or image (background-clip: text).'),
    check('clipped-text', 'P1', 'Text cut off by hidden overflow with no ellipsis.'),
    check('truncated-no-title', 'P3', 'Text cut off with an ellipsis and no title or aria-label carrying the full text.'),
    check('line-length', 'P2', 'Paragraphs with more than about 90 characters per line.'),
    check('body-line-height', 'P3', 'Long paragraphs with a line height under 1.3 or over 2 times the text size.'),
    check('justified-text', 'P3', 'Justified blocks of more than about 200 characters.'),
    check('caps-tracking', 'P2', 'All-caps text at 20px or smaller with no letter-spacing.'),
    check('many-type-sizes', 'P2', 'More than twelve different text sizes on one page; text inside product mock-ups (data-mock, role="img", aria-hidden) is left out.'),
    check('font-families', 'P3', 'More than two font families carrying visible text; code samples and a logo in its own face do not count.'),
    check('thin-body-text', 'P2', 'A meaningful share of body-size text set at weight 300 or lighter.'),
    check('timid-headline', 'P2', 'At 1280px and wider, a first-screen headline under 2.2 times the body size, or an h1 no larger than an h2; product UI (tables, forms, steps, grids, tabs, one-screen phone views) is exempt.'),
    check('raw-values', 'P1', 'Visible "undefined", "NaN", "null" or "[object Object]" where a value should be.', 'Argus'),
    check('placeholder-text', 'P1', 'Lorem ipsum placeholder text is visible.', 'Argus'),
    check('filler-words', 'tell', 'Marketing filler words such as "seamless" or "unlock".'),
    check('stock-names', 'tell', 'Stock placeholder names such as John Doe or Acme.'),
    check('emoji-icon', 'tell', 'Emoji used in a heading, control or list item.'),
    check('eyebrow', 'tell', 'A small all-caps label above a heading, unless it is one of a set of repeated markings or a short code with a digit.'),
    // Layout
    check('page-overflow', 'P0', 'The page scrolls sideways at the current width.', 'WCAG 2.2 1.4.10'),
    check('overflow-source', 'P0', 'An element that extends past the viewport and causes sideways scrolling.', 'WCAG 2.2 1.4.10'),
    check('collapsed-column', 'P0', 'A text block squeezed so narrow that it breaks to about a word per line.', 'Argus'),
    check('page-length', 'P2', 'A page more than fourteen screens tall at 390 (more than sixteen 700px screens at 320).', 'Argus'),
    check('section-length', 'P2', 'At 390, one section more than about 2.5 screens tall, so it carries several messages; product UI and long articles are exempt.', 'Argus'),
    check('narrow-content', 'P2', 'At 1280px and wider, all content held in a column under 62% of the width.', 'Argus'),
    check('fixed-cover', 'P2', 'At 480px or narrower, fixed and sticky bars cover more than a quarter of the screen height.', 'Argus'),
    check('near-miss-alignment', 'P3', 'Section blocks whose left edge is 1 to 6px off the common edge; a prompt to confirm, not a failure.'),
    // First screen
    check('competing-actions', 'P2', 'More than two different filled actions of the same colour on the first screen; repeats of one action (same name or destination) and a set of app-store badges count once, and skip links do not count.', 'Argus'),
    check('first-screen-no-action', 'P2', 'No button or button-styled link on the first screen; product UI (as for timid-headline) and long articles are exempt.', 'Argus'),
    check('first-screen-nothing-large', 'P3', 'At 1280px and wider, no picture covering 15% of the first screen and no text of 56px or more; product UI is exempt.', 'Argus'),
    // Buttons and pictures, prompts to confirm a choice
    check('button-styles', 'P3', 'Filled buttons of one colour that differ in height by more than 8px or in corner shape, or filled buttons in more than one strong colour; product UI is exempt.'),
    check('primary-button-height', 'P3', 'At 1024px and wider, the primary filled button under 32px or over 64px tall, against guidance of about 40-48px; product UI is exempt.'),
    check('mixed-pictures', 'P3', 'Photographs and a large drawn illustration (an SVG image, or an inline SVG scene of many shapes) on one page; a heuristic prompt that leaves charts, maps and logos out.'),
    // Colour, prompts to confirm a choice
    check('colour-flood', 'P3', 'One saturated colour is the background of more than 55% of the first screen; a prompt to confirm.', 'Argus'),
    check('warm-default-ground', 'P3', 'The main ground is yellow, cream, beige or amber; a prompt to confirm it came from the subject.', 'Argus'),
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
    check('page-basics', 'P2', 'No title or main landmark (P2); no meta description or icon (P3).', 'WCAG 2.2 2.4.2 and Argus'),
    // Motion
    check('reduced-motion', 'P1', 'The page animates by itself but has no prefers-reduced-motion rule.'),
    check('no-pause', 'P1', 'Animation that loops forever with no pause or stop control.', 'WCAG 2.2 2.2.2'),
    check('slow-transition', 'P3', 'A transition over 600ms on a control, or "all" transitioned on more than three controls.'),
    check('scroll-reveals', 'tell', 'More than six elements set up to animate in on scroll, all with the same computed reveal and no stagger (delays and per-element custom properties such as --i count as a stagger).'),
    // ---- lint: source files ----------------------------------------------------
    lint('small-text', 'P2', 'A font-size under 12px in px or rem.'),
    lint('caps-tracking', 'P2', 'Uppercase text at 20px or smaller with no letter-spacing in the same rule.'),
    lint('tight-tracking', 'P2', 'Letter-spacing tighter than -0.04em.'),
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
            lines.push(`  ${r.severity.padEnd(4)} ${r.id.padEnd(28)} ${r.summary}  [${r.basis}]`);
        lines.push('');
    }
    lines.push(`${rules.length} rules in all. Severity is the most serious level a rule reports. Colour, button and picture rules and near-miss-alignment are prompts to confirm, not failures.`);
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

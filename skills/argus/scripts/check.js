// Generated from src/scripts/check.ts by `npm run build`. Edit the TypeScript, not this file.
"use strict";
/*
 * Argus checker. Runs inside a rendered page and returns measured findings.
 * Evaluate the compiled file's text in the page: `argus-skill check <url>` does
 * that for you, or use a browser tool's script call, Playwright's page.evaluate,
 * or the devtools console. It reads the page and changes nothing that lasts: the
 * focus checks move keyboard focus for a moment (without scrolling), then restore
 * the focused element and the scroll position of the window and of any container.
 * Run it before, not during, an interaction driven by hand.
 *
 * Returns { url, viewport, summary, countsByRule, findings, notes }.
 * Severity: P0 broken, P1 excludes or confuses users, P2 visible roughness,
 * P3 minor polish or a prompt to confirm a choice,
 * "tell" = a common generated-design default; judge whether it was chosen.
 * The rule catalogue (`argus-skill rules`) lists every rule id used here.
 *
 * This file has no imports or exports on purpose: it must compile to a single
 * expression whose value is the result.
 */
(function argusCheck() {
    // Run directly under Node (`node check.js`, `--help`), there is no page: say how to run it, and exit 0.
    if (typeof document === 'undefined') {
        console.log('check.js runs inside a rendered page, not on its own: use `node shot.js <url-or-file> --check` or `argus-skill check <url-or-file>`, or evaluate its text in the page with a browser tool.');
        return null;
    }
    const MAX_PER_RULE = 6;
    const findings = [];
    const counts = {};
    const severityCounts = { P0: 0, P1: 0, P2: 0, P3: 0, tell: 0 };
    const notes = [];
    // A phone browser widens its viewport to fit overflowing content, which would
    // hide the overflow. The screen's own width does not move.
    // Only trust the screen when it is phone-sized: on a desktop it says nothing about the window.
    const screenW = window.screen?.width ?? 0;
    const vw = screenW > 0 && screenW <= 480 && screenW < window.innerWidth ? screenW : window.innerWidth;
    const vh = window.innerHeight;
    const all = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const textOf = (el) => (el.innerText ?? el.textContent ?? '').trim();
    /** Text held directly by the element, not by its children. */
    const ownText = (el) => Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.nodeValue ?? '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
    function describe(el) {
        if (!el || !el.tagName)
            return 'page';
        let s = el.tagName.toLowerCase();
        if (el.id)
            s += '#' + el.id;
        else if (typeof el.className === 'string' && el.className.trim()) {
            s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
        }
        const t = (textOf(el) || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ');
        if (t)
            s += ' "' + t.slice(0, 40) + (t.length > 40 ? '...' : '') + '"';
        return s;
    }
    function add(rule, severity, el, message) {
        const n = (counts[rule] ?? 0) + 1;
        counts[rule] = n;
        severityCounts[severity]++; // every finding, shown or not
        if (n <= MAX_PER_RULE)
            findings.push({ rule, severity, where: describe(el), message });
    }
    /** Run one rule. An error inside it becomes a note and never stops the others. */
    function rule(id, fn) {
        try {
            fn();
        }
        catch (err) {
            notes.push('rule ' + id + ' could not run: ' + (err instanceof Error ? err.message : String(err)));
        }
    }
    function isVisible(el) {
        if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
            return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }
    const onFirstScreen = (r) => r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
    // ---- colour helpers -----------------------------------------------------
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const colorCache = new Map();
    function rgba(str) {
        const cached = colorCache.get(str);
        if (cached)
            return cached;
        let out = [0, 0, 0, 0];
        if (ctx && str) {
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = 'rgba(0,0,0,0)';
            ctx.fillStyle = str;
            ctx.fillRect(0, 0, 1, 1);
            const d = ctx.getImageData(0, 0, 1, 1).data;
            out = [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, (d[3] ?? 0) / 255];
        }
        colorCache.set(str, out);
        return out;
    }
    function over(top, bottom) {
        const a = top[3];
        return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
    }
    function luminance(c) {
        const lin = (x) => {
            const v = x / 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    }
    function ratio(a, b) {
        const la = luminance(a);
        const lb = luminance(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }
    /** Hue in degrees, saturation and lightness from 0 to 1. */
    function hsl(c) {
        const r = c[0] / 255;
        const g = c[1] / 255;
        const b = c[2] / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        const d = max - min;
        if (d === 0)
            return [0, 0, l];
        const s = d / (1 - Math.abs(2 * l - 1));
        let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60;
        if (h < 0)
            h += 360;
        return [h, s, l];
    }
    const keyOf = (c) => c.slice(0, 3).map((n) => Math.round(n)).join(',');
    /** Effective background behind an element, or null when an image or gradient makes it unknowable from styles alone. */
    function backgroundOf(el) {
        const layers = [];
        for (let n = el; n; n = n.parentElement) {
            const cs = getComputedStyle(n);
            if (cs.backgroundImage && cs.backgroundImage !== 'none')
                return null;
            const c = rgba(cs.backgroundColor);
            if (c[3] > 0) {
                layers.push(c);
                if (c[3] >= 0.999)
                    break;
            }
        }
        let base = [255, 255, 255, 1];
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            if (layer)
                base = over(layer, base);
        }
        return base;
    }
    /** Visually hidden helpers (skip links, screen-reader-only labels) are deliberately tiny; they are not layout problems. */
    function isScreenReaderOnly(el) {
        let n = el;
        for (let i = 0; n && i < 3; n = n.parentElement, i++) {
            const r = n.getBoundingClientRect();
            if (r.width <= 2 || r.height <= 2)
                return true;
        }
        return false;
    }
    /** Every element in the body except the insides of SVG drawings, capped so a huge page stays quick. */
    let poolMemo = null;
    const pool = () => (poolMemo ??= all('body *').filter((el) => !(el instanceof SVGElement && el.ownerSVGElement)).slice(0, 4000));
    /**
     * Screens people work in are judged by different rules from pages that persuade.
     * Product UI: a table, many fields, an application, grid or tab list, a step
     * indicator or progress element, a form holding most of the page's controls
     * with four or more fields, or an app-like screen about one screen tall at phone width.
     */
    let productMemo = null;
    function isProductUI() {
        if (productMemo === null) {
            const FIELDS = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea';
            const CONTROLS = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"]';
            const controls = all('input:not([type="hidden"]), select, textarea').filter(isVisible).length;
            const pageControls = all(CONTROLS).filter(isVisible).length;
            const formLed = all('form').some((f) => {
                if (!isVisible(f))
                    return false;
                const fields = all(FIELDS, f).filter(isVisible).length;
                return fields >= 4 && all(CONTROLS, f).filter(isVisible).length > pageControls / 2;
            });
            const docH = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
            const oneScreenPhone = vw <= 480 && docH <= vh * 1.1;
            productMemo =
                all('table').some(isVisible) ||
                    controls > 12 ||
                    !!document.querySelector('[role="application"], [role="grid"], [role="tablist"], [role="progressbar"], progress, [aria-current="step"]') ||
                    formLed ||
                    oneScreenPhone;
        }
        return productMemo;
    }
    /**
     * The first screen's ground, sampled on a 12 by 8 grid: at each point, the
     * first solid background from the top of the stack.
     */
    let samplesMemo = null;
    function groundSamples() {
        if (samplesMemo)
            return samplesMemo;
        const htmlBg = rgba(getComputedStyle(document.documentElement).backgroundColor);
        const bodyBg = rgba(getComputedStyle(document.body).backgroundColor);
        const canvasBg = htmlBg[3] > 0 ? over(htmlBg, [255, 255, 255, 1]) : bodyBg[3] > 0 ? over(bodyBg, [255, 255, 255, 1]) : [255, 255, 255, 1];
        const out = [];
        for (let j = 0; j < 8; j++) {
            for (let i = 0; i < 12; i++) {
                const x = ((i + 0.5) * vw) / 12;
                const y = ((j + 0.5) * vh) / 8;
                let colour = null;
                let hit = null;
                let media = false;
                for (const el of document.elementsFromPoint(x, y)) {
                    const tag = el.tagName.toUpperCase();
                    if (tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'PICTURE' || tag === 'IFRAME' || el instanceof SVGElement) {
                        media = true;
                        hit = el;
                        break;
                    }
                    const cs = getComputedStyle(el);
                    if (cs.backgroundImage && cs.backgroundImage !== 'none') {
                        media = true;
                        hit = el;
                        break;
                    }
                    const c = rgba(cs.backgroundColor);
                    if (c[3] >= 0.5) {
                        colour = c[3] < 1 ? over(c, [255, 255, 255, 1]) : c;
                        hit = el;
                        break;
                    }
                }
                if (!media && !colour)
                    colour = canvasBg;
                out.push({ colour, el: hit });
            }
        }
        samplesMemo = out;
        return out;
    }
    /** The ground colour covering the most sample points, with its share of all points. */
    function dominantGround() {
        const samples = groundSamples();
        const tally = new Map();
        for (const s of samples) {
            if (!s.colour)
                continue;
            const k = keyOf(s.colour);
            const entry = tally.get(k) ?? { colour: s.colour, n: 0, el: s.el };
            entry.n++;
            tally.set(k, entry);
        }
        let best = null;
        for (const e of tally.values())
            if (!best || e.n > best.n)
                best = e;
        return best && samples.length ? { colour: best.colour, share: best.n / samples.length, el: best.el } : null;
    }
    /** Words that name a form field: its label, accessible name and placeholder. */
    function labelText(el) {
        const parts = [];
        for (const l of Array.from(el.labels ?? []))
            parts.push(textOf(l));
        parts.push(el.getAttribute('aria-label') ?? '');
        const by = el.getAttribute('aria-labelledby');
        if (by)
            for (const id of by.split(/\s+/))
                parts.push(textOf(document.getElementById(id) ?? document.createElement('i')));
        parts.push(el.getAttribute('placeholder') ?? '');
        return parts.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
    }
    // ---- collect elements that directly hold text ----------------------------
    let svgText = 0;
    const textEls = [];
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.nodeValue || !node.nodeValue.trim())
            continue;
        const p = node.parentElement;
        if (!p || seen.has(p))
            continue;
        const tag = p.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'OPTION')
            continue;
        seen.add(p);
        // SVG text is painted with fill, not color, and scales with its drawing,
        // so the HTML text rules below would misreport it.
        if (p.namespaceURI === 'http://www.w3.org/2000/svg') {
            svgText++;
            continue;
        }
        if (isVisible(p) && !isScreenReaderOnly(p))
            textEls.push(p);
    }
    if (svgText)
        notes.push(svgText + ' text elements are inside SVG drawings; check their size and contrast by eye.');
    const heads = all('h1,h2,h3,h4,h5,h6').filter(isVisible);
    const running = typeof document.getAnimations === 'function' ? document.getAnimations() : [];
    // Finite animations and transitions still running mean the page is mid-change.
    const settling = running.filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().endTime !== Infinity).length;
    if (settling) {
        notes.push(settling + ' animation(s) or transition(s) were still running when the check started, so contrast and layout findings may be measured mid-change. Run the check again once the page has settled.');
    }
    // ---- contrast, small text, gradient text ---------------------------------
    rule('contrast', () => {
        let unknownBg = 0;
        for (const el of textEls) {
            const cs = getComputedStyle(el);
            const size = parseFloat(cs.fontSize);
            const clip = cs.webkitBackgroundClip || cs.backgroundClip;
            if (clip === 'text') {
                add('gradient-text', 'tell', el, 'Text is filled with a background (gradient text).');
                continue;
            }
            if (size < 12)
                add('small-text', 'P2', el, 'Text is ' + size + 'px; below 12px is hard to read.');
            const fg = rgba(cs.color);
            if (fg[3] === 0)
                continue;
            const bg = backgroundOf(el);
            if (!bg) {
                unknownBg++;
                continue;
            }
            let eff = fg[3] < 1 ? over(fg, bg) : fg;
            let opacity = 1;
            for (let n = el; n; n = n.parentElement)
                opacity *= parseFloat(getComputedStyle(n).opacity);
            if (opacity < 1)
                eff = over([eff[0], eff[1], eff[2], opacity], bg);
            const r = ratio(eff, bg);
            const weight = parseInt(cs.fontWeight, 10) || 400;
            const large = size >= 24 || (size >= 18.66 && weight >= 700);
            const need = large ? 3 : 4.5;
            if (r >= need)
                continue;
            if (el.closest('[disabled],[aria-disabled="true"]'))
                continue;
            // Text lifted out of normal flow may sit over something other than its
            // ancestors, so the measured background can be wrong. Report it for a
            // look instead of as a certain failure.
            let lifted = false;
            for (let a = el; a && a !== document.body; a = a.parentElement) {
                const style = getComputedStyle(a);
                if (style.position === 'absolute' || style.position === 'fixed') {
                    lifted = true;
                    break;
                }
                if (rgba(style.backgroundColor)[3] >= 0.999)
                    break;
            }
            if (lifted) {
                add('contrast-uncertain', 'P2', el, 'Contrast may be ' + r.toFixed(2) + ':1 against its container, but the text is positioned over other content; confirm by eye.');
                continue;
            }
            add('contrast', r < 3 ? 'P0' : 'P1', el, 'Contrast ' + r.toFixed(2) + ':1, needs ' + need + ':1 (' + Math.round(size) + 'px text).');
        }
        if (unknownBg)
            notes.push(unknownBg + ' text elements sit on an image or gradient; check their contrast by eye.');
    });
    // ---- horizontal overflow --------------------------------------------------
    rule('page-overflow', () => {
        const docW = document.documentElement.scrollWidth;
        if (docW <= vw + 1)
            return;
        add('page-overflow', 'P0', null, 'Page is ' + docW + 'px wide in a ' + vw + 'px viewport; it scrolls sideways.');
        for (const el of all('*', document.body)) {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.right <= vw + 1)
                continue;
            let deeper = false;
            for (let kid = el.firstElementChild; kid; kid = kid.nextElementSibling) {
                if (kid.getBoundingClientRect().right > vw + 1) {
                    deeper = true;
                    break;
                }
            }
            if (!deeper && getComputedStyle(el).position !== 'fixed') {
                add('overflow-source', 'P0', el, 'Extends to ' + Math.round(rect.right) + 'px, past the ' + vw + 'px viewport.');
            }
        }
    });
    // ---- page length on phones -------------------------------------------------
    rule('page-length', () => {
        if (vw > 430 || vh <= 0)
            return;
        // The limit (craft.md): a long page is fine when each screen carries one message. Flag past
        // fourteen screens at 390, and past sixteen at 320 measured with a 700px-tall screen.
        const narrow = vw <= 340;
        const screen = narrow ? 700 : vh;
        const screens = document.documentElement.scrollHeight / screen;
        const limit = narrow ? 16 : 14;
        if (screens > limit) {
            add('page-length', 'P2', null, 'Page is about ' + screens.toFixed(1) + ' screens tall at this width (' + document.documentElement.scrollHeight +
                'px, screens of ' + Math.round(screen) + 'px); the limit is ' + limit + '. Give each screen one message: cut words and merge or drop sections; keep each section\'s picture.');
        }
    });
    // One section that runs on for several phone screens is a dense section, whatever the page's length.
    rule('section-length', () => {
        if (vw > 430 || vw <= 340 || vh <= 0 || isProductUI())
            return;
        if (all('article').some((a) => textOf(a).length > 1500))
            return; // long reading is meant to be long
        let root = document.querySelector('main') ?? document.body;
        // Step through wrappers that hold the whole page.
        for (let i = 0; i < 4; i++) {
            const kids = Array.from(root.children).filter(isVisible);
            const only = kids.length === 1 ? kids[0] : undefined;
            if (!only || only.tagName === 'SECTION')
                break;
            root = only;
        }
        const limit = 2.5 * vh;
        const sections = Array.from(root.children).filter((el) => isVisible(el) && !/^(HEADER|FOOTER|NAV|SCRIPT|STYLE|DIALOG)$/.test(el.tagName));
        for (const el of sections) {
            const h = el.getBoundingClientRect().height;
            if (h > limit) {
                add('section-length', 'P2', el, 'This section is about ' + (h / vh).toFixed(1) + ' screens tall at this width (' + Math.round(h) +
                    'px); more than about 2.5 means it carries several messages. Split it, or cut it to one message and one picture.');
            }
        }
    });
    // ---- clipped text ---------------------------------------------------------
    rule('clipped-text', () => {
        for (const el of textEls) {
            const cs = getComputedStyle(el);
            if (cs.overflowX === 'hidden' && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') {
                add('clipped-text', 'P1', el, 'Text is cut off with no ellipsis (' + el.scrollWidth + 'px in ' + el.clientWidth + 'px).');
            }
        }
    });
    // Text cut off with an ellipsis needs its full text somewhere a person can reach it.
    rule('truncated-no-title', () => {
        for (const el of textEls) {
            const cs = getComputedStyle(el);
            const ellipsis = cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
            const clamp = /^\d+$/.test(cs.getPropertyValue('-webkit-line-clamp').trim()) && el.scrollHeight > el.clientHeight + 1;
            if (!ellipsis && !clamp)
                continue;
            let named = false;
            for (let n = el, i = 0; n && i < 4; n = n.parentElement, i++) {
                if (n.getAttribute('title') || n.getAttribute('aria-label')) {
                    named = true;
                    break;
                }
            }
            if (!named)
                add('truncated-no-title', 'P3', el, 'Text is cut off with an ellipsis and its full text is not available (no title or aria-label).');
        }
    });
    // ---- collapsed columns ----------------------------------------------------
    // A block squeezed so narrow that its text breaks to a word or less per line
    // is a broken layout (typically a grid or flex item that lost its width).
    rule('collapsed-column', () => {
        const collapsedSeen = new Set();
        for (const el of textEls) {
            let block = el;
            while (block && block !== document.body && getComputedStyle(block).display.startsWith('inline'))
                block = block.parentElement;
            if (!block || block === document.body || collapsedSeen.has(block))
                continue;
            collapsedSeen.add(block);
            const text = textOf(block);
            if (text.length < 30 || !text.includes(' '))
                continue;
            const cs = getComputedStyle(block);
            if (cs.writingMode && cs.writingMode !== 'horizontal-tb')
                continue;
            const w = block.clientWidth;
            if (w > 0 && w < parseFloat(cs.fontSize) * 5) {
                add('collapsed-column', 'P0', block, 'Text block is only ' + w + 'px wide, so its text breaks to about a word per line. The layout has collapsed.');
            }
        }
    });
    // ---- forms that lead nowhere ----------------------------------------------
    rule('form-mailto', () => {
        let serverForms = 0;
        for (const form of all('form')) {
            const action = (form.getAttribute('action') ?? '').trim();
            if (/^mailto:/i.test(action)) {
                add('form-mailto', 'P1', form, 'Form submits to a mailto: address, which opens an email client and shows no confirmation.');
            }
            else if (action && action !== '#') {
                serverForms++;
            }
        }
        if (serverForms)
            notes.push(serverForms + ' form(s) submit to a server address; complete each one by hand to confirm it ends in a confirmation and not an error.');
    });
    // ---- reading text -----------------------------------------------------------
    rule('line-length', () => {
        for (const el of all('p, li, blockquote, dd')) {
            if (!isVisible(el))
                continue;
            const text = textOf(el);
            if (text.length < 240)
                continue;
            const cs = getComputedStyle(el);
            const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
            const lines = Math.max(1, Math.round(el.getBoundingClientRect().height / lh));
            const perLine = text.length / lines;
            if (perLine > 90)
                add('line-length', 'P2', el, 'About ' + Math.round(perLine) + ' characters per line; aim for 45-75.');
        }
    });
    rule('body-line-height', () => {
        for (const el of all('p, li, dd, blockquote')) {
            if (!isVisible(el) || textOf(el).length < 200)
                continue;
            const cs = getComputedStyle(el);
            const size = parseFloat(cs.fontSize);
            if (!size)
                continue;
            const normal = cs.lineHeight === 'normal';
            const r = normal ? 1.2 : parseFloat(cs.lineHeight) / size;
            if (!r || (r >= 1.3 && r <= 2))
                continue;
            add('body-line-height', 'P3', el, (normal ? 'Line height is "normal" (about 1.2 in most fonts)' : 'Line height is ' + r.toFixed(2) + ' times the text size') +
                ' on a long paragraph; about 1.5 reads best (craft.md).');
        }
    });
    rule('justified-text', () => {
        const blocks = new Set();
        for (const el of textEls) {
            let block = el;
            while (block && block !== document.body && getComputedStyle(block).display.startsWith('inline'))
                block = block.parentElement;
            if (!block || block === document.body || blocks.has(block))
                continue;
            blocks.add(block);
            const cs = getComputedStyle(block);
            if (cs.textAlign !== 'justify' || cs.direction === 'rtl' || textOf(block).length < 200)
                continue;
            add('justified-text', 'P3', block, 'Justified text: on screen it opens uneven gaps between words. Set it ragged unless justification was chosen and the text is hyphenated.');
        }
    });
    // ---- touch targets --------------------------------------------------------
    rule('target-size', () => {
        const touch = vw <= 820 || matchMedia('(pointer: coarse)').matches;
        const interactive = all('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="switch"]');
        for (const el of interactive) {
            if (!isVisible(el) || isScreenReaderOnly(el))
                continue;
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            // The standard exempts links inside a sentence. Navigation and footer links are not that.
            const inlineLink = el.tagName === 'A' &&
                cs.display === 'inline' &&
                !el.closest('nav, header, footer') &&
                !!el.closest('p, li, td, dd, blockquote, figcaption') &&
                !!el.parentElement &&
                textOf(el.parentElement).length > textOf(el).length + 20;
            if (inlineLink)
                continue;
            let w = r.width;
            let h = r.height;
            if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
                const label = el.labels?.[0];
                if (label) {
                    const lr = label.getBoundingClientRect();
                    w = Math.max(w, lr.width);
                    h = Math.max(h, lr.height);
                }
            }
            w = Math.round(w);
            h = Math.round(h);
            // A lone text link (nav, footer) usually passes the standard through its
            // spacing exception, so report it as roughness, not a failure.
            const textLink = el.tagName === 'A' && !el.querySelector('img, svg') && cs.display.startsWith('inline');
            if (w < 24 || h < 24) {
                add('target-size', touch && !textLink ? 'P1' : 'P2', el, 'Target is ' + w + 'x' + h + 'px; the minimum is 24px and 44px is the goal on touch.');
            }
            else if (touch && (w < 44 || h < 44)) {
                add('target-size', 'P2', el, 'Target is ' + w + 'x' + h + 'px on a touch-sized viewport; aim for 44px.');
            }
        }
    });
    // ---- names and labels -----------------------------------------------------
    rule('no-name', () => {
        const hasName = (el) => {
            if (textOf(el))
                return true;
            if (el.getAttribute('aria-label') || el.getAttribute('title'))
                return true;
            const by = el.getAttribute('aria-labelledby');
            const firstId = by ? by.split(/\s+/)[0] : undefined;
            if (firstId && document.getElementById(firstId))
                return true;
            return !!el.querySelector('img[alt]:not([alt=""]), svg[aria-label], svg title');
        };
        for (const el of all('button, a[href], [role="button"]')) {
            if (isVisible(el) && !hasName(el))
                add('no-name', 'P1', el, 'Control has no accessible name (no text, aria-label or labelled image).');
        }
    });
    rule('link-text-generic', () => {
        const generic = new Set(['click here', 'here', 'read more', 'learn more', 'more', 'link']);
        for (const el of all('a[href], button, [role="button"], [role="link"]')) {
            if (!isVisible(el) || el.hasAttribute('aria-labelledby'))
                continue;
            const name = (el.getAttribute('aria-label') || textOf(el)).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
            if (generic.has(name))
                add('link-text-generic', 'P3', el, 'Link or button text is only "' + name + '"; name where it goes or what it does.');
        }
    });
    // A link in running text needs more than colour to stand out from the words around it.
    rule('link-colour-only', () => {
        for (const a of all('p a[href], li a[href], dd a[href], td a[href], blockquote a[href], figcaption a[href]')) {
            if (!isVisible(a) || a.closest('nav, header, footer'))
                continue;
            const cs = getComputedStyle(a);
            if (cs.display !== 'inline')
                continue;
            const parent = a.parentElement;
            if (!parent || textOf(parent).length <= textOf(a).length + 20)
                continue;
            if (cs.textDecorationLine.includes('underline'))
                continue;
            const kid = a.firstElementChild;
            if (kid && getComputedStyle(kid).textDecorationLine.includes('underline'))
                continue;
            if ((parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== 'none') || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none')
                continue;
            const ps = getComputedStyle(parent);
            if (Math.abs((parseInt(cs.fontWeight, 10) || 400) - (parseInt(ps.fontWeight, 10) || 400)) >= 300 || cs.fontStyle !== ps.fontStyle)
                continue;
            const bg = backgroundOf(a);
            if (!bg)
                continue;
            const fg = rgba(cs.color);
            const pf = rgba(ps.color);
            if (fg[3] === 0 || pf[3] === 0)
                continue;
            const r = ratio(over(fg, bg), over(pf, bg));
            if (r < 3) {
                add('link-colour-only', 'P3', a, 'Link in running text is told apart only by colour, at ' + r.toFixed(2) + ':1 against the text around it; underline it or reach 3:1.');
            }
        }
    });
    rule('img-alt', () => {
        for (const el of all('img')) {
            if (!el.hasAttribute('alt')) {
                add('img-alt', 'P1', el, 'Image has no alt attribute (use alt="" if decorative).');
                continue;
            }
            const alt = (el.getAttribute('alt') ?? '').trim();
            if (!alt || !isVisible(el))
                continue;
            if (/^[\w.-]+\.(png|jpe?g|gif|webp|avif|svg)$/i.test(alt) || /^(image|photo|picture|img|graphic)$/i.test(alt)) {
                add('img-alt', 'P3', el, 'Alt text "' + alt + '" is a file name or a generic word; describe what the image shows, or use alt="" if it is decorative.');
            }
        }
    });
    rule('image-no-size', () => {
        for (const el of all('img')) {
            if (el.hasAttribute('width') && el.hasAttribute('height'))
                continue;
            if (!isVisible(el) || !el.naturalWidth || !el.naturalHeight)
                continue;
            const cs = getComputedStyle(el);
            if (cs.aspectRatio && cs.aspectRatio !== 'auto')
                continue;
            if (cs.position === 'absolute' || cs.position === 'fixed' || cs.objectFit !== 'fill')
                continue;
            const parent = el.parentElement;
            if (parent && getComputedStyle(parent).aspectRatio !== 'auto')
                continue;
            const r = el.getBoundingClientRect();
            if (r.width < 48 || r.height < 48)
                continue;
            // A height that does not follow the picture's own shape was set by CSS, so the space is reserved.
            if (Math.abs((r.width * el.naturalHeight) / el.naturalWidth - r.height) > 2)
                continue;
            add('image-no-size', 'P3', el, 'Image has no width and height attributes and no CSS aspect-ratio, so the page jumps when it loads.');
        }
    });
    rule('image-oversized', () => {
        const dpr = window.devicePixelRatio || 1;
        for (const el of all('img')) {
            if (!isVisible(el) || !el.naturalWidth)
                continue;
            const src = el.currentSrc || el.src;
            if (/\.svg(\?|#|$)|^data:image\/svg/i.test(src))
                continue;
            const w = el.getBoundingClientRect().width;
            if (w <= 100 || el.naturalWidth <= 2.5 * w * dpr)
                continue;
            add('image-oversized', 'P3', el, 'Image file is ' + el.naturalWidth + 'px wide but shown at ' + Math.round(w) + 'px (' + dpr +
                'x screen); serve a smaller size, for example with srcset.');
        }
    });
    rule('chart-unnamed', () => {
        const hinted = (start) => {
            for (let n = start, i = 0; n && i < 4; n = n.parentElement, i++) {
                if (/chart|graph|plot|sparkline/i.test(n.id + ' ' + (n.getAttribute('class') ?? '')))
                    return true;
            }
            return false;
        };
        for (const el of all('svg, canvas')) {
            if (el.parentElement?.closest('svg') || !isVisible(el) || el.getAttribute('aria-hidden') === 'true')
                continue;
            const r = el.getBoundingClientRect();
            if (r.width < 200 || r.height < 120)
                continue;
            let chartish;
            if (el.tagName.toUpperCase() === 'CANVAS')
                chartish = hinted(el);
            else {
                const shapes = el.querySelectorAll('rect, path, circle, line, polyline').length;
                const labels = el.querySelectorAll('text').length;
                chartish = (labels >= 3 && shapes >= 6) || (hinted(el) && shapes >= 3);
            }
            if (!chartish)
                continue;
            const figure = el.closest('figure');
            const named = !!el.getAttribute('aria-label') ||
                !!el.getAttribute('aria-labelledby') ||
                !!el.querySelector(':scope > title')?.textContent?.trim() ||
                !!(figure && figure.querySelector('figcaption')) ||
                !!el.parentElement?.closest('[role="img"][aria-label], [role="img"][aria-labelledby], [role="figure"][aria-label], [role="figure"][aria-labelledby]');
            if (!named)
                add('chart-unnamed', 'P3', el, 'Chart has no accessible name; add an aria-label, a title, or a figure caption that says what it shows.');
        }
    });
    // Something that looks pressable but is not a control cannot be reached by keyboard or announced.
    rule('clickable-not-control', () => {
        const controls = 'a[href], button, input, select, textarea, label, summary, [contenteditable="true"], [tabindex]:not([tabindex="-1"]), ' +
            '[role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], [role="checkbox"], [role="switch"], [role="radio"], [role="treeitem"], [role="gridcell"], [role="row"]';
        const tags = new Set(['DIV', 'SPAN', 'LI', 'IMG', 'SVG']);
        for (const el of pool()) {
            if (!tags.has(el.tagName.toUpperCase()))
                continue;
            const onclick = el.hasAttribute('onclick');
            const cs = getComputedStyle(el);
            if (!onclick && cs.cursor !== 'pointer')
                continue;
            // An inherited pointer cursor belongs to the ancestor that set it.
            if (!onclick && el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer')
                continue;
            if (el.hasAttribute('role') || el.hasAttribute('tabindex'))
                continue;
            if (el.parentElement?.closest(controls) || el.querySelector(controls))
                continue;
            if (!isVisible(el))
                continue;
            add('clickable-not-control', 'P2', el, 'Looks clickable (pointer cursor or onclick) but is not a button or link, so keyboard and screen-reader users cannot use it.');
        }
    });
    rule('no-label', () => {
        for (const el of all('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea')) {
            if (!isVisible(el))
                continue;
            const visibleLabel = (el.labels?.length ?? 0) > 0 || !!el.getAttribute('aria-labelledby');
            const labelled = visibleLabel || !!el.getAttribute('aria-label') || !!el.getAttribute('title');
            if (!labelled)
                add('no-label', 'P1', el, 'Form field has no label (a placeholder is not a label).');
            else if (!visibleLabel && !['range', 'checkbox', 'radio', 'search'].includes(el.type)) {
                add('hidden-label', 'P2', el, 'Form field is named only for screen readers; sighted users lose the label once they type. Add a visible label.');
            }
        }
    });
    // An iPhone zooms the whole page when a field with text under 16px is focused.
    rule('input-zoom', () => {
        if (vw > 430)
            return;
        for (const el of all('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea')) {
            if (!isVisible(el))
                continue;
            const size = parseFloat(getComputedStyle(el).fontSize);
            if (size < 16)
                add('input-zoom', 'P2', el, 'Field text is ' + size + 'px; under 16px an iPhone zooms the page when the field is focused.');
        }
    });
    // ---- forms: filling in ---------------------------------------------------------
    const textFields = () => all('input').filter((el) => {
        if (el.disabled || el.readOnly || !isVisible(el))
            return false;
        return !['hidden', 'submit', 'button', 'reset', 'checkbox', 'radio', 'file', 'range', 'color', 'image', 'search',
            'date', 'time', 'datetime-local', 'month', 'week'].includes(el.type);
    });
    rule('autocomplete-missing', () => {
        for (const el of textFields()) {
            if (el.hasAttribute('autocomplete') || el.form?.getAttribute('autocomplete') === 'off')
                continue;
            const name = el.name.toLowerCase();
            const id = el.id.toLowerCase();
            const ids = name + ' ' + id;
            const label = labelText(el);
            let kind = '';
            if (el.type === 'email' || /e-?mail/.test(ids) || /\be-?mail\b/.test(label))
                kind = 'email';
            else if (el.type === 'password' || /password/.test(ids))
                kind = 'password';
            else if (el.type === 'tel' || /phone|mobile|\btel\b/.test(ids) || /\b(phone|mobile|telephone)\b/.test(label))
                kind = 'phone';
            else if (/card.?num|cc.?num/.test(ids) || /\bcard number\b/.test(label))
                kind = 'card number';
            else if (/post.?code|postal|\bzip\b/.test(ids + ' ' + label))
                kind = 'postcode';
            else if ([name, id].some((s) => /street|address.?line|^address\d?$/.test(s)) || /^(street|address\b|address line|home address|postal address|billing address|shipping address|delivery address)/.test(label))
                kind = 'street address';
            else if ([name, id].some((s) => /^(full.?name|first.?name|last.?name|fname|lname|given.?name|family.?name|surname|name)$/.test(s)) ||
                /^(full name|your name|name|first name|last name|surname|given name|family name)\b/.test(label))
                kind = 'name';
            if (kind)
                add('autocomplete-missing', 'P3', el, 'A ' + kind + ' field has no autocomplete attribute; add one so browsers and password managers can fill it.');
        }
    });
    rule('input-type', () => {
        for (const el of textFields()) {
            if (el.type !== 'text' || el.hasAttribute('inputmode'))
                continue;
            const ids = (el.name + ' ' + el.id).toLowerCase();
            const label = labelText(el);
            if (/user ?name|\bor\b/.test(label))
                continue;
            let kind = '';
            let type = '';
            if (/e-?mail/.test(ids) || /\be-?mail\b/.test(label))
                [kind, type] = ['an email address', 'email'];
            else if (/phone|mobile|\btel\b/.test(ids) || /\b(phone|mobile|telephone)\b/.test(label))
                [kind, type] = ['a phone number', 'tel'];
            else if (/\burl\b|website/.test(ids) || /\b(url|website|web site|homepage)\b/.test(label))
                [kind, type] = ['a web address', 'url'];
            if (kind)
                add('input-type', 'P3', el, 'A field for ' + kind + ' uses type="text"; type="' + type + '" brings the right phone keyboard.');
        }
    });
    rule('error-not-linked', () => {
        const fieldSel = 'input:not([type="hidden"]), select, textarea';
        const reported = new Set();
        for (const el of all('[aria-invalid="true"]')) {
            if (!el.matches(fieldSel) || !isVisible(el))
                continue;
            if (el.hasAttribute('aria-describedby') || el.hasAttribute('aria-errormessage'))
                continue;
            reported.add(el);
            add('error-not-linked', 'P2', el, 'Field is marked invalid but no error message is linked to it (aria-describedby or aria-errormessage).');
        }
        for (const err of all('[role="alert"], [class*="error" i]')) {
            if (err.matches(fieldSel) || err.querySelector(fieldSel) || !isVisible(err))
                continue;
            const text = textOf(err);
            if (!text || text.length > 200)
                continue;
            const prev = err.previousElementSibling;
            let field = null;
            if (prev?.matches(fieldSel))
                field = prev;
            else if (prev) {
                const inner = prev.querySelectorAll(fieldSel);
                if (inner.length === 1)
                    field = inner[0] ?? null;
            }
            if (!field || reported.has(field) || !isVisible(field))
                continue;
            if (field.hasAttribute('aria-describedby') || field.hasAttribute('aria-errormessage'))
                continue;
            reported.add(field);
            add('error-not-linked', 'P2', err, 'Error message follows a field but is not linked to it (aria-describedby), so screen readers do not read it with the field.');
        }
    });
    rule('required-unmarked', () => {
        const marked = (el) => {
            const content = ['::before', '::after'].map((p) => getComputedStyle(el, p).content).join(' ');
            return /\*|required/i.test(textOf(el) + ' ' + content);
        };
        for (const form of all('form')) {
            const fields = all('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), select, textarea', form)
                .filter(isVisible);
            if (fields.length < 2)
                continue;
            const formText = textOf(form);
            if (/optional|all fields are required/i.test(formText))
                continue; // optional fields are marked instead
            for (const el of fields) {
                if (!el.required && el.getAttribute('aria-required') !== 'true')
                    continue;
                const label = el.labels?.[0];
                if (!label)
                    continue; // no-label covers it
                const last = label.lastElementChild;
                if (marked(label) || (last && marked(last)))
                    continue;
                add('required-unmarked', 'P3', el, 'Required field with no visible marker in its label; mark required fields, or mark the optional ones instead.');
            }
        }
    });
    rule('dead-link', () => {
        for (const el of all('a[href="#"], a[href=""]')) {
            if (isVisible(el))
                add('dead-link', 'P2', el, 'Link goes nowhere (href="#").');
        }
    });
    // A same-page link whose target does not exist goes nowhere, like href="#": a header link
    // to "#menu" with no section of that id. Skipped where false alarms are likely: "#top"
    // (the browser scrolls to the top by standard), script routes ("#/..." and "#!..."),
    // text fragments, and links that act as tabs or toggles (a role or aria-controls).
    rule('missing-anchor', () => {
        for (const el of all('a[href^="#"]')) {
            const href = el.getAttribute('href') ?? '';
            const frag = href.slice(1);
            if (!frag || /^top$/i.test(frag) || /^[/!]/.test(frag) || frag.startsWith(':~:'))
                continue;
            if (el.hasAttribute('role') || el.hasAttribute('aria-controls') || !isVisible(el))
                continue;
            let id = frag;
            try {
                id = decodeURIComponent(frag);
            }
            catch {
                /* keep it as written */
            }
            if (document.getElementById(id) || document.getElementsByName(id).length > 0)
                continue;
            add('missing-anchor', 'P2', el, 'Link to "' + href + '" but nothing on the page has that id, so it goes nowhere; point it at a real section or remove it.');
        }
    });
    // ---- headings -------------------------------------------------------------
    rule('h1-count', () => {
        const h1s = heads.filter((h) => h.tagName === 'H1').length;
        if (h1s !== 1)
            add('h1-count', 'P2', null, 'Page has ' + h1s + ' h1 elements; it should have one.');
        let prev = 0;
        for (const h of heads) {
            const lvl = parseInt(h.tagName.slice(1), 10);
            if (prev && lvl > prev + 1)
                add('heading-skip', 'P2', h, 'Heading jumps from h' + prev + ' to h' + lvl + '.');
            prev = lvl;
        }
    });
    // ---- motion ---------------------------------------------------------------
    rule('reduced-motion', () => {
        let hasMotion = false;
        let hasReduced = false;
        const scan = (list) => {
            for (const r of Array.from(list)) {
                if (r instanceof CSSMediaRule && /prefers-reduced-motion/.test(r.conditionText))
                    hasReduced = true;
                if (r instanceof CSSKeyframesRule)
                    hasMotion = true;
                // Transitions are feedback on interaction; only self-running animation needs a reduced-motion rule.
                if (r instanceof CSSStyleRule && r.style.animationName && r.style.animationName !== 'none')
                    hasMotion = true;
                if (r instanceof CSSGroupingRule)
                    scan(r.cssRules);
            }
        };
        for (const sheet of Array.from(document.styleSheets)) {
            try {
                scan(sheet.cssRules);
            }
            catch {
                /* a stylesheet from another origin cannot be read */
            }
        }
        if (running.length)
            hasMotion = true;
        if (hasMotion && !hasReduced)
            add('reduced-motion', 'P1', null, 'The page animates but has no prefers-reduced-motion rule.');
    });
    // Movement that never stops needs a way to pause it.
    rule('no-pause', () => {
        let endless = 0;
        for (const anim of running) {
            const effect = anim.effect;
            if (!(effect instanceof KeyframeEffect))
                continue;
            const target = effect.target;
            if (effect.getTiming().iterations === Infinity && target && isVisible(target) && target.getBoundingClientRect().width > 40)
                endless++;
        }
        if (!endless)
            return;
        const pauseControl = all('button, [role="button"]').some((b) => /\b(pause|stop|play)\b/i.test(textOf(b) + ' ' + (b.getAttribute('aria-label') ?? '') + ' ' + (b.getAttribute('title') ?? '')));
        if (!pauseControl)
            add('no-pause', 'P1', null, endless + ' animation(s) loop forever and no pause or stop control was found.');
    });
    rule('slow-transition', () => {
        const longest = (s) => Math.max(0, ...s.split(',').map((p) => (/ms\s*$/.test(p) ? parseFloat(p) : parseFloat(p) * 1000)).filter((n) => !isNaN(n)));
        let allCount = 0;
        let allExample = null;
        for (const el of all('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]')) {
            if (!isVisible(el))
                continue;
            const cs = getComputedStyle(el);
            const d = longest(cs.transitionDuration);
            if (d > 600)
                add('slow-transition', 'P3', el, 'A ' + Math.round(d) + 'ms transition on a control; feedback should land within about 100-300ms (craft.md).');
            if (d > 0 && cs.transitionProperty.split(',').some((p) => p.trim() === 'all')) {
                allCount++;
                allExample ??= el;
            }
        }
        if (allCount > 3)
            add('slow-transition', 'P3', allExample, allCount + ' controls transition "all" properties, which animates layout too; name the properties.');
    });
    // ---- page basics ------------------------------------------------------------
    if (vw > 330)
        notes.push('Sideways overflow is only measured at the current width (' + vw + 'px). Run again at 320.');
    rule('viewport-meta', () => {
        if (!document.querySelector('meta[name="viewport"]'))
            add('viewport-meta', 'P0', null, 'No viewport meta tag; the page will not fit phone screens.');
    });
    rule('zoom-blocked', () => {
        const content = (document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '').toLowerCase();
        if (!content)
            return;
        const max = /maximum-scale\s*=\s*([0-9.]+)/.exec(content);
        const maxScale = max ? parseFloat(max[1] ?? '') : NaN;
        if (/user-scalable\s*=\s*(no|0)\b/.test(content))
            add('zoom-blocked', 'P1', null, 'The viewport tag sets user-scalable=no, so people cannot zoom.');
        else if (!isNaN(maxScale) && maxScale < 2)
            add('zoom-blocked', 'P1', null, 'The viewport tag sets maximum-scale=' + maxScale + '; people must be able to zoom to at least 200%.');
    });
    rule('lang', () => {
        if (!document.documentElement.getAttribute('lang'))
            add('lang', 'P2', null, 'The html element has no lang attribute.');
    });
    rule('page-basics', () => {
        if (!document.title.trim())
            add('page-basics', 'P2', null, 'The page has no title, so its tab and bookmarks are unnamed.');
        if (!document.querySelector('main, [role="main"]'))
            add('page-basics', 'P2', null, 'The page has no main landmark, so screen-reader users cannot jump to the content.');
        if (!document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim())
            add('page-basics', 'P3', null, 'The page has no meta description.');
        if (!document.querySelector('link[rel~="icon"]'))
            add('page-basics', 'P3', null, 'The page links no icon, so its tab shows a blank or default one.');
    });
    // ---- content ------------------------------------------------------------------
    // Emoji_Presentation excludes text symbols such as the copyright sign.
    rule('emoji-icon', () => {
        const emoji = /\p{Emoji_Presentation}/u;
        for (const el of all('h1,h2,h3,h4,button,a,li,th,label')) {
            if (isVisible(el) && emoji.test(ownText(el)))
                add('emoji-icon', 'tell', el, 'Emoji used in a heading, control or list item.');
        }
    });
    rule('eyebrow', () => {
        // One of a set of real markings (sizes along a tape, lane or bay numbers) is information, not an eyebrow:
        // the label sits among three or more siblings of its own kind, or is a short code with a digit in it.
        const inMarkingSet = (el) => {
            const parent = el.parentElement;
            if (!parent)
                return false;
            const kind = (n) => n.tagName + '.' + Array.from(n.classList).sort().join('.');
            const k = kind(el);
            const sameKind = Array.from(parent.children).filter((c) => kind(c) === k).length;
            return sameKind >= 3;
        };
        for (const h of heads) {
            const before = h.previousElementSibling;
            if (!before || !isVisible(before))
                continue;
            const cs = getComputedStyle(before);
            const t = textOf(before);
            if (t && t.length < 40 && parseFloat(cs.fontSize) <= 14 && (cs.textTransform === 'uppercase' || (t === t.toUpperCase() && /[A-Z]/.test(t)))) {
                if (inMarkingSet(before) || (t.length <= 5 && /\d/.test(t)))
                    continue;
                add('eyebrow', 'tell', before, 'Small all-caps label above a heading.');
            }
        }
    });
    rule('filler-words', () => {
        const bodyText = document.body.innerText ?? '';
        const slop = ['elevate', 'seamless', 'seamlessly', 'unlock', 'supercharge', 'effortless', 'effortlessly', 'reimagine', 'revolutionize',
            'game-changing', 'cutting-edge', 'next-level', 'world-class', 'unleash', 'empower'];
        const found = slop.filter((w) => new RegExp('\\b' + w + '\\b', 'i').test(bodyText));
        if (found.length)
            add('filler-words', 'tell', null, 'Marketing filler found: ' + found.join(', ') + '.');
        if (/lorem ipsum/i.test(bodyText))
            add('placeholder-text', 'P1', null, 'Lorem ipsum placeholder text is visible.');
        if (/\b(John|Jane) Doe\b|\bAcme\b/.test(bodyText))
            add('stock-names', 'tell', null, 'Stock placeholder names (John Doe, Acme) are visible.');
        // Scroll reveals are part of the motion layer (craft.md). The tell is the same reveal on everything with no stagger.
        // Judged per element from what the browser computes: the delays, the animated properties, durations and easing,
        // and the hidden state (transform, clip, opacity). A stagger written as a custom property (style="--i: 2" used in
        // transition-delay) may only take effect once the element is revealed, so differing per-element custom
        // properties count as a stagger too.
        const reveals = all('[data-aos], [class*="fade-up"], [class*="fadeUp"], [class*="reveal"]');
        if (reveals.length > 6) {
            const STAGGER_VARS = ['--i', '--index', '--n', '--order', '--delay', '--stagger', '--d'];
            const kinds = new Set();
            const delays = new Set();
            const stagger = new Set();
            for (const el of reveals) {
                const cs = getComputedStyle(el);
                kinds.add([cs.transitionProperty, cs.transitionDuration, cs.transitionTimingFunction, cs.animationName, cs.animationDuration,
                    cs.animationTimingFunction, cs.transform, cs.clipPath, cs.opacity, el.getAttribute('data-aos') ?? ''].join('|'));
                delays.add(cs.transitionDelay + '|' + cs.animationDelay + '|' + (el.getAttribute('data-aos-delay') ?? ''));
                const own = [];
                const inline = el.style;
                for (let i = 0; inline && i < inline.length; i++) {
                    const prop = inline.item(i);
                    if (prop.startsWith('--'))
                        own.push(prop + ':' + inline.getPropertyValue(prop).trim());
                }
                for (const v of STAGGER_VARS) {
                    const val = cs.getPropertyValue(v).trim();
                    if (val)
                        own.push(v + ':' + val);
                }
                stagger.add(own.sort().join(';'));
            }
            if (kinds.size === 1 && delays.size === 1 && stagger.size === 1) {
                add('scroll-reveals', 'tell', null, reveals.length + ' elements animate in on scroll with the same reveal and no stagger; vary them by section and stagger children (craft.md).');
            }
        }
    });
    // A broken value reaching the screen: undefined, NaN, null, [object Object].
    rule('raw-values', () => {
        for (const el of textEls) {
            if (el.closest('code, pre, kbd, samp, textarea'))
                continue;
            const t = ownText(el);
            const raw = /\[object Object\]/.test(t) ||
                t === 'null' ||
                t === 'undefined' ||
                /\bNaN\b/.test(t) ||
                /[$€£:]\s*undefined\b|\bundefined\s*(%|px|[$€£])|\d\s*undefined\b|\bundefined\s*\d|\bundefined undefined\b/.test(t);
            if (raw)
                add('raw-values', 'P1', el, 'A raw value is on screen ("' + t.slice(0, 40) + '"); a missing or broken value is reaching the page.');
        }
    });
    // ---- type -----------------------------------------------------------------------
    // All-caps text needs letter-spacing to stay readable.
    rule('caps-tracking', () => {
        for (const el of textEls) {
            const cs = getComputedStyle(el);
            const t = textOf(el);
            if (cs.textTransform !== 'uppercase' || t.length < 4)
                continue;
            const size = parseFloat(cs.fontSize);
            if (size > 20)
                continue; // large display type is set tight on purpose
            const spacing = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
            if (size > 0 && spacing / size < 0.04) {
                add('caps-tracking', 'P2', el, 'All-caps text with no letter-spacing; add about 0.06em so the letters do not crowd.');
            }
        }
    });
    // Too many text sizes reads as noise. Five to seven covers most screens.
    // Text inside a product mock-up (a drawn app window or phone screen) is the product's, not
    // the page's: leave out anything inside [data-mock], a role="img" picture or an aria-hidden illustration.
    rule('many-type-sizes', () => {
        const mock = '[data-mock], [role="img"], [aria-hidden="true"]';
        const sizes = new Set();
        for (const el of textEls) {
            if (el.closest(mock))
                continue;
            sizes.add(Math.round(parseFloat(getComputedStyle(el).fontSize)));
        }
        if (sizes.size > 12) {
            add('many-type-sizes', 'P2', null, sizes.size + ' different text sizes are in use (' + Array.from(sizes).sort((a, b) => a - b).join(', ') + 'px). Most screens need five to seven, plus one or two display sizes.');
        }
    });
    // At most two type families on a page (craft.md). Code samples and a logo set in its own face do not count.
    rule('font-families', () => {
        const generic = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont|emoji|math|inherit|initial)$/;
        const iconFont = /icon|awesome|material symbols|glyph|fontello|feather|remix/;
        const families = new Map();
        for (const el of textEls) {
            if (el.closest('code, pre, kbd, samp, [class*="logo" i], [class*="wordmark" i], [aria-hidden="true"]'))
                continue;
            const first = (getComputedStyle(el).fontFamily.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '').toLowerCase();
            if (!first || generic.test(first) || iconFont.test(first))
                continue;
            const entry = families.get(first) ?? { els: 0, chars: 0 };
            entry.els++;
            entry.chars += ownText(el).length;
            families.set(first, entry);
        }
        const used = Array.from(families).filter(([, f]) => (f.els >= 2 && f.chars >= 12) || f.chars >= 24).map(([name]) => name);
        if (used.length > 2)
            add('font-families', 'P3', null, used.length + ' font families carry text (' + used.join(', ') + '); at most two on a page (craft.md).');
    });
    rule('thin-body-text', () => {
        let total = 0;
        let thin = 0;
        let example = null;
        for (const el of textEls) {
            const len = ownText(el).length;
            const cs = getComputedStyle(el);
            total += len;
            if (parseFloat(cs.fontSize) < 20 && (parseInt(cs.fontWeight, 10) || 400) <= 300) {
                thin += len;
                example ??= el;
            }
        }
        if (thin >= 200 && total > 0 && thin / total > 0.2) {
            add('thin-body-text', 'P2', example, 'About ' + Math.round((thin / total) * 100) + '% of the text is body-sized at weight 300 or lighter; thin strokes at reading sizes are hard to read.');
        }
    });
    rule('timid-headline', () => {
        if (vw < 1280 || isProductUI())
            return;
        const bySize = new Map();
        let largest = 0;
        let largestEl = null;
        for (const el of textEls) {
            const size = Math.round(parseFloat(getComputedStyle(el).fontSize));
            bySize.set(size, (bySize.get(size) ?? 0) + ownText(el).length);
            if (onFirstScreen(el.getBoundingClientRect()) && size > largest) {
                largest = size;
                largestEl = el;
            }
        }
        let body = 0;
        let most = 0;
        for (const [size, n] of bySize) {
            if (n > most) {
                most = n;
                body = size;
            }
        }
        if (body && largest && largest < body * 2.2) {
            add('timid-headline', 'P2', largestEl, 'The largest text on the first screen is ' + largest + 'px, only ' + (largest / body).toFixed(1) + ' times the ' + body +
                'px body text; a first-screen headline usually needs at least about 2.2 times (craft.md).');
        }
        const h1 = heads.find((h) => h.tagName === 'H1');
        const h2Size = Math.max(0, ...heads.filter((h) => h.tagName === 'H2').map((h) => parseFloat(getComputedStyle(h).fontSize)));
        if (h1 && h2Size) {
            const h1Size = parseFloat(getComputedStyle(h1).fontSize);
            if (h1Size <= h2Size)
                add('timid-headline', 'P2', h1, 'The h1 is ' + h1Size + 'px, no larger than an h2 (' + h2Size + 'px).');
        }
    });
    // ---- colour: prompts to confirm a choice, not failures ---------------------------
    rule('colour-flood', () => {
        const samples = groundSamples();
        const tally = new Map();
        for (const s of samples) {
            if (!s.colour)
                continue;
            const [, sat, l] = hsl(s.colour);
            if (sat <= 0.55 || l < 0.25 || l > 0.85)
                continue;
            const k = keyOf(s.colour);
            const e = tally.get(k) ?? { n: 0, colour: s.colour, el: s.el };
            e.n++;
            tally.set(k, e);
        }
        for (const e of tally.values()) {
            const share = e.n / samples.length;
            if (share > 0.55) {
                add('colour-flood', 'P3', e.el, 'One saturated colour (rgb(' + keyOf(e.colour) + ')) is the background of about ' + Math.round(share * 100) +
                    '% of the first screen. A prompt, not a failure: confirm the flood was chosen and that the main action still stands out.');
            }
        }
    });
    rule('warm-default-ground', () => {
        const ground = dominantGround();
        if (!ground || ground.share < 0.3)
            return;
        const [h, s, l] = hsl(ground.colour);
        if (h >= 28 && h <= 62 && s > 0.25 && l > 0.6) {
            add('warm-default-ground', 'P3', ground.el, 'The main ground is a yellow, cream, beige or amber (rgb(' + keyOf(ground.colour) +
                ')). A prompt, not a failure: confirm it came from the subject and was not a reflex answer to "warm" (tells.md).');
        }
    });
    rule('many-hues', () => {
        const families = new Map();
        const skip = 'figure, svg, canvas, video, picture, [class*="chart" i], [class*="graph" i]';
        for (const el of pool()) {
            const tag = el.tagName.toUpperCase();
            if (tag === 'IMG' || el instanceof SVGElement || el.closest(skip))
                continue;
            const cs = getComputedStyle(el);
            const colours = [rgba(cs.backgroundColor)];
            if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none')
                colours.push(rgba(cs.borderTopColor));
            else if (parseFloat(cs.borderLeftWidth) > 0 && cs.borderLeftStyle !== 'none')
                colours.push(rgba(cs.borderLeftColor));
            else if (parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== 'none')
                colours.push(rgba(cs.borderBottomColor));
            if (seen.has(el))
                colours.push(rgba(cs.color));
            const buckets = new Set();
            for (const c of colours) {
                if (c[3] < 0.5)
                    continue;
                const [h, s, l] = hsl(c);
                if (s <= 0.45 || l < 0.15 || l > 0.92)
                    continue;
                buckets.add(Math.floor(h / 30) % 12);
            }
            if (!buckets.size || !isVisible(el))
                continue;
            for (const b of buckets)
                families.set(b, (families.get(b) ?? 0) + 1);
        }
        const used = Array.from(families).filter(([, n]) => n >= 5).map(([b]) => b * 30 + '-' + (b * 30 + 30) + ' degrees');
        if (used.length > 3) {
            add('many-hues', 'P3', null, used.length + ' saturated hue families are in use (' + used.join(', ') +
                '). A prompt, not a failure: two neutrals and one accent is the default, so confirm each extra hue has a job such as status or data.');
        }
    });
    rule('pure-black-white', () => {
        const byColour = new Map();
        for (const el of textEls) {
            const c = rgba(getComputedStyle(el).color);
            if (c[3] < 1)
                continue;
            const k = keyOf(c);
            byColour.set(k, (byColour.get(k) ?? 0) + ownText(el).length);
        }
        let text = '';
        let most = 0;
        for (const [k, n] of byColour) {
            if (n > most) {
                most = n;
                text = k;
            }
        }
        const ground = dominantGround();
        if (!ground || !text)
            return;
        const g = keyOf(ground.colour);
        if ((text === '0,0,0' && g === '255,255,255') || (text === '255,255,255' && g === '0,0,0')) {
            add('pure-black-white', 'P3', null, 'The main text is pure ' + (text === '0,0,0' ? 'black on pure white' : 'white on pure black') +
                '. A prompt, not a failure: a slightly tinted ink and ground are usually easier on the eye (craft.md).');
        }
    });
    // ---- first screen -------------------------------------------------------------------
    rule('competing-actions', () => {
        // Several different filled actions in the same colour on one screen compete for the primary action.
        // Repeats of one action (a Book button on every row) are one kind of action and count once:
        // the same accessible name, or the same destination. A set of app-store badges is one action.
        // Skip links and visually hidden links are not on the screen and do not count. Digits are ignored in the name, so
        // times and dates on a programme ("18:30", "Book 20:45") read as one action.
        const pageBg = backgroundOf(document.body) ?? [255, 255, 255, 1];
        const filled = new Map();
        const seenName = new Map();
        const seenHref = new Map();
        const nameOf = (el) => (el.getAttribute('aria-label') || textOf(el) || el.value || '')
            .toLowerCase()
            .replace(/\d+/g, '#')
            .replace(/\s+/g, ' ')
            .trim();
        // App-store badges (App Store, Google Play, and the like) are one action, "get the app", however many stores.
        const STORE_HREF = /^https?:\/\/(apps\.apple\.com|itunes\.apple\.com|play\.google\.com|(www\.)?microsoft\.com\/store|apps\.microsoft\.com|(www\.)?amazon\.[a-z.]+\/.*appstore|appgallery\.huawei\.com|f-droid\.org)/i;
        const STORE_NAME = /\b(app store|google play|play store|microsoft store|appgallery|f-droid)\b/i;
        const isStore = (el) => (el instanceof HTMLAnchorElement && STORE_HREF.test(el.href)) || STORE_NAME.test(el.getAttribute('aria-label') || textOf(el));
        const hrefOf = (el) => {
            if (!(el instanceof HTMLAnchorElement))
                return '';
            const h = el.getAttribute('href') ?? '';
            if (!h || h === '#')
                return '';
            if (isStore(el))
                return 'store:';
            return el.href.replace(/\/$/, '');
        };
        // A skip link, or anything visually hidden until it is focused, is not on the first screen.
        const isSkipLink = (el) => el instanceof HTMLAnchorElement && /^#./.test(el.getAttribute('href') ?? '') && /^(skip|jump)\b/i.test(textOf(el) || el.getAttribute('aria-label') || '');
        const visuallyHidden = (el) => {
            for (let n = el; n && n !== document.body; n = n.parentElement) {
                const cs = getComputedStyle(n);
                if (cs.position === 'absolute' && /^rect\(\s*0(px)?[,\s]+0(px)?[,\s]+0(px)?[,\s]+0(px)?\s*\)$/.test(cs.clip))
                    return true;
                if (/inset\(50%\)|inset\(100%\)/.test(cs.clipPath))
                    return true;
                const nr = n.getBoundingClientRect();
                if (nr.width <= 2 && nr.height <= 2 && cs.overflow === 'hidden')
                    return true;
            }
            return false;
        };
        for (const el of all('button, a[href], input[type="submit"], [role="button"]')) {
            if (!isVisible(el))
                continue;
            const r = el.getBoundingClientRect();
            if (!onFirstScreen(r) || r.width < 60 || r.height < 28)
                continue;
            if (isSkipLink(el) || visuallyHidden(el))
                continue;
            if (el.closest('[class*="logo" i], [class*="brand" i], [class*="wordmark" i]'))
                continue; // a filled logo is not an action
            const bg = rgba(getComputedStyle(el).backgroundColor);
            if (bg[3] < 0.9 || ratio(bg, pageBg) < 1.6)
                continue;
            const key = keyOf(bg);
            const names = seenName.get(key) ?? new Set();
            const hrefs = seenHref.get(key) ?? new Set();
            seenName.set(key, names);
            seenHref.set(key, hrefs);
            const store = isStore(el);
            const name = store ? 'store:' : nameOf(el);
            const href = hrefOf(el);
            const repeat = (name !== '' && names.has(name)) || (href !== '' && hrefs.has(href));
            if (name)
                names.add(name);
            if (href)
                hrefs.add(href);
            if (repeat)
                continue;
            const list = filled.get(key) ?? [];
            list.push(el);
            filled.set(key, list);
        }
        for (const list of filled.values()) {
            const first = list[0];
            if (list.length > 2 && first) {
                add('competing-actions', 'P2', first, list.length + ' different filled actions in the same colour are visible on the first screen; one primary action should stand out. (Repeats of one action, such as a Book button on each row, links to the same place, or a set of app-store badges, count once.)');
            }
        }
    });
    rule('first-screen-no-action', () => {
        // Product UI and reading pages (a long article) need no action on the first screen.
        if (isProductUI() || all('article').some((a) => textOf(a).length > 1500))
            return;
        const found = all('button, input[type="submit"], input[type="button"], [role="button"], a[href]').some((el) => {
            if (el.hasAttribute('aria-expanded') || !isVisible(el))
                return false;
            const r = el.getBoundingClientRect();
            if (!onFirstScreen(r) || r.width < 60 || r.height < 28)
                return false;
            const name = textOf(el) || el.getAttribute('aria-label') || el.value || '';
            if (name.trim().length < 2)
                return false;
            if (el.tagName !== 'A')
                return true;
            const cs = getComputedStyle(el);
            const bg = rgba(cs.backgroundColor);
            const behind = el.parentElement ? backgroundOf(el.parentElement) : null;
            if (bg[3] >= 0.5 && (!behind || ratio(over(bg, behind), behind) >= 1.1))
                return true; // a filled link
            return parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none' && parseFloat(cs.paddingLeft) >= 8; // an outlined link
        });
        if (!found)
            add('first-screen-no-action', 'P2', null, 'No button or button-styled link is visible on the first screen at ' + vw + 'px; the main action should be reachable without scrolling.');
    });
    rule('first-screen-nothing-large', () => {
        if (vw < 1280 || isProductUI())
            return;
        const area = vw * vh;
        const big = (r) => {
            const w = Math.min(r.right, vw) - Math.max(r.left, 0);
            const h = Math.min(r.bottom, vh) - Math.max(r.top, 0);
            return w > 0 && h > 0 && w * h >= area * 0.15;
        };
        if (textEls.some((el) => parseFloat(getComputedStyle(el).fontSize) >= 56 && onFirstScreen(el.getBoundingClientRect())))
            return;
        for (const el of all('img, svg, canvas, video, picture, iframe')) {
            if (!el.parentElement?.closest('svg') && isVisible(el) && big(el.getBoundingClientRect()))
                return;
        }
        for (const s of groundSamples())
            if (!s.colour && s.el && big(s.el.getBoundingClientRect()))
                return; // a background picture
        add('first-screen-nothing-large', 'P3', null, 'The first screen has no picture covering at least 15% of it and no text of 56px or more, so nothing leads the eye (slips.md).');
    });
    let buttonMemo = null;
    function filledButtonGroups() {
        if (buttonMemo)
            return buttonMemo;
        const groups = new Map();
        const skip = '[class*="logo" i], [class*="brand" i], [class*="wordmark" i], [role="tablist"], [role="toolbar"], [role="radiogroup"], [aria-hidden="true"]';
        for (const el of all('button, a[href], input[type="submit"], input[type="button"], [role="button"]')) {
            if (!isVisible(el) || isScreenReaderOnly(el) || el.closest(skip))
                continue;
            if (el.hasAttribute('aria-pressed') || el.hasAttribute('aria-expanded') || el.hasAttribute('aria-haspopup') || el.hasAttribute('disabled'))
                continue;
            const r = el.getBoundingClientRect();
            if (r.width < 60 || r.height < 28 || r.height > 80 || r.width > 480)
                continue; // not a dot, not a card
            const name = (textOf(el) || el.getAttribute('aria-label') || el.value || '').trim();
            if (name.length < 2 || name.length > 40)
                continue;
            const cs = getComputedStyle(el);
            const bg = rgba(cs.backgroundColor);
            if (bg[3] < 0.9)
                continue;
            const behind = el.parentElement ? backgroundOf(el.parentElement) : null;
            if (behind && ratio(bg, behind) < 1.3)
                continue; // the fill does not stand out, so it is not a filled style
            const h = Math.round(r.height);
            const raw = cs.borderTopLeftRadius;
            const radius = raw.endsWith('%') ? (parseFloat(raw) / 100) * Math.min(r.width, r.height) : parseFloat(raw) || 0;
            const corner = radius >= h / 2 - 1 ? 'fully round' : radius < 2 ? 'square' : radius < 8 ? 'slightly rounded' : radius < 16 ? 'rounded' : 'very rounded';
            const key = keyOf(bg);
            const g = groups.get(key) ?? { colour: bg, els: [], heights: [], corners: new Set() };
            g.els.push(el);
            g.heights.push(h);
            g.corners.add(corner);
            groups.set(key, g);
        }
        buttonMemo = Array.from(groups.values());
        return buttonMemo;
    }
    const saturatedFill = (c) => {
        const [, s, l] = hsl(c);
        return s > 0.35 && l > 0.2 && l < 0.85;
    };
    rule('button-styles', () => {
        if (isProductUI())
            return;
        const groups = filledButtonGroups();
        for (const g of groups) {
            if (g.els.length < 2)
                continue;
            const lo = Math.min(...g.heights);
            const hi = Math.max(...g.heights);
            const problems = [];
            if (hi - lo > 8)
                problems.push('heights from ' + lo + ' to ' + hi + 'px');
            if (g.corners.size > 1)
                problems.push('corners ' + Array.from(g.corners).join(' and '));
            if (problems.length) {
                add('button-styles', 'P3', g.els[0] ?? null, g.els.length + ' filled buttons in rgb(' + keyOf(g.colour) + ') differ: ' + problems.join(', ') +
                    '. One button style and one size for the primary action across the page (craft.md); confirm any difference was meant.');
            }
        }
        const accents = groups.filter((g) => saturatedFill(g.colour));
        if (accents.length > 1) {
            add('button-styles', 'P3', accents[1]?.els[0] ?? null, accents.length + ' filled button styles in different strong colours (' +
                accents.map((g) => 'rgb(' + keyOf(g.colour) + ')').join(', ') + '); one primary style and one quieter style for the rest (craft.md).');
        }
    });
    rule('primary-button-height', () => {
        if (vw < 1024 || isProductUI())
            return;
        const groups = filledButtonGroups();
        const strong = groups.filter((g) => saturatedFill(g.colour));
        const primary = (strong.length ? strong : groups).slice().sort((a, b) => b.els.length - a.els.length)[0];
        if (!primary)
            return;
        const sorted = primary.heights.slice().sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
        if (median && (median < 32 || median > 64)) {
            add('primary-button-height', 'P3', primary.els[0] ?? null, 'The primary button is about ' + median + 'px tall at ' + vw +
                'px; about 40-48px is the guidance on desktop (craft.md), so confirm the size was meant.');
        }
    });
    // ---- pictures: one picture style per page (imagery.md) ------------------------------------
    // A heuristic, so only a prompt: a photograph (a JPEG, WebP or AVIF image, a video, or a photo
    // background) and a large drawn scene (an SVG image, or an inline SVG of many shapes with
    // little text) on the same page. Charts, diagrams, maps, logos and icons carry information
    // and are allowed in any register.
    rule('mixed-pictures', () => {
        if (isProductUI())
            return;
        const photoFile = /\.(jpe?g|webp|avif|heic)(\?|#|$)/i;
        const drawnFile = /\.svg(\?|#|$)|^data:image\/svg/i;
        const big = (el) => {
            const r = el.getBoundingClientRect();
            return r.width >= 240 && r.height >= 160;
        };
        const informational = (el) => {
            for (let n = el, i = 0; n && i < 4; n = n.parentElement, i++) {
                const words = n.id + ' ' + (n.getAttribute('class') ?? '') + ' ' + (n.getAttribute('aria-label') ?? '') + ' ' + (n.getAttribute('alt') ?? '');
                if (/chart|graph|plot|diagram|map|route|logo|icon|flag|schema|figure-data/i.test(words))
                    return true;
            }
            return false;
        };
        let photo = null;
        let drawing = null;
        for (const el of all('img')) {
            if (!isVisible(el) || !big(el))
                continue;
            const src = el.currentSrc || el.src;
            if (photoFile.test(src))
                photo ??= el;
            else if (drawnFile.test(src) && !informational(el))
                drawing ??= el;
        }
        if (!photo)
            photo = all('video').find((el) => isVisible(el) && big(el)) ?? null;
        if (!photo) {
            for (const el of pool()) {
                const bi = getComputedStyle(el).backgroundImage;
                if (!bi || bi === 'none' || !bi.includes('url('))
                    continue;
                const urls = Array.from(bi.matchAll(/url\(\s*["']?([^"')]+)/g)).map((m) => m[1] ?? '');
                if (urls.some((u) => photoFile.test(u)) && isVisible(el) && big(el)) {
                    photo = el;
                    break;
                }
            }
        }
        if (!photo)
            return;
        if (!drawing) {
            for (const svg of all('svg')) {
                if (svg.parentElement?.closest('svg') || !isVisible(svg) || !big(svg) || informational(svg))
                    continue;
                const shapes = svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line').length;
                const labels = svg.querySelectorAll('text').length;
                if (shapes >= 12 && labels < 3) {
                    drawing = svg;
                    break;
                }
            }
        }
        if (drawing) {
            const photoName = photo instanceof HTMLImageElement ? (photo.currentSrc || photo.src).split(/[?#]/)[0]?.split('/').pop() ?? '' : '';
            add('mixed-pictures', 'P3', drawing, 'A large drawn illustration shares the page with photographs (' + (photoName || describe(photo)) +
                '). A prompt, not a failure: one picture style per page unless the user asked for both; a diagram or map that carries information is fine (imagery.md).');
        }
    });
    // ---- layout -------------------------------------------------------------------------
    // A desktop page whose content all sits in a narrow centred column looks small.
    // Measured from the edges of visible text and media, so full-bleed backgrounds
    // with nothing on their edges do not count as content.
    rule('narrow-content', () => {
        if (vw < 1280)
            return;
        const root = document.querySelector('main') ?? document.body;
        const rootText = textOf(root).replace(/\s+/g, ' ');
        if (rootText.length < 200)
            return;
        let left = Infinity;
        let right = -Infinity;
        const extend = (r) => {
            if (r.width < 2 || r.height < 2)
                return;
            left = Math.min(left, Math.max(0, r.left));
            right = Math.max(right, Math.min(vw, r.right));
        };
        const range = document.createRange();
        for (const el of textEls) {
            if (!root.contains(el) || getComputedStyle(el).position === 'fixed')
                continue;
            range.selectNodeContents(el);
            extend(range.getBoundingClientRect());
        }
        for (const el of all('img, svg, canvas, video, input:not([type="hidden"]), select, textarea, button, table', root)) {
            if (el.parentElement?.closest('svg') || !isVisible(el) || getComputedStyle(el).position === 'fixed')
                continue;
            extend(el.getBoundingClientRect());
        }
        const used = Math.round(right - left);
        if (used > 0 && used < vw * 0.62) {
            add('narrow-content', 'P2', null, 'Content is ' + used + 'px wide in a ' + vw +
                'px viewport: content sits in a narrow column; widen the layout container or let sections use the width (craft.md).');
        }
    });
    rule('fixed-cover', () => {
        if (vw > 480)
            return;
        const spans = [];
        let example = null;
        for (const el of pool()) {
            const cs = getComputedStyle(el);
            if (cs.position !== 'fixed' && cs.position !== 'sticky')
                continue;
            const r = el.getBoundingClientRect();
            if (r.width < vw * 0.5 || r.right <= 0 || r.left >= vw)
                continue;
            // A sticky element covers only once it is stuck at its offset.
            if (cs.position === 'sticky') {
                const stuckTop = cs.top !== 'auto' && Math.abs(r.top - parseFloat(cs.top)) < 1;
                const stuckBottom = cs.bottom !== 'auto' && Math.abs(vh - r.bottom - parseFloat(cs.bottom)) < 1;
                if (!stuckTop && !stuckBottom)
                    continue;
            }
            const top = Math.max(0, r.top);
            const bottom = Math.min(vh, r.bottom);
            if (bottom - top <= 0 || !isVisible(el))
                continue;
            spans.push([top, bottom]);
            example ??= el;
        }
        spans.sort((a, b) => a[0] - b[0]);
        let covered = 0;
        let end = -Infinity;
        for (const [top, bottom] of spans) {
            const start = Math.max(top, end);
            if (bottom > start)
                covered += bottom - start;
            end = Math.max(end, bottom);
        }
        if (vh > 0 && covered > vh * 0.25) {
            add('fixed-cover', 'P2', example, 'Fixed and sticky bars cover ' + Math.round((covered / vh) * 100) + '% of the screen height at this width; keep them well under a quarter.');
        }
    });
    rule('near-miss-alignment', () => {
        const root = document.querySelector('main') ?? document.body;
        const blocks = [];
        for (const section of Array.from(root.children)) {
            blocks.push(section);
            for (const kid of Array.from(section.children))
                blocks.push(kid);
        }
        const edges = [];
        for (const el of blocks) {
            if (!isVisible(el))
                continue;
            const cs = getComputedStyle(el);
            if (cs.position === 'absolute' || cs.position === 'fixed' || cs.transform !== 'none')
                continue;
            const r = el.getBoundingClientRect();
            if (r.width < 40 || r.height < 8 || (r.left <= 1 && r.right >= vw - 1))
                continue;
            edges.push({ el, left: r.left });
        }
        const tally = new Map();
        for (const e of edges)
            tally.set(Math.round(e.left), (tally.get(Math.round(e.left)) ?? 0) + 1);
        let common = 0;
        let most = 0;
        for (const [left, n] of tally) {
            if (n > most) {
                most = n;
                common = left;
            }
        }
        if (most < 4)
            return;
        let reported = 0;
        for (const e of edges) {
            const off = Math.abs(e.left - common);
            if (off < 1.5 || off > 6 || reported >= 3)
                continue;
            reported++;
            add('near-miss-alignment', 'P3', e.el, 'Left edge is at ' + Math.round(e.left) + 'px, ' + Math.round(off) + 'px off the common edge at ' + common +
                'px. A prompt, not a failure: confirm the offset is meant.');
        }
    });
    // ---- tables ---------------------------------------------------------------------------
    rule('table-headers', () => {
        for (const table of all('table')) {
            if (!isVisible(table) || /^(presentation|none)$/.test(table.getAttribute('role') ?? ''))
                continue;
            const rows = Array.from(table.rows);
            const cols = Math.max(0, ...rows.map((r) => r.cells.length));
            if (rows.length <= 2 || cols <= 2)
                continue;
            if (table.querySelector('th, [role="columnheader"], [role="rowheader"]'))
                continue;
            add('table-headers', 'P2', table, 'Data table with ' + rows.length + ' rows and ' + cols + ' columns has no header cells (th); screen readers cannot say which column a value is in.');
        }
    });
    rule('table-numbers', () => {
        const numeric = /^[-+−]?[$€£¥]?\s?[-+−]?\(?\d[\d,.\s]*\)?\s?(%|[kKmMbB]|bn|x)?$/;
        const tabularByDefault = (cs) => {
            if (!ctx)
                return false;
            ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
            return Math.abs(ctx.measureText('1111').width - ctx.measureText('0000').width) < 0.5;
        };
        for (const table of all('table')) {
            if (!isVisible(table))
                continue;
            let rows = Array.from(table.tBodies).flatMap((b) => Array.from(b.rows));
            if (!rows.length)
                rows = Array.from(table.rows).filter((r) => !r.closest('thead') && !!r.querySelector('td'));
            rows = rows.filter((r) => Array.from(r.cells).every((c) => c.colSpan === 1));
            const cols = Math.min(30, Math.max(0, ...rows.map((r) => r.cells.length)));
            for (let c = 0; c < cols; c++) {
                const cells = rows.map((r) => r.cells[c]).filter((cell) => !!cell && cell.tagName === 'TD');
                const filledCells = cells.filter((cell) => textOf(cell));
                const nums = filledCells.filter((cell) => numeric.test(textOf(cell)));
                const first = nums[0];
                if (!first || nums.length < 3 || nums.length < filledCells.length * 0.8)
                    continue;
                const cs = getComputedStyle(first);
                const align = cs.textAlign;
                const kid = first.firstElementChild;
                const kidCs = kid ? getComputedStyle(kid) : null;
                const right = align === 'right' ||
                    (align === 'end' && cs.direction === 'ltr') ||
                    ((align === 'start' || align === 'left') && cs.direction === 'rtl') ||
                    (!!kidCs && (kidCs.textAlign === 'right' || /end|right/.test(kidCs.justifyContent)));
                const tabular = /tabular-nums/.test(cs.fontVariantNumeric) || /tnum/.test(cs.fontFeatureSettings) ||
                    /mono|courier|consolas|menlo|monaco/i.test(cs.fontFamily) || tabularByDefault(cs);
                const problems = [];
                if (!right)
                    problems.push('not right-aligned');
                if (!tabular)
                    problems.push('not in tabular figures');
                if (problems.length) {
                    add('table-numbers', 'P3', first, 'Column ' + (c + 1) + ' holds numbers that are ' + problems.join(' and ') + '; right-align numbers and use tabular figures so digits line up.');
                }
            }
        }
    });
    // ---- focus: run last, because it moves focus and scrolls ----------------------------
    rule('focus-removed', () => {
        const selector = 'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
        const targets = all(selector)
            .filter((el) => !el.hasAttribute('onfocus') && !el.hasAttribute('onfocusin') && isVisible(el) && !isScreenReaderOnly(el))
            .slice(0, 40);
        if (!targets.length)
            return;
        const before = document.activeElement;
        const sx = window.scrollX;
        const sy = window.scrollY;
        // Remember every scrolled container around a target, so any that move can be put back.
        const scrollers = new Map();
        for (const el of targets) {
            for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
                if (!scrollers.has(n) && (n.scrollHeight > n.clientHeight || n.scrollWidth > n.clientWidth))
                    scrollers.set(n, [n.scrollLeft, n.scrollTop]);
            }
        }
        const look = (el) => {
            if (!el)
                return '';
            const cs = getComputedStyle(el);
            const parts = [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow, cs.borderTopColor, cs.borderBottomColor, cs.borderLeftColor,
                cs.borderTopWidth, cs.borderBottomWidth, cs.backgroundColor, cs.backgroundImage, cs.color, cs.textDecorationLine];
            for (const p of ['::before', '::after']) {
                const ps = getComputedStyle(el, p);
                parts.push(ps.content, ps.opacity, ps.backgroundColor, ps.transform, ps.boxShadow, ps.borderBottomColor);
            }
            return parts.join('|');
        };
        let measured = 0;
        try {
            for (const el of targets) {
                // Turn transitions off for a moment, so the focused style can be read at once.
                const frozen = [];
                for (const n of [el, el.parentElement]) {
                    if (!(n instanceof HTMLElement))
                        continue;
                    frozen.push([n, n.getAttribute('style')]);
                    n.style.setProperty('transition', 'none', 'important');
                }
                try {
                    const off = look(el) + '#' + look(el.parentElement);
                    // Only controls already on screen are tested for being hidden; nothing is scrolled into view.
                    const r = el.getBoundingClientRect();
                    const cx = r.left + r.width / 2;
                    const cy = r.top + r.height / 2;
                    const inView = cx > 0 && cy > 0 && cx < window.innerWidth && cy < window.innerHeight;
                    el.focus({ focusVisible: true, preventScroll: true });
                    // Only judge focus the browser shows as keyboard focus; otherwise a :focus-visible style would not apply.
                    if (document.activeElement !== el || !el.matches(':focus-visible'))
                        continue;
                    measured++;
                    const on = look(el) + '#' + look(el.parentElement);
                    if (on === off) {
                        add('focus-removed', 'P1', el, 'Nothing visible changes when this control takes keyboard focus (outline, shadow, border and background stay the same).');
                    }
                    if (inView) {
                        const hit = document.elementFromPoint(cx, cy);
                        if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
                            let cover = hit;
                            while (cover && !['fixed', 'sticky'].includes(getComputedStyle(cover).position))
                                cover = cover.parentElement;
                            if (cover && !cover.contains(el))
                                add('focus-obscured', 'P2', el, 'When focused, this control is hidden behind ' + describe(cover) + ', which is fixed or sticky.');
                        }
                    }
                }
                finally {
                    el.blur();
                    getComputedStyle(el).outlineStyle; // settle the unfocused style before transitions return
                    for (const [n, style] of frozen) {
                        if (style === null)
                            n.removeAttribute('style');
                        else
                            n.setAttribute('style', style);
                    }
                }
            }
        }
        finally {
            // Put the page back as it was: focus, the window's scroll, and every container that moved.
            if (before instanceof HTMLElement && before !== document.body)
                before.focus({ preventScroll: true });
            else if (document.activeElement instanceof HTMLElement)
                document.activeElement.blur();
            for (const [n, [left, top]] of scrollers) {
                if (n.scrollLeft !== left || n.scrollTop !== top) {
                    n.scrollLeft = left;
                    n.scrollTop = top;
                }
            }
            if (window.scrollX !== sx || window.scrollY !== sy)
                window.scrollTo(sx, sy);
        }
        if (!measured)
            notes.push('Keyboard focus could not be shown in this page, so focus visibility was not checked.');
    });
    // ---- result ---------------------------------------------------------------
    let dropped = 0;
    for (const n of Object.values(counts))
        if (n > MAX_PER_RULE)
            dropped += n - MAX_PER_RULE;
    if (dropped)
        notes.push(dropped + ' further findings were omitted (more than ' + MAX_PER_RULE + ' per rule); see countsByRule.');
    notes.push('Not checked: keyboard order, states, whether forms complete, overlapping or colliding labels, and anything about taste. Focus is checked on the first 40 controls only. Check the rest by hand.');
    return {
        url: location.href,
        viewport: vw + 'x' + vh,
        summary: severityCounts,
        countsByRule: counts,
        findings,
        notes,
    };
})();

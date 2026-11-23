// Generated from src/scripts/inventory.ts by `npm run build`. Edit the TypeScript, not this file.
"use strict";
/*
 * Argus inventory. Runs inside a rendered page and measures the design system
 * it actually uses: which fonts, sizes, weights, colours, radii and control
 * heights appear, and how often. Use it to learn an existing product's system
 * before adding to it, and again on the new screen to see where it departs.
 *
 * `argus-skill inventory <url>` runs it for you. It reads the page and changes nothing.
 *
 * Like check.ts, this file has no imports or exports: it must compile to a
 * single expression whose value is the result.
 */
(function argusInventory() {
    // Run directly under Node (`node inventory.js`, `--help`), there is no page: say how to run it, and exit 0.
    if (typeof document === 'undefined') {
        console.log('inventory.js runs inside a rendered page, not on its own: use `node shot.js <url-or-file> --inventory --no-shots` or `argus-skill inventory <url-or-file>`.');
        return null;
    }
    const tally = new Map();
    const bump = (group, value, by = 1) => {
        if (!value)
            return;
        let g = tally.get(group);
        if (!g) {
            g = new Map();
            tally.set(group, g);
        }
        g.set(value, (g.get(value) ?? 0) + by);
    };
    const top = (group, n) => Array.from(tally.get(group) ?? [])
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([value, count]) => ({ value, count }));
    const visible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    };
    const px = (v) => (Math.round(parseFloat(v) * 10) / 10 || 0) + 'px';
    const firstFamily = (v) => (v.split(',')[0] ?? '').replace(/["']/g, '').trim();
    const transparent = (c) => c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
    // Text: weighted by how many characters use each value, so body text outweighs a stray label.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
        const text = (walker.currentNode.nodeValue ?? '').trim();
        const el = walker.currentNode.parentElement;
        if (!text || !el || !visible(el))
            continue;
        if (el.namespaceURI === 'http://www.w3.org/2000/svg' || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName))
            continue;
        const cs = getComputedStyle(el);
        const n = text.length;
        bump('fontFamilies', firstFamily(cs.fontFamily), n);
        bump('fontSizes', px(cs.fontSize), n);
        bump('fontWeights', cs.fontWeight, n);
        bump('textColours', cs.color, n);
        if (cs.textTransform === 'uppercase')
            bump('uppercaseText', 'uppercase', n);
        if (!seen.has(el)) {
            seen.add(el);
            bump('textElements', 'count');
        }
    }
    // Surfaces, borders, radii and shadows: counted per element that shows them.
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
        if (!visible(el))
            continue;
        const cs = getComputedStyle(el);
        if (!transparent(cs.backgroundColor))
            bump('surfaceColours', cs.backgroundColor);
        if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && !transparent(cs.borderTopColor)) {
            bump('borderColours', cs.borderTopColor);
            bump('borderWidths', px(cs.borderTopWidth));
        }
        if (parseFloat(cs.borderTopLeftRadius) > 0)
            bump('radii', px(cs.borderTopLeftRadius));
        if (cs.boxShadow && cs.boxShadow !== 'none')
            bump('shadows', cs.boxShadow);
    }
    // Controls and table rows: their heights are what makes a product feel dense or loose.
    for (const el of Array.from(document.querySelectorAll('button, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, [role="button"]'))) {
        if (visible(el))
            bump('controlHeights', Math.round(el.getBoundingClientRect().height) + 'px');
    }
    for (const el of Array.from(document.querySelectorAll('tbody tr'))) {
        if (visible(el))
            bump('tableRowHeights', Math.round(el.getBoundingClientRect().height) + 'px');
    }
    const bodyStyle = getComputedStyle(document.body);
    return {
        url: location.href,
        viewport: window.innerWidth + 'x' + window.innerHeight,
        pageBackground: transparent(bodyStyle.backgroundColor) ? getComputedStyle(document.documentElement).backgroundColor : bodyStyle.backgroundColor,
        fontFamilies: top('fontFamilies', 40),
        fontSizes: top('fontSizes', 40),
        fontWeights: top('fontWeights', 40),
        textColours: top('textColours', 40),
        surfaceColours: top('surfaceColours', 40),
        borderColours: top('borderColours', 40),
        borderWidths: top('borderWidths', 40),
        radii: top('radii', 40),
        shadows: top('shadows', 40),
        controlHeights: top('controlHeights', 40),
        tableRowHeights: top('tableRowHeights', 40),
        usesUppercase: (tally.get('uppercaseText')?.get('uppercase') ?? 0) > 0,
    };
})();

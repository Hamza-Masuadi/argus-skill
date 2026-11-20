#!/usr/bin/env node
// Generated from src/scripts/contrast.ts by `npm run build`. Edit the TypeScript, not this file.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseHex = parseHex;
exports.luminance = luminance;
exports.contrastRatio = contrastRatio;
function parseHex(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m || !m[1])
        return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance(rgb) {
    const lin = (x) => {
        const v = x / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}
function contrastRatio(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function main(pairs) {
    if (!pairs.length) {
        console.log('Usage: node contrast.js "#text/#background" [more pairs...]');
        return 1;
    }
    let failed = false;
    for (const pair of pairs) {
        const parts = pair.split('/');
        const fg = parts[0] !== undefined ? parseHex(parts[0]) : null;
        const bg = parts[1] !== undefined ? parseHex(parts[1]) : null;
        if (parts.length !== 2 || !fg || !bg) {
            console.log(pair + '  could not be read; use six-digit hex like "#14233B/#F1F4F6"');
            failed = true;
            continue;
        }
        const r = contrastRatio(fg, bg);
        const body = r >= 4.5;
        if (!body)
            failed = true;
        console.log(`${pair}  ${r.toFixed(2)}:1  body text ${body ? 'pass' : 'FAIL'}, large text and controls ${r >= 3 ? 'pass' : 'FAIL'}`);
    }
    return failed ? 2 : 0;
}
if (require.main === module)
    process.exit(main(process.argv.slice(2)));

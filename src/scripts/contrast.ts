#!/usr/bin/env node
/*
 * Argus contrast helper. No dependencies, no browser.
 * Usage: node contrast.js "#14233B/#F1F4F6" "#5B6862/#FFFFFF" ...
 * Each argument is text colour / background colour, six-digit hex.
 * Prints the WCAG contrast ratio and whether it passes for body text (4.5:1)
 * and for large text or control boundaries (3:1).
 */
type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(rgb: Rgb): number {
  const lin = (x: number): number => {
    const v = x / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const USAGE = [
  'Usage: node contrast.js "#text/#background" [more pairs...]',
  '',
  'Each pair is a text colour and a background colour in six-digit hex. Prints the WCAG',
  'contrast ratio and whether it passes for body text (4.5:1) and for large text or',
  'control boundaries (3:1). Exit code 2 when any pair fails body text.',
].join('\n');

export function main(pairs: string[]): number {
  if (pairs.includes('--help') || pairs.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  if (!pairs.length) {
    console.log(USAGE);
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
    if (!body) failed = true;
    console.log(`${pair}  ${r.toFixed(2)}:1  body text ${body ? 'pass' : 'FAIL'}, large text and controls ${r >= 3 ? 'pass' : 'FAIL'}`);
  }
  return failed ? 2 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

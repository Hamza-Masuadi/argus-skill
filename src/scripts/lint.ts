#!/usr/bin/env node
/*
 * Argus source check. For when nothing can be rendered.
 * Scans HTML, CSS and component files for slips that are visible in source.
 * No dependencies, no network, reads only the files you name, changes nothing.
 *
 * Usage: node lint.js <file-or-folder> [more...]
 *
 * It is most reliable on plain HTML and CSS. In component files it checks
 * less (utility-class and inline-style sizes are not read), so a quiet result
 * there means little.
 *
 * It reads text, not a rendered page, so it cannot see layout: overflow,
 * collapsed columns, overlapping labels and real contrast need a screenshot
 * or the in-page checker. Treat a clean result as "nothing obvious in the source".
 * Severity: P1 likely problem, P2 roughness, "tell" = common default; judge it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export type Severity = 'P1' | 'P2' | 'tell';

export interface Finding {
  sev: Severity;
  rule: string;
  where: string;
  msg: string;
}

export interface SourceFile {
  path: string;
  text: string;
}

export interface LintResult {
  findings: Finding[];
  counts: Record<string, number>;
}

const EXT = /\.(html?|css|scss|less|jsx|tsx|vue|svelte|astro)$/i;
const SKIP_DIR = /^(node_modules|\.git|dist|build|out|\.next|\.nuxt|coverage|vendor)$/;
const MAX_PER_RULE = 5;
const SLOP = ['elevate', 'seamless', 'seamlessly', 'unlock', 'supercharge', 'effortless', 'effortlessly', 'reimagine', 'revolutionize',
  'game-changing', 'cutting-edge', 'next-level', 'world-class', 'unleash', 'empower'];

/** Find the files worth reading under a file or folder. */
export function collect(target: string, acc: string[] = []): string[] {
  let st: fs.Stats;
  try {
    st = fs.statSync(target);
  } catch {
    console.log('Not found: ' + target);
    return acc;
  }
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(target)) {
      if (!SKIP_DIR.test(name)) collect(path.join(target, name), acc);
    }
  } else if (EXT.test(target) && st.size < 2 * 1024 * 1024) {
    acc.push(target);
  }
  return acc;
}

const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function each(text: string, re: RegExp, fn: (m: RegExpExecArray) => void): void {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) fn(m);
}

/** Check a set of source files. Pure: it reads nothing from disk. */
export function lint(files: SourceFile[]): LintResult {
  const findings: Finding[] = [];
  const counts: Record<string, number> = {};
  const add = (sev: Severity, rule: string, file: string, line: number, msg: string): void => {
    const n = (counts[rule] ?? 0) + 1;
    counts[rule] = n;
    if (n <= MAX_PER_RULE) findings.push({ sev, rule, where: file + ':' + line, msg });
  };

  let anyMotion = false;
  let anyReduced = false;
  let anyFocusStyle = false;
  const outlineNone: Array<{ file: string; line: number }> = [];

  for (const { path: file, text } of files) {
    const isHtml = /\.html?$/i.test(file);

    // Small text.
    each(text, /font-size\s*:\s*([0-9.]+)(px|rem|em)\b/gi, (m) => {
      const value = parseFloat(m[1] ?? '');
      const unit = (m[2] ?? '').toLowerCase();
      const px = unit === 'px' ? value : unit === 'rem' ? value * 16 : null;
      if (px !== null && px > 0 && px < 12) add('P2', 'small-text', file, lineOf(text, m.index), `font-size ${m[1]}${m[2]} is under 12px.`);
    });

    // Motion and its reduced-motion counterpart. Only real animation counts:
    // a hover transition is feedback and needs no reduced-motion rule.
    if (/@keyframes|animation(-name)?\s*:(?!\s*none)/i.test(text)) anyMotion = true;
    if (/prefers-reduced-motion/i.test(text)) anyReduced = true;
    each(text, /transition\s*:\s*all\b/gi, (m) => {
      add('P2', 'transition-all', file, lineOf(text, m.index), '"transition: all" animates layout properties too; name the properties.');
    });
    each(text, /animation[^;{}]*\binfinite\b/gi, (m) => {
      add('P2', 'infinite-animation', file, lineOf(text, m.index), 'An animation loops forever; make sure it shows something live and can be paused.');
    });

    // Focus. A replacement focus style is a focus rule that sets a visible outline, shadow or border.
    if (/:focus(-visible)?\b[^{]*\{[^}]*(box-shadow\s*:(?!\s*none)|border[a-z-]*\s*:(?!\s*(none|0)\b)|outline\s*:(?!\s*(none|0)\b))/i.test(text)) {
      anyFocusStyle = true;
    }
    each(text, /outline\s*:\s*(none|0)\b/gi, (m) => {
      outlineNone.push({ file, line: lineOf(text, m.index) });
    });

    // Viewport and zoom.
    if (isHtml && /<html[\s>]/i.test(text)) {
      if (!/<meta[^>]+name=["']viewport["']/i.test(text)) add('P1', 'viewport-meta', file, 1, 'No viewport meta tag; the page will not fit phone screens.');
      const html = /<html([^>]*)>/i.exec(text);
      if (html && !/\blang\s*=/.test(html[1] ?? '')) add('P2', 'lang', file, lineOf(text, html.index), 'The html element has no lang attribute.');
      const h1s = (text.match(/<h1[\s>]/gi) ?? []).length;
      const otherHeads = /<h[2-6][\s>]/i.test(text);
      // An empty app shell has no headings at all; that is not this problem.
      if (h1s > 1 || (h1s === 0 && otherHeads)) add('P2', 'h1-count', file, 1, `Page has ${h1s} h1 elements; it should have one.`);
    }
    each(text, /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0+)?(?![\d.])/gi, (m) => {
      add('P1', 'zoom-blocked', file, lineOf(text, m.index), 'The viewport tag blocks pinch zoom.');
    });
    each(text, /\b(height|min-height)\s*:\s*100vh\b/gi, (m) => {
      if (/100dvh/.test(text.slice(m.index, m.index + 160))) return; // a 100vh fallback followed by 100dvh is correct
      add('P2', 'vh-units', file, lineOf(text, m.index), '100vh is taller than the visible area on phones; use 100dvh.');
    });

    // Images and forms.
    each(text, /<img\b[^>]*>/gi, (m) => {
      if (!isHtml && /[{}]/.test(m[0])) return; // component syntax can end the match early; do not guess
      if (!/\balt\s*=/.test(m[0])) add('P1', 'img-alt', file, lineOf(text, m.index), 'Image has no alt attribute (use alt="" if decorative).');
    });
    each(text, /<form\b[^>]*\baction\s*=\s*["']([^"']*)["']/gi, (m) => {
      const action = m[1] ?? '';
      if (/^mailto:/i.test(action)) {
        add('P1', 'form-mailto', file, lineOf(text, m.index), 'Form submits to a mailto: address: it opens an email client and shows no confirmation.');
      } else if (isHtml && action && action !== '#') {
        add('P2', 'form-endpoint', file, lineOf(text, m.index), `Form posts to "${action}". Confirm that address exists; if not, validate and show a confirmation instead.`);
      }
    });
    each(text, /<(input|textarea)\b[^>]*\bplaceholder\s*=/gi, (m) => {
      const tag = m[0] + text.slice(m.index + m[0].length, text.indexOf('>', m.index) + 1);
      if (/\bid\s*=\s*\{/.test(tag)) return; // a computed id cannot be matched to its label from source
      const before = text.slice(0, m.index);
      if (before.lastIndexOf('<label') > before.lastIndexOf('</label')) return; // wrapped in its label
      const id = /\bid\s*=\s*["']([^"']+)["']/.exec(tag)?.[1];
      const named = id ? new RegExp(`(for|htmlFor)\\s*=\\s*["']${escapeRegExp(id)}["']`).test(text) : false;
      if (!/aria-label(ledby)?\s*=/.test(tag) && !named) {
        add('P1', 'placeholder-label', file, lineOf(text, m.index), 'Field has a placeholder but no label that names it.');
      }
    });
    each(text, /<h[1-6]\b[^>]*>(?:(?!<\/h[1-6]>)[\s\S])*?<(select|button|input)\b/gi, (m) => {
      add('P2', 'control-in-heading', file, lineOf(text, m.index), `A ${m[1]} sits inside a heading; its text becomes part of the heading.`);
    });

    // Content.
    each(text, /lorem ipsum/gi, (m) => {
      add('P1', 'placeholder-text', file, lineOf(text, m.index), 'Lorem ipsum placeholder text.');
    });
    each(text, /\b(John|Jane) Doe\b|\bAcme\b/g, (m) => {
      add('tell', 'stock-names', file, lineOf(text, m.index), `Stock placeholder name "${m[0]}".`);
    });
    const visible = text.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');
    const slop = SLOP.filter((w) => new RegExp('\\b' + w + '\\b', 'i').test(visible));
    if (isHtml && slop.length) add('tell', 'filler-words', file, 1, 'Marketing filler: ' + slop.join(', ') + '.');
    if (isHtml && /\p{Emoji_Presentation}/u.test(visible)) add('tell', 'emoji', file, 1, 'Emoji in visible text; if they stand in for icons, use an icon set.');

    // Colours written out by hand instead of through tokens.
    const rawColours = new Set<string>();
    for (const line of text.split('\n')) {
      if (/^\s*--[\w-]+\s*:/.test(line)) continue; // a token definition is where raw values belong
      for (const hex of line.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? []) rawColours.add(hex.toLowerCase());
    }
    if (rawColours.size > 12) {
      add('P2', 'raw-colours', file, 1, `${rawColours.size} different colours are written out directly; define them once as tokens and use those.`);
    }

    // Tells visible in CSS.
    each(text, /background-clip\s*:\s*text/gi, (m) => {
      add('tell', 'gradient-text', file, lineOf(text, m.index), 'Text filled with a background (gradient text).');
    });
    const upper = (text.match(/text-transform\s*:\s*uppercase/gi) ?? []).length;
    if (upper > 6) add('tell', 'all-caps-labels', file, 1, `${upper} rules set text to uppercase; check for small all-caps labels above headings.`);
    each(text, /text-transform\s*:\s*uppercase[^}]*\}/gi, (m) => {
      const block = text.slice(text.lastIndexOf('{', m.index), m.index + m[0].length);
      const size = /font-size\s*:\s*([0-9.]+)px/i.exec(block);
      if (size && parseFloat(size[1] ?? '0') > 20) return; // large display type is set tight on purpose
      if (!/letter-spacing\s*:/i.test(block)) {
        add('P2', 'caps-tracking', file, lineOf(text, m.index), 'All-caps text with no letter-spacing; add about 0.06em.');
      }
    });
    each(text, /letter-spacing\s*:\s*-0?\.(0[5-9]|[1-9])\d*em/gi, (m) => {
      add('P2', 'tight-tracking', file, lineOf(text, m.index), 'Letter-spacing tighter than -0.04em hurts legibility.');
    });
  }

  const first = files[0];
  if (anyMotion && !anyReduced && first) add('P1', 'reduced-motion', first.path, 1, 'The code animates but nothing honours prefers-reduced-motion.');
  if (outlineNone.length && !anyFocusStyle) {
    for (const o of outlineNone.slice(0, MAX_PER_RULE)) add('P1', 'focus-removed', o.file, o.line, 'Focus outline removed and no replacement focus style found.');
  }

  const order: Record<Severity, number> = { P1: 0, P2: 1, tell: 2 };
  findings.sort((a, b) => order[a.sev] - order[b.sev]);
  return { findings, counts };
}

function main(targets: string[]): number {
  const paths: string[] = [];
  for (const t of targets) collect(t, paths);
  if (!paths.length) {
    console.log('Usage: node lint.js <file-or-folder> [more...]');
    return 1;
  }
  const { findings, counts } = lint(paths.map((p) => ({ path: p, text: fs.readFileSync(p, 'utf8') })));
  for (const f of findings) console.log(`${f.sev.padEnd(4)} ${f.where}  ${f.msg}  [${f.rule}]`);
  const extra = Object.entries(counts).filter(([, n]) => n > MAX_PER_RULE).map(([rule, n]) => `${rule} x${n}`);
  if (extra.length) console.log('More of the same not shown: ' + extra.join(', '));
  console.log((findings.length ? '' : 'Nothing obvious in the source. ') + `Checked ${paths.length} file(s).`);
  console.log('Not checked (needs a rendered page): overflow, collapsed columns, overlapping text, real contrast, target sizes, whether forms complete.');
  return findings.some((f) => f.sev === 'P1') ? 2 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

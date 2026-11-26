#!/usr/bin/env node
/*
 * Argus source check. For when nothing can be rendered.
 * Scans HTML, CSS and component files for slips that are visible in source.
 * No dependencies, no network, reads only the files you name, changes nothing.
 *
 * Usage: node lint.js <file-or-folder> [more...] [--app]
 *
 * --app: the files are an app prototype whose screens are switched by URL hash.
 * Several h1 elements are then fine when each sits in its own screen (a hidden
 * section, or one marked as a screen, view, page, route or tab panel), and h1s
 * written inside scripts are the templates of screens drawn one at a time.
 *
 * It is most reliable on plain HTML and CSS. In component files it checks
 * less (utility-class and inline-style sizes are not read), so a quiet result
 * there means little.
 *
 * It reads text, not a rendered page, so it cannot see layout: overflow,
 * collapsed columns, overlapping labels and real contrast need a screenshot
 * or the in-page checker. Treat a clean result as "nothing obvious in the source".
 * Severity: P1 likely problem, P2 roughness, P3 minor, "tell" = common default; judge it.
 * The rule catalogue (`argus-skill rules`) lists every rule id used here.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export type Severity = 'P1' | 'P2' | 'P3' | 'tell';

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

export interface LintOptions {
  /** The files are an app prototype with hash-routed screens (lint.js --app). */
  app?: boolean;
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

const VOID_TAGS = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;
const SCREEN_WORD = /(^|[\s_-])(screen|view|page|route|panel|tabpanel|tab-panel)s?($|[\s_-])/i;

/** Whether a tag's attributes mark it as one screen of an app: hidden, a screen-like class or id, a data-screen/route/view/page attribute, or a tab panel. */
function isScreenTag(tag: string, attrs: string): boolean {
  if (/^template$/i.test(tag)) return true;
  if (/(^|\s)hidden(\s|=|$)/i.test(attrs)) return true;
  if (/\bdata-(screen|route|view|page)\b/i.test(attrs)) return true;
  if (/\brole\s*=\s*["']?tabpanel\b/i.test(attrs)) return true;
  for (const m of attrs.matchAll(/\b(class|id)\s*=\s*["']([^"']*)["']/gi)) if (SCREEN_WORD.test(m[2] ?? '')) return true;
  return false;
}

/**
 * For lint --app: the h1 elements of an HTML file outside scripts, and whether each sits
 * inside its own screen (no two in the same one, none outside a screen).
 */
export function h1Screens(text: string): { count: number; separate: boolean } {
  const blank = (s: string): string => s.replace(/[^\n]/g, ' ');
  const html = text.replace(/<!--[\s\S]*?-->/g, blank).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, blank);
  const stack: Array<{ tag: string; screen: number | null }> = [];
  const used = new Set<number>();
  let count = 0;
  let separate = true;
  for (const m of html.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/gi)) {
    const [, close, rawTag = '', attrs = ''] = m;
    const tag = rawTag.toLowerCase();
    if (close) {
      // Close up to the matching open tag; unclosed tags inside it are closed with it.
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]?.tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    if (tag === 'h1') {
      count++;
      let screen: number | null = null;
      for (let i = stack.length - 1; i >= 0 && screen === null; i--) screen = stack[i]?.screen ?? null;
      if (screen === null || used.has(screen)) separate = false;
      else used.add(screen);
    }
    if (VOID_TAGS.test(tag) || attrs.trim().endsWith('/')) continue;
    stack.push({ tag, screen: isScreenTag(tag, attrs) ? m.index : null });
  }
  return { count, separate };
}

/** Check a set of source files. Pure: it reads nothing from disk. */
export function lint(files: SourceFile[], options: LintOptions = {}): LintResult {
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
  let anySafeArea = false;
  const outlineNone: Array<{ file: string; line: number }> = [];
  const coverViewports: Array<{ file: string; line: number }> = [];

  for (const { path: file, text } of files) {
    const isHtml = /\.html?$/i.test(file);

    // Small text. --app: 11px is the platform's smallest text.
    const minText = options.app ? 11 : 12;
    each(text, /font-size\s*:\s*([0-9.]+)(px|rem|em)\b/gi, (m) => {
      const value = parseFloat(m[1] ?? '');
      const unit = (m[2] ?? '').toLowerCase();
      const px = unit === 'px' ? value : unit === 'rem' ? value * 16 : null;
      if (px !== null && px > 0 && px < minText) add('P2', 'small-text', file, lineOf(text, m.index), `font-size ${m[1]}${m[2]} is under ${minText}px.`);
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
      // A rule that removes the outline and draws a shadow or border in its place is fine.
      const open = text.lastIndexOf('{', m.index);
      const close = text.indexOf('}', m.index);
      const block = text.slice(open + 1, close === -1 ? undefined : close);
      if (open !== -1 && /box-shadow\s*:(?!\s*none)|border[a-z-]*\s*:(?!\s*(none|0)\b)/i.test(block)) return;
      outlineNone.push({ file, line: lineOf(text, m.index) });
    });

    // Viewport and zoom.
    if (isHtml && /<html[\s>]/i.test(text)) {
      if (!/<meta[^>]+name=["']viewport["']/i.test(text)) add('P1', 'viewport-meta', file, 1, 'No viewport meta tag; the page will not fit phone screens.');
      const html = /<html([^>]*)>/i.exec(text);
      if (html && !/\blang\s*=/.test(html[1] ?? '')) add('P2', 'lang', file, lineOf(text, html.index), 'The html element has no lang attribute.');
      const h1s = (text.match(/<h1[\s>]/gi) ?? []).length;
      const otherHeads = /<h[2-6][\s>]/i.test(text);
      // --app: h1s in separate hash-routed screens, or in scripts that draw one screen at a time, are one per screen.
      const appScreens = options.app && h1s > 1 ? h1Screens(text) : null;
      const oneEachScreen = !!appScreens && (appScreens.count <= 1 || appScreens.separate);
      // An empty app shell has no headings at all; that is not this problem.
      if ((h1s > 1 && !oneEachScreen) || (h1s === 0 && otherHeads)) add('P2', 'h1-count', file, 1, `Page has ${h1s} h1 elements; it should have one.`);
    }
    each(text, /user-scalable\s*=\s*(no|0)\b|maximum-scale\s*=\s*([0-9.]+)/gi, (m) => {
      // People must be able to zoom to 200%, so a maximum scale under 2 blocks them too.
      if (m[2] !== undefined && !(parseFloat(m[2]) < 2)) return;
      add('P1', 'zoom-blocked', file, lineOf(text, m.index), 'The viewport tag blocks pinch zoom (it must allow at least 200%).');
    });
    each(text, /viewport-fit\s*=\s*cover/gi, (m) => {
      coverViewports.push({ file, line: lineOf(text, m.index) });
    });
    if (/env\(\s*safe-area-inset/i.test(text)) anySafeArea = true;
    // A file that also uses dvh or svh has thought about the phone's moving toolbars.
    const dynamicVh = /\d(dvh|svh)\b/.test(text);
    each(text, /\b(height|min-height)\s*:\s*100vh\b/gi, (m) => {
      if (dynamicVh) return;
      add('P2', 'vh-units', file, lineOf(text, m.index), '100vh is taller than the visible area on phones; use 100dvh (or 100svh), keeping 100vh as a fallback.');
    });

    // Images and forms.
    each(text, /<img\b[^>]*>/gi, (m) => {
      if (!isHtml && /[{}]/.test(m[0])) return; // component syntax can end the match early; do not guess
      if (!/\balt\s*=/.test(m[0])) add('P1', 'img-alt', file, lineOf(text, m.index), 'Image has no alt attribute (use alt="" if decorative).');
      // Without width and height the page jumps when the image loads. In components a class may size it, so do not guess there.
      const sized = /\bwidth\s*=/.test(m[0]) && /\bheight\s*=/.test(m[0]);
      const styled = /aspect-ratio|height\s*:/i.test(m[0]) || (!isHtml && /\bclass(Name)?\s*=/.test(m[0]));
      if (!sized && !styled) add('P3', 'image-no-size', file, lineOf(text, m.index), 'Image has no width and height attributes, so the page jumps when it loads.');
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
    each(text, /<(div|span)\b[^<]*?\s(onclick|onClick|on:click|@click|v-on:click)\s*=/g, (m) => {
      const next = text.indexOf('<', m.index + 1);
      const tag = text.slice(m.index, next === -1 ? m.index + 400 : next);
      if (/\brole\s*=/.test(tag)) return;
      add('P2', 'clickable-div', file, lineOf(text, m.index), `A ${m[1]} has a click handler but no role; use a button or link so keyboard and screen-reader users can use it.`);
    });
    each(text, /\b(onpaste|onPaste|on:paste|@paste)\s*=|addEventListener\(\s*['"]paste['"]/g, (m) => {
      const after = text.slice(m.index, m.index + 300);
      if (/preventDefault|return\s+false/.test(after)) {
        add('P1', 'paste-blocked', file, lineOf(text, m.index), 'Pasting is blocked; this breaks password managers and people who paste codes.');
      }
    });
    each(text, /\btab[iI]ndex\s*=\s*["'{]?\s*([1-9]\d*)/g, (m) => {
      add('P2', 'tabindex-positive', file, lineOf(text, m.index), `tabindex="${m[1]}" pulls this element out of reading order for keyboard users; use 0 or -1.`);
    });
    // A headline that is deliberately a control is fine when each control has its own accessible name (craft.md).
    each(text, /<h[1-6]\b[^>]*>(?:(?!<\/h[1-6]>)[\s\S])*?<(select|button|input)\b([^>]*)>/gi, (m) => {
      if (/\baria-label(ledby)?\s*=/i.test(m[2] ?? '')) return;
      add('P2', 'control-in-heading', file, lineOf(text, m.index), `A ${m[1]} sits inside a heading with no accessible name of its own; its text becomes part of the heading. Give it an aria-label, or move it beside the heading.`);
    });

    // Content.
    each(text, /lorem ipsum/gi, (m) => {
      add('P1', 'placeholder-text', file, lineOf(text, m.index), 'Lorem ipsum placeholder text.');
    });
    // TODO and "placeholder text" only count in text a visitor would see, not in code comments.
    if (!/\.(css|scss|less)$/i.test(file)) {
      const blank = (s: string): string => s.replace(/[^\n]/g, ' ');
      let shown = text.replace(/<!--[\s\S]*?-->/g, blank).replace(/\/\*[\s\S]*?\*\//g, blank);
      if (isHtml) shown = shown.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, blank).replace(/<[^>]+>/g, blank);
      else {
        // In components, keep only text between tags, after removing line comments.
        shown = shown.replace(/(^|[^:])\/\/[^\n]*/g, (c, lead: string) => lead + blank(c.slice(lead.length)));
        const kept = blank(shown).split('');
        each(shown, />([^<>{}]+)</g, (m) => {
          for (let i = m.index + 1; i < m.index + 1 + (m[1] ?? '').length; i++) kept[i] = shown[i] ?? ' ';
        });
        shown = kept.join('');
      }
      each(shown, /\bTODO\b|\b[Pp]laceholder text\b/g, (m) => {
        add('P2', 'placeholder-text', file, lineOf(text, m.index), `"${m[0]}" is left in visible text.`);
      });
    }
    each(text, /\b(John|Jane) Doe\b|\bAcme\b/g, (m) => {
      add('tell', 'stock-names', file, lineOf(text, m.index), `Stock placeholder name "${m[0]}".`);
    });
    const visible = text.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');
    const slop = SLOP.filter((w) => new RegExp('\\b' + w + '\\b', 'i').test(visible));
    // A video that plays by itself (pictures.md): muted, playsinline, a poster, a pause control; and its file's weight.
    each(text, /<video\b[^>]*>/gi, (m) => {
      const tag = m[0];
      if (!/\bautoplay\b|\bautoPlay\b/.test(tag)) return;
      const line = lineOf(text, m.index);
      if (!/\bmuted\b/i.test(tag)) add('P1', 'hero-video', file, line, 'A video that plays by itself has no muted attribute: phones will not autoplay it, and an opening never needs sound.');
      const missing: string[] = [];
      if (!/\bplaysinline\b/i.test(tag)) missing.push('playsinline');
      if (!/\bposter\s*=/.test(tag)) missing.push('poster');
      if (missing.length) add('P2', 'hero-video', file, line, 'A video that plays by itself has no ' + missing.join(' and no ') + ' (pictures.md).');
      if (!/\bcontrols\b/.test(tag) && !/(>|aria-label\s*=\s*["'{][^"'}]*)\s*(pause|stop)\b/i.test(text)) add('P2', 'hero-video', file, line, 'No pause control found in this file for a video that plays by itself (WCAG 2.2.2): add a visible pause button.');
    });
    each(text, /<(?:video|source)\b[^>]*\bsrc\s*=\s*["']([^"'{}]+\.(?:mp4|m4v|webm|mov|ogv))["']/gi, (m) => {
      const ref = m[1] ?? '';
      if (/^[a-z]+:|^\/\//i.test(ref)) return;
      const onDisk = path.resolve(path.dirname(file), ref.split(/[?#]/)[0] ?? '');
      let size = 0;
      try {
        size = fs.statSync(onDisk).size;
      } catch {
        return;
      }
      if (size > 4 * 1024 * 1024) add('P3', 'video-heavy', file, lineOf(text, m.index), ref + ' is ' + (size / 1048576).toFixed(1) + ' MB; aim for about 2-4 MB at 1080p and a smaller file for phones (photos.js loop; pictures.md).');
    });
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
    each(text, /@font-face\s*\{[^}]*\}/gi, (m) => {
      if (!/font-display\s*:/i.test(m[0])) {
        add('P3', 'font-display-missing', file, lineOf(text, m.index), '@font-face has no font-display; text can stay invisible while the font loads (use swap or optional).');
      }
    });
    // Tighter than -0.04em hurts legibility; heavy display type at 96px and above may go to -0.05em (type.md).
    // The size is the largest px value in the same rule's font-size (a clamp's maximum counts).
    each(text, /letter-spacing\s*:\s*(-0?\.\d+)em/gi, (m) => {
      const v = parseFloat(m[1] ?? '0');
      if (v >= -0.0401) return;
      const open = text.lastIndexOf('{', m.index);
      const close = text.indexOf('}', m.index);
      const block = text.slice(open + 1, close < 0 ? undefined : close);
      const sizeDecl = /font-size\s*:\s*([^;}]+)/i.exec(block) ?? /font\s*:\s*[^;}]*?([0-9.]+px|clamp\([^;}]*\))/i.exec(block);
      const px = Math.max(0, ...(sizeDecl?.[1]?.match(/[0-9.]+(?=px)/g) ?? []).map(parseFloat));
      if (v >= -0.0501 && px >= 96) return;
      add('P2', 'tight-tracking', file, lineOf(text, m.index), 'Letter-spacing of ' + v + 'em is tighter than -0.04em (-0.05em is allowed for display type at 96px and above), which hurts legibility.');
    });
  }

  const first = files[0];
  if (anyMotion && !anyReduced && first) add('P1', 'reduced-motion', first.path, 1, 'The code animates but nothing honours prefers-reduced-motion.');
  if (outlineNone.length && !anyFocusStyle) {
    for (const o of outlineNone.slice(0, MAX_PER_RULE)) add('P1', 'focus-removed', o.file, o.line, 'Focus outline removed and no replacement focus style found.');
  }
  if (!anySafeArea) {
    for (const v of coverViewports) {
      add('P2', 'safe-area-missing', v.file, v.line, 'viewport-fit=cover lets the page run under the notch and home indicator, but nothing uses env(safe-area-inset-*) to keep content clear.');
    }
  }

  const order: Record<Severity, number> = { P1: 0, P2: 1, P3: 2, tell: 3 };
  findings.sort((a, b) => order[a.sev] - order[b.sev]);
  return { findings, counts };
}

export const USAGE = [
  'Usage: node lint.js <file-or-folder> [more...] [--app]',
  '',
  'Scans HTML, CSS and component files for design slips visible in source. Reads only the',
  'files named, changes nothing, makes no network calls. It cannot see layout: overflow,',
  'overlap and real contrast need a rendered page (shot.js --check).',
  '',
  '  --app   the files are an app prototype with screens switched by URL hash: several h1',
  '          elements pass when each is in its own screen (a hidden section, or one whose',
  '          class or id says screen, view, page, route or panel, a data-screen, data-route,',
  '          data-view or data-page attribute, a tab panel or a template), and h1s inside',
  '          scripts count as screens drawn one at a time',
].join('\n');

export function main(targets: string[]): number {
  if (targets.includes('--help') || targets.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  const app = targets.includes('--app');
  const paths: string[] = [];
  for (const t of targets) if (t !== '--app') collect(t, paths);
  if (!paths.length) {
    console.log(USAGE);
    return 1;
  }
  const { findings, counts } = lint(paths.map((p) => ({ path: p, text: fs.readFileSync(p, 'utf8') })), { app });
  for (const f of findings) console.log(`${f.sev.padEnd(4)} ${f.where}  ${f.msg}  [${f.rule}]`);
  const extra = Object.entries(counts).filter(([, n]) => n > MAX_PER_RULE).map(([rule, n]) => `${rule} x${n}`);
  if (extra.length) console.log('More of the same not shown: ' + extra.join(', '));
  console.log((findings.length ? '' : 'Nothing obvious in the source. ') + `Checked ${paths.length} file(s).`);
  console.log('Not checked (needs a rendered page): overflow, collapsed columns, overlapping text, real contrast, target sizes, whether forms complete.');
  return findings.some((f) => f.sev === 'P1') ? 2 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
